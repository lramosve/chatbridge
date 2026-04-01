/**
 * Converts plugin tool schemas into Vercel AI SDK tool() definitions
 * that can be merged into the streamText() tools parameter.
 */

import type { PluginManifest, PluginToolDefinition } from '@shared/types/plugin'
import { tool, type ToolSet } from 'ai'
import z, { type ZodTypeAny } from 'zod'
import { usePluginStore } from '@/stores/pluginStore'
import { getPluginController } from './PluginController'

/**
 * Convert a JSON Schema type string to a Zod schema.
 * Handles the basic types that plugin manifests use.
 */
function jsonSchemaTypeToZod(prop: { type: string; description: string; enum?: string[]; default?: unknown }): ZodTypeAny {
  let schema: ZodTypeAny

  if (prop.enum && prop.enum.length > 0) {
    schema = z.enum(prop.enum as [string, ...string[]])
  } else {
    switch (prop.type) {
      case 'string':
        schema = z.string()
        break
      case 'number':
      case 'integer':
        schema = z.number()
        break
      case 'boolean':
        schema = z.boolean()
        break
      default:
        schema = z.any()
    }
  }

  return schema.describe(prop.description)
}

/**
 * Convert a plugin tool definition's parameter schema to a Zod object schema.
 */
function buildZodSchema(toolDef: PluginToolDefinition): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}
  const required = new Set(toolDef.parameters.required || [])

  for (const [key, prop] of Object.entries(toolDef.parameters.properties)) {
    let field = jsonSchemaTypeToZod(prop)
    if (!required.has(key)) {
      field = field.optional() as ZodTypeAny
    }
    shape[key] = field
  }

  return z.object(shape)
}

/**
 * Create an AI SDK tool for a single plugin tool definition.
 * The execute function sends a postMessage to the plugin iframe
 * and awaits the TOOL_RESULT response.
 */
function createPluginTool(pluginId: string, toolDef: PluginToolDefinition, manifest: PluginManifest) {
  const inputSchema = buildZodSchema(toolDef)

  return tool({
    description: toolDef.description,
    inputSchema,
    execute: async (params: Record<string, unknown>) => {
      const controller = getPluginController()
      const store = usePluginStore.getState()

      try {
        const result = await controller.invokeTool(pluginId, toolDef.name, params, manifest)
        store.recordToolResult('', pluginId, result.status === 'success')

        if (result.status === 'error') {
          return { error: result.errorMessage || 'Tool invocation failed' }
        }
        return result.data
      } catch (err) {
        store.recordToolResult('', pluginId, false)
        return { error: err instanceof Error ? err.message : String(err) }
      }
    },
  })
}

/**
 * Get all plugin tools as an AI SDK ToolSet, ready to merge
 * into the streamText() tools parameter.
 *
 * Tool names are prefixed with the plugin ID to avoid collisions:
 * e.g., "chess__start_game", "weather__get_forecast"
 */
export function getPluginToolSet(): ToolSet {
  const store = usePluginStore.getState()
  const activePlugins = store.getActivePlugins()
  const tools: ToolSet = {}

  for (const plugin of activePlugins) {
    for (const toolDef of plugin.manifest.tools) {
      const toolName = `${plugin.manifest.id}__${toolDef.name}`
      tools[toolName] = createPluginTool(plugin.manifest.id, toolDef, plugin.manifest)
    }
  }

  return tools
}

/**
 * Get a system prompt fragment describing available plugin tools.
 * This helps the LLM understand what plugins are available and when to use them.
 */
export function getPluginToolSetDescription(): string {
  const store = usePluginStore.getState()
  const activePlugins = store.getActivePlugins()

  if (activePlugins.length === 0) return ''

  const descriptions = activePlugins.map((p) => {
    const toolDescs = p.manifest.tools
      .map((t) => `  - ${p.manifest.id}__${t.name}: ${t.description}`)
      .join('\n')
    return `## ${p.manifest.name}\n${p.manifest.description}\n${toolDescs}`
  })

  return `\nAvailable third-party apps:\n${descriptions.join('\n\n')}\n`
}
