/**
 * ChatBridge Plugin SDK
 *
 * Drop this into a third-party app to handle the postMessage protocol.
 *
 * Usage:
 *   const bridge = new ChatBridgePlugin('my-plugin-id')
 *   bridge.onToolInvoke('start_game', async (params) => {
 *     // handle tool call
 *     return { board: '...' }
 *   })
 *   bridge.sendReady()
 */

interface BaseMessage {
  protocol: 'chatbridge'
  correlationId: string
  timestamp: string
  seq: number
}

interface ToolInvokeMessage extends BaseMessage {
  type: 'TOOL_INVOKE'
  toolName: string
  parameters: Record<string, unknown>
}

interface RestoreStateMessage extends BaseMessage {
  type: 'RESTORE_STATE'
  lastStateSummary: unknown
}

interface FetchResponseMessage extends BaseMessage {
  type: 'FETCH_RESPONSE'
  status: number
  ok: boolean
  data: unknown
  errorMessage?: string
}

type PlatformMessage = ToolInvokeMessage | RestoreStateMessage | FetchResponseMessage

type ToolHandler = (parameters: Record<string, unknown>) => Promise<unknown> | unknown
type FetchPending = { resolve: (value: { status: number; ok: boolean; data: unknown }) => void; reject: (err: Error) => void }

export class ChatBridgePlugin {
  private seq = 0
  private toolHandlers = new Map<string, ToolHandler>()
  private restoreHandler: ((state: unknown) => void) | null = null
  private fetchPending = new Map<string, FetchPending>()

  constructor(public readonly pluginId: string) {
    window.addEventListener('message', this.handleMessage)
  }

  /** Register a tool invocation handler */
  onToolInvoke(toolName: string, handler: ToolHandler) {
    this.toolHandlers.set(toolName, handler)
  }

  /** Register a state restoration handler */
  onRestoreState(handler: (state: unknown) => void) {
    this.restoreHandler = handler
  }

  /** Signal to the platform that this app is ready */
  sendReady() {
    this.send({
      type: 'APP_READY',
      pluginId: this.pluginId,
    })
  }

  /** Send a state update to the platform (for LLM context) */
  sendStateUpdate(stateSummary: unknown, description?: string) {
    this.send({
      type: 'STATE_UPDATE',
      pluginId: this.pluginId,
      stateSummary,
      description,
    })
  }

  /** Signal that the interaction is complete */
  sendComplete(resultSummary: string, data?: unknown) {
    this.send({
      type: 'APP_COMPLETE',
      pluginId: this.pluginId,
      resultSummary,
      data,
    })
  }

  /** Report an error to the platform */
  sendError(errorMessage: string, errorCode?: string) {
    this.send({
      type: 'APP_ERROR',
      pluginId: this.pluginId,
      errorMessage,
      errorCode,
    })
  }

  /**
   * Fetch a URL via the platform's fetch proxy.
   * Use this instead of direct fetch() since sandboxed iframes
   * without allow-same-origin cannot make cross-origin requests.
   */
  async fetch(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; ok: boolean; data: unknown }> {
    const correlationId = crypto.randomUUID()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.fetchPending.delete(correlationId)
        reject(new Error(`Fetch proxy timeout for ${url}`))
      }, 30_000)

      this.fetchPending.set(correlationId, {
        resolve: (value) => { clearTimeout(timeout); resolve(value) },
        reject: (err) => { clearTimeout(timeout); reject(err) },
      })

      this.send({
        type: 'FETCH_REQUEST',
        pluginId: this.pluginId,
        correlationId,
        url,
        options,
      })
    })
  }

  /** Clean up event listener */
  destroy() {
    window.removeEventListener('message', this.handleMessage)
  }

  private send(payload: Record<string, unknown>) {
    const message = {
      protocol: 'chatbridge',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      seq: this.seq++,
      ...payload,
    }
    window.parent.postMessage(message, '*')
  }

  private handleMessage = async (event: MessageEvent) => {
    const data = event.data
    if (!data || data.protocol !== 'chatbridge') return

    const msg = data as PlatformMessage

    if (msg.type === 'TOOL_INVOKE') {
      const handler = this.toolHandlers.get(msg.toolName)
      if (!handler) {
        this.send({
          type: 'TOOL_RESULT',
          correlationId: msg.correlationId,
          status: 'error',
          data: null,
          errorMessage: `Unknown tool: ${msg.toolName}`,
        })
        return
      }

      try {
        const result = await handler(msg.parameters)
        this.send({
          type: 'TOOL_RESULT',
          correlationId: msg.correlationId,
          status: 'success',
          data: result,
        })
      } catch (err) {
        this.send({
          type: 'TOOL_RESULT',
          correlationId: msg.correlationId,
          status: 'error',
          data: null,
          errorMessage: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (msg.type === 'RESTORE_STATE' && this.restoreHandler) {
      this.restoreHandler(msg.lastStateSummary)
    }

    if (msg.type === 'FETCH_RESPONSE') {
      const pending = this.fetchPending.get(msg.correlationId)
      if (pending) {
        this.fetchPending.delete(msg.correlationId)
        if (msg.errorMessage) {
          pending.reject(new Error(msg.errorMessage))
        } else {
          pending.resolve({ status: msg.status, ok: msg.ok, data: msg.data })
        }
      }
    }
  }
}
