# ChatBridge

**An AI Chat Platform with Third-Party App Integration**

ChatBridge is a fork of [Chatbox](https://github.com/chatboxai/chatbox) that adds a plugin system for third-party apps to live inside the chat experience. Students can play chess, check weather, or create GitHub Gists — all without leaving the conversation, with the chatbot staying aware of app state the entire time.

**Live demo:** [chatbridge-delta.vercel.app](https://chatbridge-delta.vercel.app)

## Architecture Overview

```
User
  |
Chat UI (React + Mantine + Zustand)
  |--- Conversation View
  |--- Plugin Side Panel (canvas-style, right of chat)
  |
Plugin Controller <-- postMessage protocol --> Sandboxed Iframes
  |
AI Engine (Vercel AI SDK + function calling)
  |--- Built-in tools (web search, knowledge base)
  |--- MCP tools
  |--- Plugin tools (dynamically registered from manifests)
  |
External Services
  |--- LLM APIs (Claude, GPT-4o, etc.)
  |--- Supabase (auth + edge functions)
  |--- Third-party APIs (Open-Meteo, GitHub, etc.)
```

### Three Key Design Decisions

1. **Iframe sandboxing** — Apps run in `<iframe sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox">` without `allow-same-origin`. The browser enforces isolation; we don't rely on developer trust. External API calls are proxied through the platform via `FETCH_REQUEST`/`FETCH_RESPONSE`.

2. **Typed postMessage protocol** — 9 message types define the universal contract. `TOOL_INVOKE`, `TOOL_RESULT`, `STATE_UPDATE`, `APP_COMPLETE`, `FETCH_REQUEST`/`FETCH_RESPONSE`, etc. Apps that implement the protocol work with the platform automatically.

3. **Plugin tools as AI SDK function calls** — Plugin manifests declare tools as JSON Schema. These are converted to Vercel AI SDK `tool()` definitions and merged alongside built-in tools. The LLM routes user intent to the right app via function calling.

### Plugin Side Panel

Plugin UIs render in a **side panel** to the right of the chat (similar to ChatGPT's canvas). The panel:
- Opens automatically when a plugin tool is invoked
- Persists across page reloads (iframe state restored via `RESTORE_STATE`)
- Switches between plugins when different tools are called
- Closes via the X button

## Quick Start

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Setup

```bash
# Install dependencies
pnpm install

# Create .env with your Supabase credentials (see .env.example)
cp .env.example .env
# Edit .env with your values

# Run web development server
pnpm dev:web

# Run Electron desktop app
pnpm dev
```

### Production Build

```bash
# Build web version
pnpm build:web

# Serve locally
pnpm serve:web

# Build desktop installer
pnpm package
```

### Deploy to Vercel

```bash
vercel deploy --prod
```

The `vercel.json` config handles build commands, output directory, and SPA rewrites. Set these environment variables in the Vercel dashboard:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CHATBOX_BUILD_PLATFORM=web`

## Plugin System

### How Plugins Work

1. A plugin serves a `chatbridge-manifest.json` declaring its tools
2. On startup, the platform fetches manifests and registers tools
3. Plugin iframes are preloaded (hidden) so they're ready before any tool call
4. When the LLM calls a plugin tool, the side panel opens with the app's UI
5. Tool invocations flow via `postMessage` to the sandboxed iframe
6. The app processes the call and returns a result
7. `STATE_UPDATE` messages keep the LLM aware of app state (e.g., chess board FEN)
8. When the user makes a board move, the platform auto-submits a chat message to trigger the LLM's response
9. `RESTORE_STATE` recovers app state (including auth tokens) after page reloads

### Built-in Plugins

| Plugin | Type | Auth | Description |
|--------|------|------|-------------|
| Chess | Internal (stateful) | None | Interactive chess board with LLM as opponent. User moves on the board; LLM responds automatically via `make_move`. |
| Weather | External (public API) | None | Current conditions + 3-day forecast via Open-Meteo. API calls proxied through `FETCH_REQUEST`. |
| GitHub Gists | External (OAuth) | OAuth2 | Search repos (public, no auth) + create Gists (requires OAuth). Token exchange via Supabase Edge Function. |

### Building a Plugin

A minimal plugin needs two files:

**chatbridge-manifest.json**
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What it does (helps LLM routing)",
  "version": "1.0.0",
  "entryUrl": "/plugins/my-plugin/index.html",
  "tools": [
    {
      "name": "my_tool",
      "description": "What this tool does",
      "parameters": {
        "type": "object",
        "properties": {
          "input": { "type": "string", "description": "The input" }
        },
        "required": ["input"]
      }
    }
  ],
  "auth": { "type": "none" }
}
```

**index.html** — Implement the postMessage protocol:
```javascript
// Signal ready
window.parent.postMessage({
  protocol: 'chatbridge', type: 'APP_READY',
  pluginId: 'my-plugin', correlationId: crypto.randomUUID(),
  timestamp: new Date().toISOString(), seq: 0
}, '*');

// Handle tool invocations
window.addEventListener('message', async (event) => {
  const msg = event.data;
  if (msg?.protocol !== 'chatbridge') return;

  if (msg.type === 'TOOL_INVOKE') {
    const result = await handleTool(msg.toolName, msg.parameters);
    window.parent.postMessage({
      protocol: 'chatbridge', type: 'TOOL_RESULT',
      correlationId: msg.correlationId, status: 'success',
      data: result, timestamp: new Date().toISOString(), seq: 1
    }, '*');
  }
});
```

For external API calls, use `FETCH_REQUEST` messages — the platform proxies them since sandboxed iframes can't make cross-origin requests:
```javascript
// Send fetch request to platform
window.parent.postMessage({
  protocol: 'chatbridge', type: 'FETCH_REQUEST',
  pluginId: 'my-plugin', correlationId: 'unique-id',
  url: 'https://api.example.com/data',
  options: { method: 'GET', headers: { 'Accept': 'application/json' } },
  timestamp: new Date().toISOString(), seq: 2
}, '*');

// Listen for FETCH_RESPONSE with matching correlationId
```

### PostMessage Protocol Reference

| Message | Direction | Purpose |
|---------|-----------|---------|
| `TOOL_INVOKE` | Platform → App | Call a tool with parameters |
| `RESTORE_STATE` | Platform → App | Restore state after iframe reload |
| `FETCH_RESPONSE` | Platform → App | Response to a proxied fetch |
| `APP_READY` | App → Platform | Iframe loaded, ready for commands |
| `TOOL_RESULT` | App → Platform | Tool call response |
| `STATE_UPDATE` | App → Platform | Lightweight state for LLM context + persistence |
| `APP_COMPLETE` | App → Platform | Interaction finished |
| `APP_ERROR` | App → Platform | Error reporting |
| `FETCH_REQUEST` | App → Platform | Request a proxied external API call |

### GitHub OAuth Setup

To test the GitHub Gist Creator with real OAuth:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. **Homepage URL:** Your app URL (e.g., `https://chatbridge-delta.vercel.app`)
3. **Callback URL:** `https://chatbridge-delta.vercel.app/plugins/github/callback.html`
   - For local dev, also add: `http://127.0.0.1:1212/plugins/github/callback.html`
4. Copy the **Client ID** and **Client Secret** into the GitHub plugin's side panel
5. Click **Connect GitHub** — the OAuth popup will open for authorization

Token exchange is handled by a Supabase Edge Function (`github-token-exchange`) since GitHub's token endpoint blocks browser CORS.

## Tech Stack

| Layer | Technology | Source |
|-------|-----------|--------|
| Frontend | React 18 + Mantine + Tailwind | Chatbox (existing) |
| State | Zustand + IndexedDB | Chatbox (existing) |
| AI/LLM | Vercel AI SDK + Claude/GPT-4o | Chatbox (existing) |
| Plugin Comms | postMessage protocol | New |
| Plugin UI | Side panel (canvas-style) | New |
| Auth | Supabase Auth | New |
| OAuth Proxy | Supabase Edge Functions | New |
| Deployment | Vercel (web) | New |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `CHATBOX_BUILD_PLATFORM` | Set to `web` for web builds |

## Security Model

- Iframes use `sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"` (no `allow-same-origin`)
- External API calls are proxied through the platform via `FETCH_REQUEST`
- OAuth token exchange happens server-side via Supabase Edge Functions
- Plugin state (including auth tokens) persisted via `STATE_UPDATE` / `RESTORE_STATE`
- Circuit breaker: plugins auto-degrade after 3 consecutive failures
- Plugin registration is admin-approved (no self-service in MVP)

## License

GPLv3 (inherited from Chatbox)
