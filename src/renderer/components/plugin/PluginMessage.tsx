/**
 * Renders a plugin iframe inline in the chat message list.
 * This component is shown when a tool call targets a registered plugin.
 */

import { usePluginStore } from '@/stores/pluginStore'
import { PluginIframe } from './PluginIframe'

interface PluginMessageProps {
  pluginId: string
  conversationId: string
}

export function PluginMessage({ pluginId, conversationId }: PluginMessageProps) {
  const plugin = usePluginStore((s) => s.plugins[pluginId])

  if (!plugin || plugin.status === 'disabled') return null

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
