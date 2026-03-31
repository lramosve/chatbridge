import type { PluginManifest } from '@shared/types/plugin'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Loader, Text, Button, Stack } from '@mantine/core'
import { getPluginController } from '@/packages/plugin-controller/PluginController'
import { usePluginStore } from '@/stores/pluginStore'

interface PluginIframeProps {
  manifest: PluginManifest
  conversationId: string
  height?: number
}

export function PluginIframe({ manifest, conversationId, height = 400 }: PluginIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const controller = getPluginController()
  const { getSessionState, updateSessionState } = usePluginStore()

  const handleLoad = useCallback(() => {
    if (iframeRef.current) {
      controller.mountIframe(manifest.id, iframeRef.current)

      controller
        .waitForReady(manifest.id, 10_000)
        .then(() => {
          setStatus('ready')
          // Restore state if we have any
          const session = getSessionState(conversationId, manifest.id)
          if (session?.lastStateSummary) {
            controller.restoreState(manifest.id, session.lastStateSummary)
          }
        })
        .catch(() => {
          setStatus('error')
          setErrorMsg(`${manifest.name} failed to initialize within 10 seconds.`)
        })
    }
  }, [manifest.id, manifest.name, conversationId, controller, getSessionState])

  useEffect(() => {
    // Wire up event handlers
    const prevStateUpdate = controller.onStateUpdate
    const prevComplete = controller.onAppComplete
    const prevError = controller.onAppError

    controller.onStateUpdate = (pluginId, stateSummary, description) => {
      if (pluginId === manifest.id) {
        updateSessionState(conversationId, pluginId, {
          lastStateSummary: stateSummary,
        })
      }
      prevStateUpdate(pluginId, stateSummary, description)
    }

    controller.onAppComplete = (pluginId, resultSummary, data) => {
      prevComplete(pluginId, resultSummary, data)
    }

    controller.onAppError = (pluginId, errorMessage, errorCode) => {
      if (pluginId === manifest.id) {
        setStatus('error')
        setErrorMsg(errorMessage)
      }
      prevError(pluginId, errorMessage, errorCode)
    }

    return () => {
      controller.onStateUpdate = prevStateUpdate
      controller.onAppComplete = prevComplete
      controller.onAppError = prevError
      controller.unmountIframe(manifest.id)
    }
  }, [manifest.id, conversationId, controller, updateSessionState])

  const handleRetry = () => {
    setStatus('loading')
    setErrorMsg(null)
    if (iframeRef.current) {
      iframeRef.current.src = manifest.entryUrl
    }
  }

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--chatbox-border, #e0e0e0)',
        position: 'relative',
      }}
    >
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--chatbox-background-secondary, #f5f5f5)',
            zIndex: 1,
          }}
        >
          <Stack align="center" gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading {manifest.name}...
            </Text>
          </Stack>
        </div>
      )}

      {status === 'error' && (
        <Alert color="red" variant="light" style={{ margin: 8 }}>
          <Stack gap="xs">
            <Text size="sm">{errorMsg || `${manifest.name} encountered an error.`}</Text>
            <Button size="xs" variant="light" onClick={handleRetry}>
              Retry
            </Button>
          </Stack>
        </Alert>
      )}

      <iframe
        ref={iframeRef}
        src={manifest.entryUrl}
        sandbox="allow-scripts allow-forms allow-popups"
        onLoad={handleLoad}
        style={{
          width: '100%',
          height,
          border: 'none',
          display: status === 'error' ? 'none' : 'block',
        }}
        title={manifest.name}
      />
    </div>
  )
}
