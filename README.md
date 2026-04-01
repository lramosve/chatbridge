# ChatBridge

**An AI Chat Platform with Third-Party App Integration**

ChatBridge is a fork of [Chatbox](https://github.com/chatboxai/chatbox) that adds a plugin system for third-party apps to live inside the chat experience. Students can play chess, check weather, or create Spotify playlists — all without leaving the conversation, with the chatbot staying aware of app state the entire time.

## Architecture Overview

```
User
  |
Chat UI (React + Mantine + Zustand)
  |--- Conversation View
  |--- Plugin Viewport (sandboxed iframes)
  |
Plugin Controller <-- postMessage protocol --> Third-Party Apps
  |
AI Engine (Vercel AI SDK + function calling)
  |--- Built-in tools (web search, knowledge base)
  |--- MCP tools
  |--- Plugin tools (dynamically registered)
  |
External Services
  |--- LLM APIs (Claude, GPT-4o, etc.)
  |--- Supabase (auth + database)
  |--- Third-party APIs (Open-Meteo, Spotify, etc.)
```

### Three Key Design Decisions

1. **Iframe sandboxing** — Apps run in `<iframe sandbox="allow-scripts allow-forms allow-popups">` without `allow-same-origin`. The browser enforces isolation; we don't rely on developer trust.

2. **Typed postMessage protocol** — 9 message types define the universal contract. `TOOL_INVOKE`, `TOOL_RESULT`, `STATE_UPDATE`, `APP_COMPLETE`, `FETCH_REQUEST`/`FETCH_RESPONSE`, etc. Apps that implement the protocol work with the platform automatically.

3. **Plugin tools as AI SDK function calls** — Plugin manifests declare tools as JSON Schema. These are converted to Vercel AI SDK `tool()` definitions and merged alongside built-in tools. The LLM routes user intent to the right app via function calling.

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

## Plugin System

### How Plugins Work

1. A plugin serves a `chatbridge-manifest.json` declaring its tools
2. On startup, the platform fetches manifests and registers tools
3. When a user sends a message, the LLM sees all available tools
4. If the LLM calls a plugin tool, the platform loads the app's iframe
5. Tool invocations flow via `postMessage` to the sandboxed iframe
6. The app processes the call and returns a result
7. State updates keep the LLM aware of what's happening in the app

### Built-in Plugins

| Plugin | Type | Auth | Description |
|--------|------|------|-------------|
| Chess | Internal (stateful) | None | Interactive chess with LLM move analysis |
| Weather | External (public API) | None | Current conditions + 3-day forecast via Open-Meteo |
| Spotify | External (OAuth) | OAuth2 | Track search + playlist creation |

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

For external API calls, use `FETCH_REQUEST` messages — the platform proxies them since sandboxed iframes can't make cross-origin requests.

### PostMessage Protocol Reference

| Message | Direction | Purpose |
|---------|-----------|---------|
| `TOOL_INVOKE` | Platform -> App | Call a tool with parameters |
| `RESTORE_STATE` | Platform -> App | Restore state after iframe reload |
| `FETCH_RESPONSE` | Platform -> App | Response to a proxied fetch |
| `APP_READY` | App -> Platform | Iframe loaded, ready for commands |
| `TOOL_RESULT` | App -> Platform | Tool call response |
| `STATE_UPDATE` | App -> Platform | Lightweight state for LLM context |
| `APP_COMPLETE` | App -> Platform | Interaction finished |
| `APP_ERROR` | App -> Platform | Error reporting |
| `FETCH_REQUEST` | App -> Platform | Request a proxied fetch |

## Tech Stack

| Layer | Technology | Source |
|-------|-----------|--------|
| Frontend | React 18 + Mantine + Tailwind | Chatbox (existing) |
| State | Zustand + IndexedDB | Chatbox (existing) |
| AI/LLM | Vercel AI SDK + Claude/GPT-4o | Chatbox (existing) |
| Plugin Comms | postMessage protocol | New |
| Auth | Supabase Auth | New |
| Database | Supabase PostgreSQL | New |
| Deployment | Vercel (web) | New |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `CHATBOX_BUILD_PLATFORM` | Set to `web` for web builds |

## Security Model

- Iframes use `sandbox="allow-scripts allow-forms allow-popups"` (no `allow-same-origin`)
- External API calls are proxied through the platform via `FETCH_REQUEST`
- Origin validation on all postMessage communication
- Plugin registration is admin-approved (no self-service in MVP)
- Student PII is never forwarded to third-party apps
- Circuit breaker: plugins auto-degrade after 3 consecutive failures

## License

GPLv3 (inherited from Chatbox)
