import type { PluginManifest } from '@shared/types/plugin'
import type {
  AppToPlatformMessage,
  FetchRequestMessage,
  PlatformToAppMessage,
  ToolResultMessage,
} from '@shared/types/pluginMessages'
import { isChatBridgeMessage } from '@shared/types/pluginMessages'

type PendingInvocation = {
  resolve: (result: ToolResultMessage) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

type StateUpdateHandler = (pluginId: string, stateSummary: unknown, description?: string) => void
type AppCompleteHandler = (pluginId: string, resultSummary: string, data?: unknown) => void
type AppErrorHandler = (pluginId: string, errorMessage: string, errorCode?: string) => void

const DEFAULT_TIMEOUT = 30_000
const MAX_TIMEOUT = 120_000

export class PluginController {
  private iframes = new Map<string, HTMLIFrameElement>()
  private pendingInvocations = new Map<string, PendingInvocation>()
  private readyPlugins = new Set<string>()
  private readyWaiters = new Map<string, Array<() => void>>()
  private seq = 0

  // Event handlers
  onStateUpdate: StateUpdateHandler = () => {}
  onAppComplete: AppCompleteHandler = () => {}
  onAppError: AppErrorHandler = () => {}

  constructor() {
    window.addEventListener('message', this.handleMessage)
  }

  destroy() {
    window.removeEventListener('message', this.handleMessage)
    for (const [, pending] of this.pendingInvocations) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Plugin controller destroyed'))
    }
    this.pendingInvocations.clear()
    this.iframes.clear()
    this.readyPlugins.clear()
  }

  /** Register an iframe element for a plugin */
  mountIframe(pluginId: string, iframe: HTMLIFrameElement) {
    this.iframes.set(pluginId, iframe)
  }

  /** Unregister an iframe element */
  unmountIframe(pluginId: string) {
    this.iframes.delete(pluginId)
    this.readyPlugins.delete(pluginId)
  }

  /** Check if a plugin's iframe is ready */
  isReady(pluginId: string): boolean {
    return this.readyPlugins.has(pluginId)
  }

  /** Wait for a plugin to signal APP_READY */
  waitForReady(pluginId: string, timeoutMs = 10_000): Promise<void> {
    if (this.readyPlugins.has(pluginId)) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.readyWaiters.get(pluginId) || []
        this.readyWaiters.set(
          pluginId,
          waiters.filter((w) => w !== resolve)
        )
        reject(new Error(`Plugin ${pluginId} did not become ready within ${timeoutMs}ms`))
      }, timeoutMs)

      const wrappedResolve = () => {
        clearTimeout(timeout)
        resolve()
      }

      const waiters = this.readyWaiters.get(pluginId) || []
      waiters.push(wrappedResolve)
      this.readyWaiters.set(pluginId, waiters)
    })
  }

  /** Invoke a tool on a plugin and wait for the result */
  async invokeTool(
    pluginId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    manifest: PluginManifest
  ): Promise<ToolResultMessage> {
    const iframe = this.iframes.get(pluginId)
    if (!iframe?.contentWindow) {
      throw new Error(`No iframe mounted for plugin ${pluginId}`)
    }

    // Wait for ready if not already
    if (!this.readyPlugins.has(pluginId)) {
      await this.waitForReady(pluginId)
    }

    const correlationId = crypto.randomUUID()
    const timeout = Math.min(manifest.toolTimeout || DEFAULT_TIMEOUT, MAX_TIMEOUT)

    const message: PlatformToAppMessage = {
      protocol: 'chatbridge',
      type: 'TOOL_INVOKE',
      correlationId,
      timestamp: new Date().toISOString(),
      seq: this.seq++,
      toolName,
      parameters,
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingInvocations.delete(correlationId)
        reject(new Error(`Tool invocation ${toolName} timed out after ${timeout}ms`))
      }, timeout)

      this.pendingInvocations.set(correlationId, { resolve, reject, timeoutId })

      iframe.contentWindow!.postMessage(message, '*')
    })
  }

  /** Send a state restoration message to a plugin */
  restoreState(pluginId: string, lastStateSummary: unknown) {
    const iframe = this.iframes.get(pluginId)
    if (!iframe?.contentWindow) return

    const message: PlatformToAppMessage = {
      protocol: 'chatbridge',
      type: 'RESTORE_STATE',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      seq: this.seq++,
      lastStateSummary,
    }

    iframe.contentWindow.postMessage(message, '*')
  }

  private handleMessage = (event: MessageEvent) => {
    if (!isChatBridgeMessage(event.data)) return

    const msg = event.data as AppToPlatformMessage

    switch (msg.type) {
      case 'APP_READY': {
        this.readyPlugins.add(msg.pluginId)
        const waiters = this.readyWaiters.get(msg.pluginId) || []
        for (const waiter of waiters) waiter()
        this.readyWaiters.delete(msg.pluginId)
        break
      }

      case 'TOOL_RESULT': {
        const pending = this.pendingInvocations.get(msg.correlationId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingInvocations.delete(msg.correlationId)
          pending.resolve(msg)
        }
        break
      }

      case 'STATE_UPDATE': {
        this.onStateUpdate(msg.pluginId, msg.stateSummary, msg.description)
        break
      }

      case 'APP_COMPLETE': {
        this.onAppComplete(msg.pluginId, msg.resultSummary, msg.data)
        break
      }

      case 'APP_ERROR': {
        this.onAppError(msg.pluginId, msg.errorMessage, msg.errorCode)
        break
      }

      case 'FETCH_REQUEST': {
        this.handleFetchProxy(msg as FetchRequestMessage)
        break
      }
    }
  }

  /** Proxy fetch requests from sandboxed iframes */
  private async handleFetchProxy(msg: FetchRequestMessage) {
    // Use the stored iframe reference — event.source is null for sandboxed iframes
    const iframe = this.iframes.get(msg.pluginId)
    if (!iframe?.contentWindow) {
      console.warn(`No iframe for plugin ${msg.pluginId} to send FETCH_RESPONSE`)
      return
    }

    try {
      const response = await fetch(msg.url, {
        method: msg.options?.method || 'GET',
        headers: msg.options?.headers,
        body: msg.options?.body,
      })

      let data: unknown
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      const reply: PlatformToAppMessage = {
        protocol: 'chatbridge',
        type: 'FETCH_RESPONSE',
        correlationId: msg.correlationId,
        timestamp: new Date().toISOString(),
        seq: this.seq++,
        status: response.status,
        ok: response.ok,
        data,
      }
      iframe.contentWindow.postMessage(reply, '*')
    } catch (err) {
      const reply: PlatformToAppMessage = {
        protocol: 'chatbridge',
        type: 'FETCH_RESPONSE',
        correlationId: msg.correlationId,
        timestamp: new Date().toISOString(),
        seq: this.seq++,
        status: 0,
        ok: false,
        data: null,
        errorMessage: err instanceof Error ? err.message : String(err),
      }
      iframe.contentWindow.postMessage(reply, '*')
    }
  }
}

/** Singleton instance */
let controller: PluginController | null = null

export function getPluginController(): PluginController {
  if (!controller) {
    controller = new PluginController()
  }
  return controller
}
