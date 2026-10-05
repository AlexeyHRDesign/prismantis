export type ChartColors = { bg: string; fg: string; line?: string; accent?: string; muted?: string; surface?: string; border?: string }
export type XYChart = { readonly __brand: 'XYChart' }
export type PositionedXYChart = { readonly width: number; readonly height: number }
export function parseXYChart(lines: string[]): XYChart
export function layoutXYChart(chart: XYChart, options?: Record<string, unknown>): PositionedXYChart
export function renderXYChartSvg(chart: PositionedXYChart, colors: ChartColors, font?: string, transparent?: boolean, interactive?: boolean): string
