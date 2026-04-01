/**
 * Bootstrap built-in plugins on startup.
 * Loads manifests from /plugins/<id>/chatbridge-manifest.json
 * and registers them in the plugin store.
 */

import type { PluginManifest } from '@shared/types/plugin'
import { usePluginStore } from '@/stores/pluginStore'

const BUILT_IN_PLUGINS = ['chess', 'weather']

export async function bootstrapPlugins() {
  const store = usePluginStore.getState()

  for (const pluginId of BUILT_IN_PLUGINS) {
    // Skip if already registered
    if (store.plugins[pluginId]) continue

    try {
      const manifestUrl = `/plugins/${pluginId}/chatbridge-manifest.json`
      const response = await fetch(manifestUrl)
      if (!response.ok) {
        console.warn(`Failed to load manifest for plugin "${pluginId}": ${response.status}`)
        continue
      }
      const manifest: PluginManifest = await response.json()
      store.registerPlugin(manifest, manifestUrl)
      console.log(`Registered plugin: ${manifest.name} (${manifest.id})`)
    } catch (err) {
      console.warn(`Failed to bootstrap plugin "${pluginId}":`, err)
    }
  }
}
