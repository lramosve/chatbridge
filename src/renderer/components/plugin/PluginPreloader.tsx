/**
 * Pre-mounts iframes for all active plugins in a hidden container.
 * Iframes NEVER move in the DOM (moving reloads them and loses state).
 * The side panel positions them visually using CSS.
 */

import { useEffect, useMemo } from 'react'
import { getPluginController } from '@/packages/plugin-controller/PluginController'
import { usePluginStore } from '@/stores/pluginStore'
import { usePluginPanel } from '@/stores/pluginPanelStore'

/** Find the last state summary for a plugin across all sessions */
function getLastState(pluginId: string): unknown {
  const sessions = usePluginStore.getState().sessions
  for (const key of Object.keys(sessions)) {
    if (key.endsWith(`:${pluginId}`) && sessions[key].lastStateSummary) {
      return sessions[key].lastStateSummary
    }
  }
  return null
}

// Global reference to the container div
let containerEl: HTMLDivElement | null = null
const iframeMap = new Map<string, HTMLIFrameElement>()

export function getPreloadedIframe(pluginId: string): HTMLIFrameElement | undefined {
  return iframeMap.get(pluginId)
}

export function getPreloaderContainer(): HTMLDivElement | null {
  return containerEl
}

export function PluginPreloader() {
  const plugins = usePluginStore((s) => s.plugins)
  const activePluginId = usePluginPanel((s) => s.activePluginId)
  const controller = getPluginController()

  const activeIds = useMemo(
    () => Object.entries(plugins).filter(([, p]) => p.status === 'active').map(([id]) => id),
    [plugins]
  )

  // Wire up state update handler so STATE_UPDATE messages get persisted
  useEffect(() => {
    const pluginStore = usePluginStore.getState()
    controller.onStateUpdate = (pluginId, stateSummary, _description) => {
      pluginStore.updateSessionState('active', pluginId, { lastStateSummary: stateSummary })
    }
  }, [controller])

  // Create the persistent container once
  useEffect(() => {
    if (!containerEl) {
      containerEl = document.createElement('div')
      containerEl.id = 'plugin-iframe-container'
      containerEl.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;'
      document.body.appendChild(containerEl)
    }
  }, [])

  // Create iframes for active plugins (no cleanup — iframes persist across hot reloads)
  useEffect(() => {
    if (!containerEl) return

    for (const id of activeIds) {
      if (iframeMap.has(id)) continue

      const manifest = plugins[id]?.manifest
      if (!manifest) continue

      const iframe = document.createElement('iframe')
      iframe.src = manifest.entryUrl
      iframe.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox')
      iframe.style.cssText = 'border:none;background:#fff;'
      iframe.title = manifest.name
      containerEl.appendChild(iframe)

      iframe.onload = () => {
        controller.mountIframe(id, iframe)
        controller.waitForReady(id, 5000).then(() => {
          const lastState = getLastState(id)
          if (lastState) {
            controller.restoreState(id, lastState)
          }
        }).catch(() => {})
      }

      iframeMap.set(id, iframe)
    }
    // No cleanup — iframes are global singletons managed by iframeMap
  }, [activeIds, plugins, controller])

  // Position the active iframe over the side panel target area
  useEffect(() => {
    if (!containerEl) return

    const position = () => {
      if (!containerEl) return
      for (const [id, iframe] of iframeMap) {
        if (id === activePluginId) {
          const target = document.getElementById('plugin-panel-target')
          if (target) {
            const rect = target.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              containerEl.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;overflow:hidden;pointer-events:auto;z-index:10;`
              iframe.style.width = '100%'
              iframe.style.height = '100%'
              iframe.style.display = 'block'
              return
            }
          }
          // Target not ready yet, retry
          requestAnimationFrame(position)
        } else {
          iframe.style.display = 'none'
        }
      }

      if (!activePluginId) {
        containerEl.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;'
      }
    }

    // Wait for React to render the side panel target div
    requestAnimationFrame(position)
  }, [activePluginId])

  // Reposition on window resize
  useEffect(() => {
    if (!activePluginId) return

    const reposition = () => {
      const target = document.getElementById('plugin-panel-target')
      if (target && containerEl) {
        const rect = target.getBoundingClientRect()
        containerEl.style.top = `${rect.top}px`
        containerEl.style.left = `${rect.left}px`
        containerEl.style.width = `${rect.width}px`
        containerEl.style.height = `${rect.height}px`
      }
    }

    window.addEventListener('resize', reposition)
    // Also reposition after a short delay to catch layout shifts
    const tid = setTimeout(reposition, 100)
    return () => {
      window.removeEventListener('resize', reposition)
      clearTimeout(tid)
    }
  }, [activePluginId])

  return null
}
