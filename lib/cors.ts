/**
 * Decides whether a browser Origin may call the API.
 *
 * Hostnames are compared after parsing rather than with a substring match, so
 * look-alikes such as babson.edu.evil.com and notbabson.edu are rejected.
 */
export function isAllowedOrigin(
  origin: string | null,
  requestHost: string | null,
  extraOrigins: string | undefined = process.env.ALLOWED_ORIGINS,
): boolean {
  if (!origin) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  const { protocol, hostname, host } = url;

  if (
    protocol === "https:" &&
    (hostname === "babson.edu" || hostname.endsWith(".babson.edu"))
  ) {
    return true;
  }

  if (
    (protocol === "http:" || protocol === "https:") &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  ) {
    return true;
  }

  // Same-origin, so /test.html works when hosted on the app's own domain.
  // A web page on another site cannot fake its Origin header to match this.
  if (requestHost && host === requestHost) return true;

  const extras = (extraOrigins ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return extras.includes(url.origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
