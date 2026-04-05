# ChatBridge Demo Script (~4:30)

## Intro (0:00 - 0:20)
**Say:** "ChatBridge is an AI chat platform designed for K-12 education where third-party learning apps live inside the conversation. The key challenge: teachers need apps to be sandboxed for student safety, the AI must stay aware of what students are doing, and interactions need clear start and end points. I'll show how the plugin lifecycle handles this with five apps — but we'll focus on three that demonstrate the core patterns."

**Show:** The main chat screen at chatbridge-delta.vercel.app

---

## Scene 1: Flashcards — Educational Value + Full Lifecycle (0:20 - 1:30)
**Covers:** Scenarios #1 (tool discovery), #2 (UI renders), #3 (completion signaling), #4 (context retention)

1. Start a **New Chat**
2. Type: **"Help me study the first 5 elements of the periodic table"**
3. **Show:** LLM generates flashcards and calls `flashcards__create_deck`. Side panel opens with the flashcard UI.
4. **Say:** "The LLM discovered the flashcard tool from the manifest and generated a deck. The app runs in a sandboxed iframe in the side panel — like ChatGPT's canvas, but for any third-party app."
5. **Flip a card, mark it correct. Flip another, mark it wrong.**
6. **Say:** "Each answer sends a STATE_UPDATE with my progress. The LLM knows exactly how I'm doing."
7. Type: **"How am I doing so far?"**
8. **Show:** LLM calls `flashcards__get_study_progress` and reports accuracy
9. **Say:** "The AI can check my progress because STATE_UPDATE keeps it informed. In a classroom, this means the teacher's dashboard knows which students are struggling."
10. **Complete all cards in the deck.**
11. **Show:** Side panel shows the score and the **"Complete" badge** with summary in the banner.
12. **Say:** "Notice the completion signal. The app sent APP_COMPLETE with 'Session complete: 4/5 correct on Periodic Table Elements.' This is completion signaling — the platform doesn't guess when a student is done. The app tells us. A teacher would know this student actually finished their practice."

---

## Scene 2: Dictionary — App Switching + Public API (1:30 - 2:10)
**Covers:** Scenario #5 (switch between apps)

1. In the **same chat**, type: **"What does 'photosynthesis' mean?"**
2. **Show:** Side panel switches from Flashcards to Dictionary, shows definition with pronunciation
3. **Say:** "We just switched apps in the same conversation. The dictionary uses a public API — but the iframe can't make cross-origin requests, so the platform proxies it through FETCH_REQUEST. The student sees definitions, pronunciation, and builds a vocabulary list."
4. Type: **"Add that to my vocabulary"** (or note the vocab list building automatically)
5. **Say:** "Every word looked up is added to a personal vocabulary list — state that persists across the session."

---

## Scene 3: Google Classroom — OAuth + Real K-12 Integration (2:10 - 3:10)
**Covers:** Scenario #4 (context retention), #5 (multiple apps), OAuth flow

1. Type: **"Show me my Google Classroom courses"**
2. **Show:** LLM calls `google-classroom__list_courses`, gets AUTH_REQUIRED, tells user to connect
3. **Say:** "This is the OAuth pattern — the platform has to handle user authorization for a real third-party service. Let me connect."
4. **Enter Client ID and Secret** in the side panel, click **Connect Google Classroom**
5. **Show:** OAuth popup opens, user authorizes, popup closes, "Connected as [email]"
6. **Say:** "The popup handles the OAuth redirect — the sandboxed iframe can't do that directly. Token exchange happens through a Supabase Edge Function since Google blocks browser CORS."
7. Type: **"Show me my courses again"**
8. **Show:** Real courses from the user's Google Classroom account appear in the side panel
9. Click on a course to show assignments
10. Type: **"What's due soon in [course name]?"**
11. **Show:** LLM calls `google-classroom__list_assignments` and lists upcoming work with due dates
12. **Say:** "This is the K-12 value proposition at work. The AI can answer 'what's due?' by querying the student's real Google Classroom. No context-switching, no opening Classroom in a new tab. And because of the STATE_UPDATE protocol, the AI remembers which course we were looking at."

---

## Scene 4: Routing & Refusal (3:10 - 3:30)
**Covers:** Scenario #6 (routing accuracy), #7 (refuse unrelated)

1. Type: **"What's 2+2?"**
2. **Show:** LLM answers without calling any plugin
3. **Say:** "The LLM correctly refused to invoke any app for an unrelated query. It only routes to plugins when the user's intent matches a tool description."

---

## Scene 5: Architecture (3:30 - 4:30)
**Switch to:** `docs/architecture-slide.html` in the browser

**Say:**

"Let me walk through the architecture that makes this work.

**One** — Iframe sandboxing. Every app runs without allow-same-origin. The browser enforces isolation. Students can't have their data accessed by a rogue app. External API calls go through a fetch proxy — the app asks the platform, the platform makes the request.

**Two** — A typed postMessage protocol with nine message types. TOOL_INVOKE sends commands. STATE_UPDATE keeps the AI informed. APP_COMPLETE closes the loop. This is the contract — any app that implements it works on the platform.

**Three** — Plugin tools as AI SDK function calls. Each app publishes a manifest declaring tools as JSON Schema. The LLM sees them alongside built-in tools and routes naturally. No custom routing logic — function calling handles it.

Five apps, three patterns — internal, public API, and OAuth — all running through the same protocol. And every interaction has a clear lifecycle: registration, invocation, state updates, and completion. That's what makes this work for K-12 — teachers get visibility, students get interactive learning, and the platform keeps everyone safe."

---

## Recording Tips
- Use browser at **1280x720** for clean resolution
- Clear old chats and localStorage before recording
- Pre-clear `localStorage.removeItem('chatbridge-plugins')` and refresh
- Have a good prompt ready for flashcards (periodic table works well)
- When APP_COMPLETE fires, pause on the "Complete" badge — this is the money shot
- Consider zooming into the side panel header when showing the Active/Complete badges

## Testing Scenario Coverage

| # | Scenario | Where in Demo |
|---|----------|--------------|
| 1 | Tool discovery + invocation | Scene 1: Flashcard deck creation |
| 2 | App UI renders in chat | Scene 1: Flashcard side panel |
| 3 | Completion signaling | Scene 1: Deck finished → Complete badge |
| 4 | Context retention | Scene 1: "How am I doing?" + Scene 3: Chess FEN |
| 5 | Switch between multiple apps | Scene 2: Flashcards → Dictionary → Chess |
| 6 | Routing accuracy | Scene 4: "What's 2+2?" |
| 7 | Refuse unrelated queries | Scene 4: No plugin invoked |
| K-12 | Educational value | Scene 1: Progress tracking, Scene 2: Vocab building, Scene 3: Strategic thinking, Completion signaling throughout |
