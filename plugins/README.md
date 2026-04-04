# Built-in Plugins

ChatBridge ships with 5 plugins demonstrating different integration patterns.

| Plugin | Type | Auth | Lifecycle Messages Used | Educational Value |
|--------|------|------|------------------------|-------------------|
| **Chess** | Internal | None | TOOL_INVOKE, TOOL_RESULT, STATE_UPDATE (FEN), APP_COMPLETE (checkmate/resign) | Strategic thinking, problem-solving |
| **Flashcards** | Internal | None | TOOL_INVOKE, TOOL_RESULT, STATE_UPDATE (progress), APP_COMPLETE (deck finished) | Spaced repetition, any subject |
| **Dictionary** | External (Public API) | None | TOOL_INVOKE, TOOL_RESULT, FETCH_REQUEST/RESPONSE, STATE_UPDATE (vocab list) | Vocabulary building, pronunciation |
| **Weather** | External (Public API) | None | TOOL_INVOKE, TOOL_RESULT, FETCH_REQUEST/RESPONSE, STATE_UPDATE | Geography, climate awareness |
| **GitHub Gists** | External (OAuth) | OAuth2 | TOOL_INVOKE, TOOL_RESULT, FETCH_REQUEST/RESPONSE, APP_COMPLETE (gist created) | CS education, code notebooks |

## Three Integration Patterns

### Internal (no auth, no external API)
**Chess, Flashcards** — All logic runs inside the iframe. No network requests needed. State managed via JavaScript variables, persisted through STATE_UPDATE/RESTORE_STATE.

### External (Public API)
**Dictionary, Weather** — Uses external APIs (dictionaryapi.dev, Open-Meteo) via the FETCH_REQUEST proxy. No user authentication required. The platform proxies fetch requests because sandboxed iframes cannot make cross-origin requests.

### External (OAuth)
**GitHub Gists** — Requires user authorization via OAuth popup flow. Token exchange proxied through a Supabase Edge Function (GitHub blocks browser CORS). Auth state persisted via STATE_UPDATE/RESTORE_STATE so users stay connected across reloads.

## Plugin Structure

Each plugin is a directory under `plugins/` containing:

```
plugins/
  chess/
    chatbridge-manifest.json   # Tool definitions + metadata
    index.html                 # Self-contained app (HTML + JS + CSS)
  dictionary/
    chatbridge-manifest.json
    index.html
  flashcards/
    chatbridge-manifest.json
    index.html
  github/
    chatbridge-manifest.json
    index.html
    callback.html              # OAuth redirect handler
  weather/
    chatbridge-manifest.json
    index.html
```

See [PLUGIN_LIFECYCLE.md](../docs/PLUGIN_LIFECYCLE.md) for the full lifecycle walkthrough.
