import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PluginPanelState {
  activePluginId: string | null
  /** Set when APP_COMPLETE fires for the active plugin */
  completionSummary: string | null
  open: (pluginId: string) => void
  close: () => void
  toggle: (pluginId: string) => void
  setCompletion: (summary: string) => void
  clearCompletion: () => void
}

export const usePluginPanel = create<PluginPanelState>()(
  persist(
    (set, get) => ({
      activePluginId: null,
      completionSummary: null,
      open: (pluginId) => set({ activePluginId: pluginId, completionSummary: null }),
      close: () => set({ activePluginId: null, completionSummary: null }),
      toggle: (pluginId) => {
        set({ activePluginId: get().activePluginId === pluginId ? null : pluginId, completionSummary: null })
      },
      setCompletion: (summary) => set({ completionSummary: summary }),
      clearCompletion: () => set({ completionSummary: null }),
    }),
    { name: 'chatbridge-plugin-panel' }
  )
)
