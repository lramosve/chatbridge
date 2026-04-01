/**
 * Renders a plugin iframe inline in the chat message list.
 * Deduplicates: only the first instance per plugin renders the iframe.
 * Subsequent tool calls for the same plugin show nothing (the iframe
 * from the first call is already active and handling messages).
 */

import { useEffect, useRef } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import { getPluginController } from '@/packages/plugin-controller/PluginController'
import { PluginIframe } from './PluginIframe'

// Track which plugins currently have a mounted iframe
const mountedPlugins = new Set<string>()

interface PluginMessageProps {
  pluginId: string
  conversationId: string
}

export function PluginMessage({ pluginId, conversationId }: PluginMessageProps) {
  const plugin = usePluginStore((s) => s.plugins[pluginId])
  const shouldRender = useRef(false)
  const controller = getPluginController()

  // Claim this slot on first mount if no other iframe is active for this plugin
  useEffect(() => {
    if (!mountedPlugins.has(pluginId) && !controller.isReady(pluginId)) {
      mountedPlugins.add(pluginId)
      shouldRender.current = true
    } else if (mountedPlugins.has(pluginId) && shouldRender.current) {
      // This instance already claimed the slot
    } else {
      shouldRender.current = false
    }

    return () => {
      if (shouldRender.current) {
        mountedPlugins.delete(pluginId)
      }
    }
  }, [pluginId, controller])

  if (!plugin || plugin.status === 'disabled') return null
  if (!shouldRender.current && controller.isReady(pluginId)) return null

  return (
    <div style={{ margin: '8px 0', maxWidth: 500 }}>
      <PluginIframe
        manifest={plugin.manifest}
        conversationId={conversationId}
        height={420}
      />
    </div>
  )
}
