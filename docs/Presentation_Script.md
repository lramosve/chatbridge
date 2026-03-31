# ChatBridge Architecture Presentation — Speaker Script

**Total time: ~4:30 (8 slides)**
**Focus: core problem, key decisions and WHY, trade-offs, uncertainties**

---

## Slide 1: Title (10 seconds)

ChatBridge is an AI chat platform where third-party apps live inside the conversation. A student can play chess, check weather, or create a Spotify playlist — all without leaving the chat window, with the chatbot staying aware the entire time. Let me walk through the architecture, focusing on the three design decisions that matter most.

---

## Slide 2: The Core Problem (50 seconds)

The core problem is the boundary between the chat and the third-party app. The platform has to render an app's UI, call its tools with the right parameters, track its state, know when it's done, and keep the conversation coherent — all without being able to predict what any given app will do. Consider chess: a student says "let's play," a board appears, they ask mid-game "what should I do here?", the chatbot analyzes the board, the game ends, the conversation continues. Every handoff in that sequence is a potential failure point.

This creates three specific hard problems. First, the boundary problem — third parties control their own UI and tools. The platform must be generic enough to support anything from a calculator to a chess game.

Second, the safety constraint. These are K-12 students. A broken or malicious app cannot be allowed to access student data or crash the chat. The security boundary must be enforced by the browser, not by trusting app developers.

Third, the state gap. The LLM needs to reason about what's happening inside an app it doesn't control. When a student asks for help mid-chess-game, the chatbot needs to know the board state. But the app owns that state. We need a protocol for sharing it.

---

## Slide 3: Decision 1 — Iframe Sandboxing (50 seconds)

The first and most important decision: every third-party app runs in an iframe with the sandbox attribute — and critically, without `allow-same-origin`.

We evaluated three options. Web Components are lighter weight and share styling, but they run in the same JavaScript context as the platform. A broken component can crash the host page. For third-party code targeting children, that's unacceptable. Server-side rendering avoids client-side execution, but interactive apps like chess need client-side code, so it brings us right back to the same problem.

Iframes give us a separate browsing context. The browser itself enforces the security boundary. Without `allow-same-origin`, even malicious JavaScript in the app cannot access the parent window's cookies, localStorage, or DOM. This is enforced by the browser's Same-Origin Policy, not by our code.

The trade-off we accepted: this adds friction. Apps can't share styling with the parent. They can't use their own cookies. Any app that needs persistent state must either use its own backend or ask the platform to store data via postMessage. We mitigate this with a JavaScript SDK that handles the boilerplate, but the friction is real. We accept it because the safety guarantee is non-negotiable for K-12.

---

## Slide 4: Decision 2 — The PostMessage Protocol (50 seconds)

The second decision is the typed postMessage protocol. This is arguably the most important thing we build, because it IS the platform. It's the only way apps and the chat can communicate.

Seven message types. Two from platform to app: TOOL_INVOKE sends a tool call with parameters, RESTORE_STATE helps apps recover after an iframe reload. Five from app to platform: APP_READY signals the iframe loaded, TOOL_RESULT returns data, STATE_UPDATE shares ongoing state, APP_COMPLETE signals the interaction is finished, and APP_ERROR reports problems.

Let me explain why these specific messages exist. STATE_UPDATE is separate from TOOL_RESULT because apps have ongoing state that changes outside of tool calls — a chess board changes with every move, not just when the LLM invokes a tool. The LLM needs this state for mid-interaction questions.

APP_COMPLETE is explicit rather than inferred. We don't try to guess when an app is done. Completion signaling is where the project brief says most teams struggle, and inferring it from context is unreliable — is a paused chess game "done"? The app tells us, period.

APP_READY exists because iframes load asynchronously. Without it, we'd send TOOL_INVOKE before the app is listening — a race condition on every cold start.

---

## Slide 5: Decision 3 — Plugin Tools as AI SDK Function Calls (40 seconds)

The third decision: plugin tools are just more function calls to the LLM. Chatbox already uses the Vercel AI SDK with function calling and MCP tools. Our key insight is that the LLM doesn't need to know the difference between a built-in web search and a chess move. They're all tools.

The flow: an app publishes a manifest at a well-known URL declaring its tools as JSON Schema. Our plugin registry fetches and validates these manifests, then converts them into the AI SDK's tool format. At generation time, all tools — built-in, MCP, and plugin — are merged into one flat list. When the LLM decides to call a plugin tool, that tool's execute function sends a postMessage to the app's iframe and awaits the result.

What we get for free: the LLM routes user intent automatically, streaming pauses and resumes around tool calls, multi-provider support, and context compaction for long conversations. All of that already works in Chatbox.

The uncertainty here is routing accuracy. An ambiguous query like "help me practice" could match multiple apps. Tool descriptions are our main lever, but we may need a confirmation step or heuristic. Testing with adversarial prompts will be critical.

---

## Slide 6: How It Connects — Chess Walkthrough (30 seconds)

Let me show how all three decisions work together. User says "let's play chess." The LLM routes to the chess tool via function calling — that's decision three. The iframe loads with sandbox restrictions — decision one. The app signals APP_READY, the board renders. The user plays, asks "what should I do?" The app sends a STATE_UPDATE with the FEN string — that's decision two. The LLM gets the board state in its context, analyzes the position, responds. When the game ends, APP_COMPLETE fires, and the conversation resumes with full context.

The critical point: Weather and Spotify follow the exact same lifecycle. Only the tool schemas and iframe content differ. The protocol is universal.

---

## Slide 7: Trade-offs & Open Questions (40 seconds)

Let me be honest about what we traded away and what we haven't solved.

Extending Chatbox gives us a mature chat UI for free, but it's a local-first Electron app. Its architecture — IndexedDB, no shared backend — isn't designed for a multi-user web platform. We bolt on Supabase for server-side concerns, but some patterns won't translate cleanly.

The strict iframe sandbox protects students but adds developer friction. Every app needing storage must go through postMessage or use its own backend. Our SDK helps, but it's still more work than just using localStorage.

Open questions we haven't fully solved: OAuth popup flows are fragile across browsers — popup blockers vary and fallback UX is unclear. Context window pressure with 20+ apps would require per-conversation tool pruning. App review pipelines for production K-12 need automated content scanning — out of scope for the sprint but architecturally important. And state restoration after an app crash depends entirely on the app; the platform can't guarantee it.

---

## Slide 8: Closing (10 seconds)

Three decisions define this architecture. Iframes for isolation — safety enforced by the browser. A typed postMessage protocol — the universal contract. Plugin tools as AI SDK function calls — natural routing without reinventing the wheel. And as the project brief says: a simple chat with one rock-solid integration beats a flashy platform where apps break mid-conversation. Thank you.
