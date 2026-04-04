/**
 * Side panel that displays the active plugin next to the chat.
 * Shows plugin name, status, and completion banner.
 */

import { ActionIcon, Text, Group, Badge } from '@mantine/core'
import { IconX, IconCheck, IconPlugConnected } from '@tabler/icons-react'
import { usePluginStore } from '@/stores/pluginStore'
import { usePluginPanel } from '@/stores/pluginPanelStore'

const PLUGIN_ICONS: Record<string, string> = {
  chess: '♟️',
  weather: '🌤️',
  github: '🐙',
  flashcards: '📚',
  dictionary: '📖',
}

export function PluginSidePanel() {
  const activePluginId = usePluginPanel((s) => s.activePluginId)
  const completionSummary = usePluginPanel((s) => s.completionSummary)
  const close = usePluginPanel((s) => s.close)
  const plugin = usePluginStore((s) => activePluginId ? s.plugins[activePluginId] : null)

  if (!activePluginId || !plugin) return null

  const icon = PLUGIN_ICONS[activePluginId] || '🧩'

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
      {/* Header */}
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        style={{
          borderBottom: '1px solid var(--chatbox-border, #e0e0e0)',
          flexShrink: 0,
        }}
      >
        <Group gap="xs">
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <Text size="sm" fw={600}>{plugin.manifest.name}</Text>
            <Text size="xs" c="dimmed" lineClamp={1}>{plugin.manifest.description?.split('.')[0]}</Text>
          </div>
        </Group>
        <Group gap="xs">
          {completionSummary ? (
            <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
              Complete
            </Badge>
          ) : (
            <Badge color="blue" variant="light" size="sm" leftSection={<IconPlugConnected size={12} />}>
              Active
            </Badge>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={close}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Completion banner */}
      {completionSummary && (
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--mantine-color-green-light, #dcfce7)',
            borderBottom: '1px solid var(--chatbox-border, #e0e0e0)',
            flexShrink: 0,
          }}
        >
          <Text size="xs" fw={600} c="green">
            <IconCheck size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {completionSummary}
          </Text>
        </div>
      )}

      {/* Iframe target */}
      <div id="plugin-panel-target" style={{ flex: 1 }} />
    </div>
  )
}
