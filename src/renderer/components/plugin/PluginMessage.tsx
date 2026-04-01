/**
 * Shows a plugin's iframe inline in the chat by moving the preloaded
 * hidden iframe into this component's container and making it visible.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader, Text, Stack } from '@mantine/core'
import { usePluginStore } from '@/stores/pluginStore'
import { getPreloadedIframe } from './PluginPreloader'

// Track which plugins already have a visible iframe in the chat
const visiblePlugins = new Set<string>()

interface PluginMessageProps {
  pluginId: string
  conversationId: string
}

export function PluginMessage({ pluginId, conversationId }: PluginMessageProps) {
  const plugin = usePluginStore((s) => s.plugins[pluginId])
  const containerRef = useRef<HTMLDivElement>(null)
  const [attached, setAttached] = useState(false)
  const claimedRef = useRef(false)

  useEffect(() => {
    // Only the first PluginMessage per plugin claims the iframe
    if (visiblePlugins.has(pluginId)) return
    visiblePlugins.add(pluginId)
    claimedRef.current = true

    const tryAttach = () => {
      const iframe = getPreloadedIframe(pluginId)
      if (iframe && containerRef.current && !containerRef.current.contains(iframe)) {
        iframe.style.display = 'block'
        containerRef.current.appendChild(iframe)
        setAttached(true)
      }
    }

    // The iframe might not be preloaded yet, retry a few times
    tryAttach()
    const interval = setInterval(tryAttach, 500)
    const timeout = setTimeout(() => clearInterval(interval), 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
      if (claimedRef.current) {
        visiblePlugins.delete(pluginId)
        // Move iframe back to body hidden
        const iframe = getPreloadedIframe(pluginId)
        if (iframe) {
          iframe.style.display = 'none'
          document.body.appendChild(iframe)
        }
      }
    }
  }, [pluginId])

  if (!plugin || plugin.status === 'disabled') return null
  if (!claimedRef.current && visiblePlugins.has(pluginId)) return null

  return (
    <div
      ref={containerRef}
      style={{
        margin: '8px 0',
        maxWidth: 500,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--chatbox-border, #e0e0e0)',
        minHeight: attached ? undefined : 100,
      }}
    >
      {!attached && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, background: 'var(--chatbox-background-secondary, #f5f5f5)' }}>
          <Stack align="center" gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading {plugin.manifest.name}...</Text>
          </Stack>
        </div>
      )}
    </div>
  )
}
