/**
 * Side panel that displays the active plugin next to the chat.
 * The actual iframe is positioned over this panel via CSS (never moved in DOM).
 * This component just provides the layout target and header.
 */

import { ActionIcon, Text, Group } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { usePluginStore } from '@/stores/pluginStore'
import { usePluginPanel } from '@/stores/pluginPanelStore'

export function PluginSidePanel() {
  const activePluginId = usePluginPanel((s) => s.activePluginId)
  const close = usePluginPanel((s) => s.close)
  const plugin = usePluginStore((s) => activePluginId ? s.plugins[activePluginId] : null)

  if (!activePluginId || !plugin) return null

  return (
    <div
      style={{
        width: '45%',
        minWidth: 360,
        maxWidth: 600,
        height: '100%',
        borderLeft: '1px solid var(--chatbox-border, #e0e0e0)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--chatbox-background-primary, #fff)',
        flexShrink: 0,
      }}
    >
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        style={{
          borderBottom: '1px solid var(--chatbox-border, #e0e0e0)',
          flexShrink: 0,
        }}
      >
        <Text size="sm" fw={600}>{plugin.manifest.name}</Text>
        <ActionIcon variant="subtle" size="sm" onClick={close}>
          <IconX size={16} />
        </ActionIcon>
      </Group>
      {/* The preloader positions the iframe over this div */}
      <div id="plugin-panel-target" style={{ flex: 1 }} />
    </div>
  )
}
