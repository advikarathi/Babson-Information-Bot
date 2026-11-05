import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, isAllowedOrigin } from "@/lib/cors";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getSystemPrompt } from "@/lib/systemPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-5-5";
// Thinking counts toward this cap, so leave headroom beyond a short answer.
const MAX_TOKENS = 2048;

const MAX_BODY_CHARS = 128_000;
const MAX_MESSAGES = 20;
const MAX_USER_CHARS = 2_000;
const MAX_ASSISTANT_CHARS = 12_000;

const CONTACT_FALLBACK =
  "Please email procurement@babson.edu or visit https://www.babson.edu/business-and-financial-services/procurement/contact-information/";

// PRIVACY: nothing in this file logs or stores message content. Error logs
// record only the error type and HTTP status. Please keep it that way.

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function parseMessages(body: unknown): Anthropic.MessageParam[] | null {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES
  ) {
    return null;
  }

  const parsed: Anthropic.MessageParam[] = [];
  for (const [index, message] of messages.entries()) {
    const { role, content } = (message ?? {}) as {
      role?: unknown;
      content?: unknown;
    };
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    const limit = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (
      role !== expectedRole ||
      typeof content !== "string" ||
      !content.trim() ||
      content.length > limit
    ) {
      return null;
    }
    parsed.push({ role: expectedRole, content });
  }

  // Must end on a user turn: this model rejects a trailing assistant message.
  return parsed[parsed.length - 1].role === "user" ? parsed : null;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return `The assistant is very busy right now. Please try again in a minute. ${CONTACT_FALLBACK}`;
  }
  return `Sorry, something went wrong on my end. ${CONTACT_FALLBACK}`;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin, request.headers.get("host"))) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  // Browsers enforce CORS themselves. This also refuses the request server-side,
  // so a disallowed site costs no API usage.
  if (!isAllowedOrigin(origin, request.headers.get("host"))) {
    return json({ error: "Origin not allowed." }, 403, { Vary: "Origin" });
  }
  const headers = corsHeaders(origin);

  const limit = checkRateLimit(getClientIp(request.headers));
  if (!limit.allowed) {
    return json(
      { error: "You've sent a lot of questions. Please wait and try again." },
      429,
      { ...headers, "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
    return json({ error: "That conversation is too long." }, 413, headers);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400, headers);
  }

  const messages = parseMessages(body);
  if (!messages) {
    return json({ error: "Invalid request." }, 400, headers);
  }

  // Response format: newline-delimited JSON, one event per line:
  //   {"type":"text","text":"..."}  {"type":"error","message":"..."}  {"type":"done"}
  const encoder = new TextEncoder();
  let apiStream: ReturnType<Anthropic["messages"]["stream"]> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const client = new Anthropic();
        apiStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          output_config: { effort: "low" },
          system: [
            {
              type: "text",
              text: getSystemPrompt(),
              cache_control: { type: "ephemeral" },
            },
          ],
          messages,
        });

        for await (const event of apiStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await apiStream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message: `I'm not able to help with that here. ${CONTACT_FALLBACK}`,
          });
        } else if (final.stop_reason === "max_tokens") {
          send({
            type: "text",
            text: `\n\nThat answer was cut short. ${CONTACT_FALLBACK}`,
          });
        }
        send({ type: "done" });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          console.error(`Anthropic API error: status ${error.status}`);
        } else if (!process.env.ANTHROPIC_API_KEY) {
          console.error(
            "Chat error: ANTHROPIC_API_KEY is not set. Add it to .env.local (local) or the Vercel project settings, then restart or redeploy.",
          );
        } else {
          console.error(
            `Chat error: ${error instanceof Error ? error.name : "unknown"}`,
          );
        }
        send({ type: "error", message: describeError(error) });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // The visitor closed the page, so stop generating and paying for tokens.
      apiStream?.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...headers,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
