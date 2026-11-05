/*
 * Babson Procurement Assistant: embeddable chat widget.
 * Embed with: <script src="https://YOUR-APP.vercel.app/widget.js" defer></script>
 *
 * No dependencies. Everything lives inside a Shadow DOM, so it neither affects
 * nor is affected by the host page's CSS. Holds no secrets: the API key stays
 * on the server. The conversation is kept in memory only and disappears when
 * the page is closed or reloaded.
 */
(function () {
  "use strict";

  var HOST_TAG = "babson-procurement-assistant";
  if (document.querySelector(HOST_TAG)) return; // Already embedded on this page.

  var script = document.currentScript;
  if (!script || !script.src) return;
  var API_URL = new URL("/api/chat", script.src).href;

  var GREETING = "Hi! I'm the Babson Procurement Assistant. How can I help?";
  var STARTERS = [
    "Who do I contact in Accounts Payable?",
    "How do I get a P-Card?",
    "What are the supplier expectations?",
    "When do I need a purchase order?",
  ];
  var CONTACT_HELP =
    "You can also email procurement@babson.edu or visit https://www.babson.edu/business-and-financial-services/procurement/contact-information/";
  var MAX_INPUT_CHARS = 1000;
  var MAX_HISTORY = 19; // Odd, so the trimmed history always starts on a user turn.
  var TIMEOUT_MS = 60000;

  var CSS = [
    ":host { all: initial; }",
    "[hidden] { display: none !important; }",
    "*, *::before, *::after { box-sizing: border-box; }",
    ".root { --green: #006644; --green-dark: #045236; font: 15px/1.45 Arial, Helvetica, sans-serif; color: #1f1f1f; }",
    "button, textarea { font: inherit; }",

    ".bubble { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; width: 60px; height: 60px; padding: 0; border: 0; border-radius: 50%; background: var(--green); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,.3); }",
    ".bubble:hover { background: var(--green-dark); }",
    ".bubble svg { width: 28px; height: 28px; fill: currentColor; }",

    ".panel { position: fixed; right: 20px; bottom: 92px; z-index: 2147483000; width: 380px; max-width: calc(100vw - 40px); height: 560px; max-height: calc(100vh - 112px); display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.3); }",

    ".header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 8px 12px 16px; background: var(--green); color: #fff; }",
    ".title { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.3; }",
    ".close { width: 44px; height: 44px; flex: none; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #fff; font-size: 26px; line-height: 1; cursor: pointer; }",
    ".close:hover { background: rgba(255,255,255,.18); }",

    ".messages { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }",
    ".msg { max-width: 88%; padding: 9px 12px; border-radius: 12px; overflow-wrap: anywhere; }",
    ".msg p { margin: 0 0 8px; }",
    ".msg ol, .msg ul { margin: 0 0 8px; padding-left: 22px; }",
    ".msg > :last-child { margin-bottom: 0; }",
    ".bot { align-self: flex-start; background: #f0f3f1; border-bottom-left-radius: 3px; }",
    ".bot a { color: var(--green); text-decoration: underline; }",
    ".user { align-self: flex-end; background: var(--green); color: #fff; border-bottom-right-radius: 3px; white-space: pre-wrap; }",
    ".error { background: #fdf1f0; border: 1px solid #b3261e; }",

    ".chips { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }",
    ".chip { padding: 8px 12px; min-height: 36px; border: 1px solid var(--green); border-radius: 18px; background: #fff; color: var(--green); font-size: 14px; line-height: 1.3; text-align: left; cursor: pointer; }",
    ".chip:hover { background: var(--green); color: #fff; }",

    ".typing { display: flex; gap: 5px; padding: 13px 14px; }",
    ".dot { width: 7px; height: 7px; border-radius: 50%; background: #5f6b65; animation: bpa-bounce 1.2s infinite ease-in-out; }",
    ".dot:nth-child(2) { animation-delay: .15s; }",
    ".dot:nth-child(3) { animation-delay: .3s; }",
    "@keyframes bpa-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }",

    ".form { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px 6px; border-top: 1px solid #dfe3e1; }",
    ".input { flex: 1; min-width: 0; min-height: 44px; max-height: 110px; padding: 10px 12px; border: 1px solid #6b7570; border-radius: 8px; background: #fff; color: #1f1f1f; line-height: 1.35; resize: none; }",
    ".send { height: 44px; flex: none; padding: 0 16px; border: 0; border-radius: 8px; background: var(--green); color: #fff; font-weight: 700; cursor: pointer; }",
    ".send:hover:not(:disabled) { background: var(--green-dark); }",
    ".send:disabled { background: #6b7570; cursor: not-allowed; }",
    ".note { margin: 0; padding: 2px 12px 10px; font-size: 12px; color: #55605a; text-align: center; }",

    ".sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }",

    "button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 3px solid #eeaf00; outline-offset: 2px; }",
    ".input:focus-visible { outline-offset: 0; }",

    "@media (max-width: 480px) {",
    "  .panel { inset: 0; width: 100%; max-width: none; height: 100%; max-height: none; border-radius: 0; }",
    "  .input { font-size: 16px; }", // Below 16px, iOS Safari zooms the page on focus.
    "}",
    "@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }",
    "@media print { .bubble, .panel { display: none !important; } }",
  ].join("\n");

  // Fixed markup only. Anything from the model or the user goes through
  // textContent and createElement below, never through innerHTML.
  var TEMPLATE =
    '<div class="root">' +
    '<button type="button" class="bubble" aria-label="Open Babson Procurement Assistant chat" aria-expanded="false" aria-controls="bpa-panel">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>' +
    "</button>" +
    '<section class="panel" id="bpa-panel" role="dialog" aria-labelledby="bpa-title" hidden>' +
    '<div class="header"><h2 class="title" id="bpa-title">Babson Procurement Assistant</h2>' +
    '<button type="button" class="close" aria-label="Close chat">&times;</button></div>' +
    '<div class="messages" tabindex="0" role="group" aria-label="Conversation"></div>' +
    '<div class="sr-only status" role="status" aria-live="polite"></div>' +
    '<form class="form">' +
    '<textarea class="input" rows="1" aria-label="Type your question" placeholder="Type your question"></textarea>' +
    '<button type="submit" class="send">Send</button>' +
    "</form>" +
    '<p class="note">AI assistant: answers may not be perfect</p>' +
    "</section></div>";

  var host = document.createElement(HOST_TAG);
  var shadow = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent = CSS;
  shadow.appendChild(style);
  var mount = document.createElement("div");
  mount.innerHTML = TEMPLATE;
  shadow.appendChild(mount.firstChild);
  (document.body || document.documentElement).appendChild(host);

  var bubble = shadow.querySelector(".bubble");
  var panel = shadow.querySelector(".panel");
  var closeButton = shadow.querySelector(".close");
  var messagesEl = shadow.querySelector(".messages");
  var statusEl = shadow.querySelector(".status");
  var form = shadow.querySelector(".form");
  var input = shadow.querySelector(".input");
  var sendButton = shadow.querySelector(".send");
  input.maxLength = MAX_INPUT_CHARS;

  var history = [];
  var pending = false;
  var chipsEl = null;

  /* ---------- Safe rendering of the model's answer ---------- */

  function safeHref(url) {
    try {
      var parsed = new URL(url);
      var allowed = ["http:", "https:", "mailto:", "tel:"];
      return allowed.indexOf(parsed.protocol) !== -1 ? parsed.href : null;
    } catch (e) {
      return null;
    }
  }

  function makeLink(text, url) {
    var href = safeHref(url);
    if (!href) return document.createTextNode(text);
    var a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    if (href.indexOf("http") === 0) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return a;
  }

  // A bare URL may end in sentence punctuation or a closing bracket that isn't
  // part of it. Babson's PDF links do contain balanced parentheses, so keep those.
  function splitTrailing(url) {
    var trailing = "";
    for (;;) {
      var last = url.charAt(url.length - 1);
      var unbalanced =
        last === ")" && url.split(")").length > url.split("(").length;
      if (/[.,;:!?]/.test(last) || unbalanced) {
        trailing = last + trailing;
        url = url.slice(0, -1);
      } else {
        return [url, trailing];
      }
    }
  }

  // Handles **bold**, [text](url), bare URLs, and bare email addresses.
  var INLINE = new RegExp(
    "\\*\\*([^*]+)\\*\\*" +
      "|\\[([^\\]]+)\\]\\(((?:[^()\\s]|\\([^()\\s]*\\))+)\\)" +
      "|(https?://[^\\s<>\\[\\]]+)" +
      "|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,})",
    "g",
  );

  function appendInline(parent, text) {
    var index = 0;
    var match;
    INLINE.lastIndex = 0;
    while ((match = INLINE.exec(text))) {
      parent.appendChild(document.createTextNode(text.slice(index, match.index)));
      index = INLINE.lastIndex;
      if (match[1] !== undefined) {
        var strong = document.createElement("strong");
        appendInline(strong, match[1]);
        parent.appendChild(strong);
        INLINE.lastIndex = index; // The nested call moved the shared regex.
      } else if (match[2] !== undefined) {
        parent.appendChild(makeLink(match[2], match[3]));
      } else if (match[4] !== undefined) {
        var parts = splitTrailing(match[4]);
        parent.appendChild(makeLink(parts[0], parts[0]));
        parent.appendChild(document.createTextNode(parts[1]));
      } else {
        parent.appendChild(makeLink(match[5], "mailto:" + match[5]));
      }
    }
    parent.appendChild(document.createTextNode(text.slice(index)));
  }

  function renderMarkdown(container, text) {
    container.textContent = "";
    var list = null;
    var listType = null;
    var paragraph = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      var p = document.createElement("p");
      appendInline(p, paragraph.join(" "));
      container.appendChild(p);
      paragraph = [];
    }
    function closeList() {
      list = null;
      listType = null;
    }

    text.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      var ordered = line.match(/^\d+[.)]\s+(.*)$/);
      var bullet = line.match(/^[-*•]\s+(.*)$/);
      if (!line) {
        flushParagraph();
        closeList();
      } else if (ordered || bullet) {
        flushParagraph();
        var type = ordered ? "ol" : "ul";
        if (listType !== type) {
          list = document.createElement(type);
          listType = type;
          container.appendChild(list);
        }
        var li = document.createElement("li");
        appendInline(li, (ordered || bullet)[1]);
        list.appendChild(li);
      } else {
        closeList();
        paragraph.push(line.replace(/^#{1,6}\s+/, ""));
      }
    });
    flushParagraph();
  }

  /* ---------- Conversation UI ---------- */

  function isNearBottom() {
    return (
      messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <
      80
    );
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addBotMessage(text, isError) {
    var el = document.createElement("div");
    el.className = "msg bot" + (isError ? " error" : "");
    if (text) renderMarkdown(el, text);
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function addUserMessage(text) {
    var el = document.createElement("div");
    el.className = "msg user";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "msg bot typing";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    messagesEl.appendChild(el);
    scrollToBottom();
    statusEl.textContent = "The assistant is typing.";
    return el;
  }

  function announce(text) {
    // Announced once when complete: streaming into a live region would make a
    // screen reader re-read the answer with every new word.
    statusEl.textContent = text;
  }

  function setPending(value) {
    pending = value;
    sendButton.disabled = value;
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + 2 + "px";
  }

  /* ---------- Talking to the API ---------- */

  function friendlyStatusError(status) {
    if (status === 429) {
      return "You've sent a lot of questions in a short time. Please wait a little and try again. " + CONTACT_HELP;
    }
    return "Sorry, I couldn't get an answer just now. " + CONTACT_HELP;
  }

  function ask(question) {
    if (pending) return;
    setPending(true);
    if (chipsEl) {
      chipsEl.remove();
      chipsEl = null;
    }

    addUserMessage(question);
    history.push({ role: "user", content: question });

    var typing = showTyping();
    var botEl = null;
    var answer = "";
    var failure = null;

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, TIMEOUT_MS);

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
      signal: controller.signal,
    })
      .then(function (response) {
        if (!response.ok || !response.body) {
          failure = friendlyStatusError(response.status);
          return;
        }
        return readStream(response.body.getReader());
      })
      .catch(function () {
        failure = "Sorry, I couldn't reach the assistant. Please check your connection and try again. " + CONTACT_HELP;
      })
      .then(function () {
        clearTimeout(timer);
        typing.remove();
        if (!answer && !failure) {
          failure = "Sorry, I couldn't get an answer just now. " + CONTACT_HELP;
        }
        if (failure) {
          addBotMessage(failure, true);
          announce(failure);
          // Drop the failed turn so a retry still has alternating user/assistant history.
          history.pop();
        } else {
          history.push({ role: "assistant", content: answer });
          announce(answer);
        }
        setPending(false);
      });

    function readStream(reader) {
      var decoder = new TextDecoder();
      var buffer = "";

      function handleLine(line) {
        if (!line.trim()) return;
        var event;
        try {
          event = JSON.parse(line);
        } catch (e) {
          return;
        }
        if (event.type === "text") {
          var stick = isNearBottom();
          if (!botEl) {
            typing.remove();
            botEl = addBotMessage("");
          }
          answer += event.text;
          renderMarkdown(botEl, answer);
          if (stick) scrollToBottom();
        } else if (event.type === "error") {
          failure = event.message || "Sorry, something went wrong. " + CONTACT_HELP;
        }
      }

      function pump() {
        return reader.read().then(function (result) {
          buffer += decoder.decode(result.value || new Uint8Array(), {
            stream: !result.done,
          });
          var lines = buffer.split("\n");
          buffer = lines.pop();
          lines.forEach(handleLine);
          if (result.done) {
            handleLine(buffer);
            return;
          }
          return pump();
        });
      }
      return pump();
    }
  }

  /* ---------- Opening, closing, and input ---------- */

  function addStarters() {
    chipsEl = document.createElement("div");
    chipsEl.className = "chips";
    chipsEl.setAttribute("role", "group");
    chipsEl.setAttribute("aria-label", "Suggested questions");
    STARTERS.forEach(function (question) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = question;
      chip.addEventListener("click", function () {
        ask(question);
        input.focus();
      });
      chipsEl.appendChild(chip);
    });
    messagesEl.appendChild(chipsEl);
  }

  function open() {
    if (!messagesEl.childElementCount) {
      addBotMessage(GREETING);
      addStarters();
    }
    panel.hidden = false;
    bubble.setAttribute("aria-expanded", "true");
    bubble.setAttribute("aria-label", "Close Babson Procurement Assistant chat");
    input.focus();
  }

  function close() {
    panel.hidden = true;
    bubble.setAttribute("aria-expanded", "false");
    bubble.setAttribute("aria-label", "Open Babson Procurement Assistant chat");
    bubble.focus();
  }

  bubble.addEventListener("click", function () {
    if (panel.hidden) open();
    else close();
  });
  closeButton.addEventListener("click", close);

  panel.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  });

  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var question = input.value.trim();
    if (!question || pending) return;
    input.value = "";
    resizeInput();
    ask(question);
  });
})();
