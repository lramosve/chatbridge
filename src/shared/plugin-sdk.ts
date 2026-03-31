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

type PlatformMessage = ToolInvokeMessage | RestoreStateMessage

type ToolHandler = (parameters: Record<string, unknown>) => Promise<unknown> | unknown

export class ChatBridgePlugin {
  private seq = 0
  private toolHandlers = new Map<string, ToolHandler>()
  private restoreHandler: ((state: unknown) => void) | null = null

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
  }
}
