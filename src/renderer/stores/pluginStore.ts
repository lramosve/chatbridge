import type {
  PluginManifest,
  PluginSessionState,
  PluginStatus,
  RegisteredPlugin,
} from '@shared/types/plugin'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PluginStoreState {
  /** All registered plugins, keyed by plugin ID */
  plugins: Record<string, RegisteredPlugin>

  /** Per-conversation plugin session state, keyed by `${conversationId}:${pluginId}` */
  sessions: Record<string, PluginSessionState>

  /** Register a new plugin from its manifest */
  registerPlugin: (manifest: PluginManifest, manifestUrl?: string) => void

  /** Unregister a plugin */
  unregisterPlugin: (pluginId: string) => void

  /** Set plugin status */
  setPluginStatus: (pluginId: string, status: PluginStatus) => void

  /** Get all active plugins */
  getActivePlugins: () => RegisteredPlugin[]

  /** Get all tool definitions from active plugins */
  getAllTools: () => Array<{ pluginId: string; tool: PluginManifest['tools'][number] }>

  /** Update session state for a conversation+plugin pair */
  updateSessionState: (
    conversationId: string,
    pluginId: string,
    update: Partial<PluginSessionState>
  ) => void

  /** Get session state */
  getSessionState: (conversationId: string, pluginId: string) => PluginSessionState | undefined

  /** Record a tool invocation success or failure */
  recordToolResult: (conversationId: string, pluginId: string, success: boolean) => void
}

const CIRCUIT_BREAKER_THRESHOLD = 3

export const usePluginStore = create<PluginStoreState>()(
  persist(
    (set, get) => ({
      plugins: {},
      sessions: {},

      registerPlugin: (manifest, manifestUrl) => {
        set((state) => ({
          plugins: {
            ...state.plugins,
            [manifest.id]: {
              manifest,
              status: 'active',
              registeredAt: Date.now(),
              manifestUrl,
            },
          },
        }))
      },

      unregisterPlugin: (pluginId) => {
        set((state) => {
          const { [pluginId]: _, ...rest } = state.plugins
          return { plugins: rest }
        })
      },

      setPluginStatus: (pluginId, status) => {
        set((state) => {
          const plugin = state.plugins[pluginId]
          if (!plugin) return state
          return {
            plugins: {
              ...state.plugins,
              [pluginId]: { ...plugin, status },
            },
          }
        })
      },

      getActivePlugins: () => {
        return Object.values(get().plugins).filter((p) => p.status === 'active')
      },

      getAllTools: () => {
        const active = get().getActivePlugins()
        return active.flatMap((p) =>
          p.manifest.tools.map((tool) => ({ pluginId: p.manifest.id, tool }))
        )
      },

      updateSessionState: (conversationId, pluginId, update) => {
        const key = `${conversationId}:${pluginId}`
        set((state) => {
          const existing = state.sessions[key] || {
            pluginId,
            conversationId,
            lastStateSummary: null,
            toolInvocationCount: 0,
            consecutiveFailures: 0,
            lastActiveAt: Date.now(),
          }
          return {
            sessions: {
              ...state.sessions,
              [key]: { ...existing, ...update, lastActiveAt: Date.now() },
            },
          }
        })
      },

      getSessionState: (conversationId, pluginId) => {
        return get().sessions[`${conversationId}:${pluginId}`]
      },

      recordToolResult: (conversationId, pluginId, success) => {
        const key = `${conversationId}:${pluginId}`
        set((state) => {
          const existing = state.sessions[key] || {
            pluginId,
            conversationId,
            lastStateSummary: null,
            toolInvocationCount: 0,
            consecutiveFailures: 0,
            lastActiveAt: Date.now(),
          }

          const consecutiveFailures = success ? 0 : existing.consecutiveFailures + 1

          // Circuit breaker: mark plugin as degraded after threshold
          if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            const plugin = state.plugins[pluginId]
            if (plugin && plugin.status === 'active') {
              state.plugins = {
                ...state.plugins,
                [pluginId]: { ...plugin, status: 'degraded' },
              }
            }
          }

          return {
            sessions: {
              ...state.sessions,
              [key]: {
                ...existing,
                toolInvocationCount: existing.toolInvocationCount + 1,
                consecutiveFailures,
                lastActiveAt: Date.now(),
              },
            },
          }
        })
      },
    }),
    {
      name: 'chatbridge-plugins',
      partialize: (state) => ({
        plugins: state.plugins,
        // Don't persist sessions — they're ephemeral
      }),
    }
  )
)
