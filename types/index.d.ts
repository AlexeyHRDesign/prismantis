export type DiagramView = { source: string; zoom: number }

declare module 'claude-code' {
  interface PluginState {
    prismantis: { view: DiagramView | null }
  }
}
