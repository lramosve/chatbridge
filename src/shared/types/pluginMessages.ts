/**
 * ChatBridge PostMessage Protocol
 *
 * Defines the typed message format for communication between
 * the ChatBridge platform and third-party app iframes.
 */

/** Base fields present on every message */
interface BaseMessage {
  /** Protocol identifier — always 'chatbridge' */
  protocol: 'chatbridge'
  /** Correlation ID for request-response matching */
  correlationId: string
  /** ISO timestamp */
  timestamp: string
  /** Monotonic sequence number for debugging */
  seq: number
}

// ── Platform → App Messages ──

export interface ToolInvokeMessage extends BaseMessage {
  type: 'TOOL_INVOKE'
  toolName: string
  parameters: Record<string, unknown>
}

export interface RestoreStateMessage extends BaseMessage {
  type: 'RESTORE_STATE'
  lastStateSummary: unknown
}

export type PlatformToAppMessage = ToolInvokeMessage | RestoreStateMessage

// ── App → Platform Messages ──

export interface AppReadyMessage extends BaseMessage {
  type: 'APP_READY'
  pluginId: string
}

export interface ToolResultMessage extends BaseMessage {
  type: 'TOOL_RESULT'
  status: 'success' | 'error'
  data: unknown
  errorMessage?: string
}

export interface StateUpdateMessage extends BaseMessage {
  type: 'STATE_UPDATE'
  pluginId: string
  /** Lightweight state summary for LLM context injection */
  stateSummary: unknown
  /** Optional human-readable description for the chat */
  description?: string
}

export interface AppCompleteMessage extends BaseMessage {
  type: 'APP_COMPLETE'
  pluginId: string
  /** Summary of what happened (stored in conversation history) */
  resultSummary: string
  data?: unknown
}

export interface AppErrorMessage extends BaseMessage {
  type: 'APP_ERROR'
  pluginId: string
  errorMessage: string
  errorCode?: string
}

export type AppToPlatformMessage =
  | AppReadyMessage
  | ToolResultMessage
  | StateUpdateMessage
  | AppCompleteMessage
  | AppErrorMessage

export type PluginMessage = PlatformToAppMessage | AppToPlatformMessage

/** Type guard for ChatBridge protocol messages */
export function isChatBridgeMessage(data: unknown): data is PluginMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'protocol' in data &&
    (data as { protocol: unknown }).protocol === 'chatbridge' &&
    'type' in data &&
    'correlationId' in data
  )
}
