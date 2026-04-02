# ChatBridge Demo Script (~4:30)

## Intro (0:00 - 0:20)
**Say:** "This is ChatBridge — an AI chat platform where third-party apps live inside the conversation. I'll show three plugins covering three integration patterns: Chess as an internal app, Weather as a public API, and GitHub Gists with OAuth authentication."

**Show:** The main chat screen at chatbridge-delta.vercel.app

---

## Scene 1: Weather — Public API (0:20 - 1:10)
**Covers:** Scenarios #1 (tool discovery), #2 (UI renders), #4 (context retention)

1. Start a **New Chat**
2. Type: **"What's the weather in Tokyo?"**
3. **Show:** The LLM calls `weather__get_weather`, the side panel opens with the weather card
4. **Say:** "The LLM discovered the weather tool automatically via function calling. The app runs in a sandboxed iframe, and API calls are proxied through the platform since the iframe can't make cross-origin requests."
5. Type: **"How about New York?"**
6. **Show:** The side panel updates with New York weather
7. **Say:** "The LLM retains context — it knows we're talking about weather and calls the same tool again."

---

## Scene 2: Chess — Stateful Internal App (1:10 - 2:30)
**Covers:** Scenarios #3 (completion signaling), #5 (switch between apps)

1. In the **same chat**, type: **"Let's play chess"**
2. **Show:** Side panel switches from Weather to Chess, board appears
3. **Say:** "We just switched apps in the same conversation — that's scenario five. Chess is an internal app with no external API. The board renders via the postMessage protocol."
4. Make a move by clicking on the board (e.g., e2 to e4)
5. Type: **"What should I do next?"**
6. **Show:** The LLM analyzes the board state (injected via STATE_UPDATE with the FEN string)
7. **Say:** "The app sent a STATE_UPDATE with the board position as a FEN string. The LLM can reason about it without controlling the app directly."
8. Type: **"I resign"**
9. **Show:** LLM calls `chess__resign_game`, APP_COMPLETE fires
10. **Say:** "The app explicitly signaled completion. The conversation resumes with full context of what happened."

---

## Scene 3: GitHub — OAuth Flow (2:30 - 3:30)
**Covers:** Scenario #6 (routing accuracy), #7 (refuse unrelated)

1. Type: **"Create a gist with a hello world Python script"**
2. **Show:** LLM calls `github__create_gist`, gets AUTH_REQUIRED error, tells user to connect
3. **Say:** "The LLM correctly routed to the GitHub plugin and received an auth-required response. Let me connect."
4. Enter your **Client ID** and **Client Secret** in the side panel, click **Connect GitHub**
5. **Show:** OAuth popup opens, authorize, popup closes, "Connected as [username]"
6. **Say:** "OAuth uses a popup flow — the sandboxed iframe can't handle redirects, so the popup escapes the sandbox, completes auth, and sends the code back. Token exchange goes through a Supabase Edge Function since GitHub blocks browser CORS."
7. Type: **"Now create that gist"**
8. **Show:** Gist created, URL displayed

---

## Scene 4: Routing & Refusal (3:30 - 3:50)
**Covers:** Scenario #6 (ambiguous), #7 (refuse)

1. Type: **"What's 2+2?"**
2. **Show:** LLM answers without calling any plugin
3. **Say:** "The LLM correctly refused to invoke any app for an unrelated query."

---

## Scene 5: Architecture (3:50 - 4:30)
**Say while showing the side panel:**

"Three design decisions define this architecture:

**One** — Iframe sandboxing. Apps run without allow-same-origin. The browser enforces isolation. External API calls are proxied through the platform via a FETCH_REQUEST message.

**Two** — A typed postMessage protocol with nine message types. TOOL_INVOKE, TOOL_RESULT, STATE_UPDATE, APP_COMPLETE, and FETCH_REQUEST/RESPONSE are the key ones. Apps that implement this protocol work automatically.

**Three** — Plugin tools as AI SDK function calls. Each plugin publishes a manifest declaring its tools as JSON Schema. These get converted to Vercel AI SDK tool definitions. The LLM sees them alongside built-in tools and routes naturally via function calling.

Three apps, three patterns — internal, public API, and OAuth — all running through the same protocol."

---

## Recording Tips
- Use a browser at **1280x720** for clean resolution
- Clear old chats from the sidebar before recording
- Pre-enter the GitHub Client ID/Secret so you just paste them quickly
- If a tool call is slow, narrate while waiting: "The platform is proxying this through the fetch bridge..."

---

## Testing Scenario Coverage

| # | Scenario | Where in Demo |
|---|----------|--------------|
| 1 | Tool discovery + invocation | Scene 1: "What's the weather in Tokyo?" |
| 2 | App UI renders in chat | Scene 1: Weather card in side panel |
| 3 | Interaction then completion signaling | Scene 2: Chess resign → APP_COMPLETE |
| 4 | Context retention after completion | Scene 1: Follow-up "How about New York?" |
| 5 | Switch between multiple apps | Scene 2: Weather → Chess in same chat |
| 6 | Routing accuracy | Scene 3: Routes to GitHub for gist creation |
| 7 | Refuse unrelated queries | Scene 4: "What's 2+2?" → no plugin called |
