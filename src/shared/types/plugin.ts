/**
 * ChatBridge Plugin System Types
 *
 * These types define the contract between the ChatBridge platform
 * and third-party applications.
 */

/** Authentication patterns supported by plugins */
export type PluginAuthType = 'none' | 'api_key' | 'oauth2'

/** Plugin status in the registry */
export type PluginStatus = 'active' | 'disabled' | 'degraded'

/** JSON Schema for tool parameters */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description: string
    enum?: string[]
    default?: unknown
  }>
  required?: string[]
}

/** A single tool that a plugin exposes */
export interface PluginToolDefinition {
  name: string
  description: string
  parameters: ToolParameterSchema
  returnType?: {
    type: string
    description?: string
  }
}

/** The manifest file that every plugin must serve at /chatbridge-manifest.json */
export interface PluginManifest {
  id: string
  name: string
  description: string
  version: string
  icon?: string
  author?: string

  /** URL of the iframe entry point */
  entryUrl: string

  /** Tool definitions the chatbot can discover and invoke */
  tools: PluginToolDefinition[]

  /** Auth requirement for this plugin */
  auth: {
    type: PluginAuthType
    /** OAuth2 config (only when type is 'oauth2') */
    oauth2?: {
      authorizationUrl: string
      tokenUrl: string
      scopes: string[]
    }
  }

  /** Permissions the plugin requests */
  permissions?: string[]

  /** Custom timeout in ms for tool invocations (default: 30000, max: 120000) */
  toolTimeout?: number
}

/** A registered plugin in the platform */
export interface RegisteredPlugin {
  manifest: PluginManifest
  status: PluginStatus
  registeredAt: number
  /** Cached manifest URL */
  manifestUrl?: string
}

/** Per-conversation plugin session state */
export interface PluginSessionState {
  pluginId: string
  conversationId: string
  /** Lightweight state summary from the app (last STATE_UPDATE) */
  lastStateSummary: unknown
  /** Number of tool invocations in this session */
  toolInvocationCount: number
  /** Consecutive failure count (for circuit breaker) */
  consecutiveFailures: number
  lastActiveAt: number
}
