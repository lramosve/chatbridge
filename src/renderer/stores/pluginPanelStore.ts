import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PluginPanelState {
  activePluginId: string | null
  open: (pluginId: string) => void
  close: () => void
  toggle: (pluginId: string) => void
}

export const usePluginPanel = create<PluginPanelState>()(
  persist(
    (set, get) => ({
      activePluginId: null,
      open: (pluginId) => set({ activePluginId: pluginId }),
      close: () => set({ activePluginId: null }),
      toggle: (pluginId) => {
        set({ activePluginId: get().activePluginId === pluginId ? null : pluginId })
      },
    }),
    { name: 'chatbridge-plugin-panel' }
  )
)
