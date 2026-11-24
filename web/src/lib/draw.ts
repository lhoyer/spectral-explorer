/**
 * Canvas renderers, ported from spectrum/spectrum_*_drawing.cpp and the
 * camera / wavelength-config views of the configuration dialog.
 */
import { CFL_ELEMENT_COLORS, CFL_LINES, FRAUNHOFER_LINES, type Peak } from "./lines"
import { valueAt, wavelengthRange, x2w, type SpectrumData } from "./spectrum"

export type GraphMode = "intensity" | "colored" | "rgb"

export interface Series {
  data: SpectrumData
  color: string
  name: string
}

export interface Target {
  wavelength: number
  intensity: number
}

export interface Palette {
  bg: string
  fg: string
  muted: string
  grid: string
  cursor: string
  target: string
}

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback
  return {
    bg: v("--card", "#111"),
    fg: v("--foreground", "#fff"),
    muted: v("--muted-foreground", "#999"),
    grid: v("--border", "#333"),
    cursor: "#f59e0b",
    target: "#ef4444",
  }
}

const FONT = "11px 'Geist Variable', ui-sans-serif, system-ui, sans-serif"

export interface Layout {
  w: number
  h: number
  l: number
  r: number
  t: number
  b: number
  wMin: number
  wMax: number
  iMin: number
  iMax: number
}

export const plotW = (L: Layout) => L.w - L.l - L.r
export const plotH = (L: Layout) => L.h - L.t - L.b
export const wToX = (L: Layout, w: number) => L.l + ((w - L.wMin) / (L.wMax - L.wMin)) * plotW(L)
export const xToW = (L: Layout, x: number) => L.wMin + ((x - L.l) / plotW(L)) * (L.wMax - L.wMin)
export const iToY = (L: Layout, i: number) => L.t + (1 - (i - L.iMin) / (L.iMax - L.iMin)) * plotH(L)
export const yToI = (L: Layout, y: number) => L.iMin + (1 - (y - L.t) / plotH(L)) * (L.iMax - L.iMin)
export const insidePlot = (L: Layout, x: number, y: number) =>
  x >= L.l && x <= L.w - L.r && y >= L.t && y <= L.h - L.b

export function makeLayout(w: number, h: number, ref: SpectrumData | null, iMin = 0, iMax = 1): Layout {
  const [wMin, wMax] = ref ? wavelengthRange(ref) : [380, 700]
  return { w, h, l: 46, r: 54, t: 26, b: 24, wMin, wMax: wMax > wMin ? wMax : wMin + 1, iMin, iMax }
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, bg: string, align: CanvasTextAlign = "center") {
  ctx.font = FONT
  const tw = ctx.measureText(text).width
  const pw = tw + 10
  let px = align === "center" ? x - pw / 2 : align === "left" ? x : x - pw
  const cssWidth = ctx.canvas.width / (ctx.getTransform().a || 1)
  px = Math.max(1, Math.min(cssWidth - pw - 1, px))
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(px, y - 8, pw, 16, 4)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(text, px + 5, y + 0.5)
}

function drawAxes(ctx: CanvasRenderingContext2D, L: Layout, p: Palette) {
  ctx.font = FONT
  ctx.lineWidth = 1
  ctx.strokeStyle = p.grid
  ctx.fillStyle = p.muted
  // intensity grid
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (let i = Math.ceil(L.iMin * 4) / 4; i <= L.iMax + 1e-6; i += 0.25) {
    const y = Math.round(iToY(L, i)) + 0.5
    ctx.beginPath()
    ctx.moveTo(L.l, y)
    ctx.lineTo(L.w - L.r, y)
    ctx.stroke()
    ctx.fillText(`${Math.round(i * 100)}%`, L.l - 8, y)
  }
  // wavelength grid
  const pxPer50 = (50 / (L.wMax - L.wMin)) * plotW(L)
  const step = pxPer50 < 44 ? 100 : pxPer50 > 160 ? 25 : 50
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (let w = Math.ceil(L.wMin / step) * step; w <= L.wMax; w += step) {
    const x = Math.round(wToX(L, w)) + 0.5
    if (x < L.l + 12 || x > L.w - L.r - 12) continue
    ctx.beginPath()
    ctx.moveTo(x, L.t)
    ctx.lineTo(x, L.h - L.b)
    ctx.stroke()
    ctx.fillText(`${w} nm`, x, L.h - L.b + 7)
  }
}

function drawReferenceLines(ctx: CanvasRenderingContext2D, L: Layout, peaks: Peak[], colorOf: (p: Peak) => string, labelOnce: boolean) {
  const seen = new Set<string>()
  ctx.font = FONT
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (const p of peaks) {
    const x = Math.round(wToX(L, p.wavelength)) + 0.5
    if (x < L.l + 4 || x > L.w - L.r - 4) continue
    const color = colorOf(p)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.7
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(x, L.t)
    ctx.lineTo(x, L.h - L.b)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    if (p.label && (!labelOnce || !seen.has(p.label))) {
      seen.add(p.label)
      ctx.fillStyle = color
      ctx.fillText(p.label, x, L.t / 2)
    }
  }
}

function tracePath(ctx: CanvasRenderingContext2D, L: Layout, d: SpectrumData, channel: Float32Array) {
  ctx.beginPath()
  for (let x = 0; x < d.width; x++) {
    const px = wToX(L, x2w(d, x))
    const py = iToY(L, channel[x])
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
}

function vivid(d: SpectrumData, x: number): [number, number, number] {
  const max = Math.max(d.r[x], d.g[x], d.b[x])
  if (max < 0.02) return [0, 0, 0]
  return [(d.r[x] / max) * 255, (d.g[x] / max) * 255, (d.b[x] / max) * 255]
}

export interface GraphOptions {
  mode: GraphMode
  series: Series[]
  palette: Palette
  cfl?: boolean
  fraunhofer?: boolean
  targets?: Target[]
  mouse?: { x: number; y: number } | null
  iMin?: number
  iMax?: number
  /** Fill the background (off when a CSS background shows through). */
  background?: boolean
}

/** Intensity / colored intensity / RGB graph. The first series sets the axis. */
export function drawGraph(ctx: CanvasRenderingContext2D, w: number, h: number, o: GraphOptions): Layout {
  const p = o.palette
  if (o.background !== false) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)
  } else ctx.clearRect(0, 0, w, h)
  const ref = o.series[0]?.data ?? null
  const L = makeLayout(w, h, ref, o.iMin, o.iMax)
  if (plotW(L) < 20 || plotH(L) < 20) return L
  drawAxes(ctx, L, p)
  if (o.cfl) drawReferenceLines(ctx, L, CFL_LINES, (pk) => CFL_ELEMENT_COLORS[pk.label] ?? p.muted, true)
  if (o.fraunhofer) drawReferenceLines(ctx, L, FRAUNHOFER_LINES, () => "#22c55e", false)

  ctx.save()
  ctx.beginPath()
  ctx.rect(L.l, L.t, plotW(L), plotH(L))
  ctx.clip()
  ctx.lineJoin = "round"
  ctx.lineWidth = 1.5

  if (o.mode === "intensity") {
    for (const s of o.series) {
      ctx.strokeStyle = s.color
      tracePath(ctx, L, s.data, s.data.intensity)
      ctx.stroke()
    }
  } else if (o.mode === "colored" && ref) {
    const s = o.series[0]
    const grad = ctx.createLinearGradient(L.l, 0, L.w - L.r, 0)
    const step = Math.max(1, Math.ceil(ref.width / 256))
    for (let x = 0; x < ref.width; x += step) {
      const t = (wToX(L, x2w(ref, x)) - L.l) / plotW(L)
      if (t < 0 || t > 1) continue
      const [r, g, b] = vivid(ref, x)
      grad.addColorStop(t, `rgba(${r | 0},${g | 0},${b | 0},0.6)`)
    }
    tracePath(ctx, L, ref, ref.intensity)
    ctx.lineTo(wToX(L, x2w(ref, ref.width - 1)), iToY(L, 0))
    ctx.lineTo(wToX(L, x2w(ref, 0)), iToY(L, 0))
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = s.color
    tracePath(ctx, L, ref, ref.intensity)
    ctx.stroke()
  } else if (o.mode === "rgb" && ref) {
    const channels: [Float32Array, string][] = [
      [ref.r, "#ef4444"],
      [ref.g, "#22c55e"],
      [ref.b, "#3b82f6"],
    ]
    for (const [ch, color] of channels) {
      ctx.strokeStyle = color
      tracePath(ctx, L, ref, ch)
      ctx.stroke()
    }
  }
  ctx.restore()

  if (o.targets?.length) drawTargets(ctx, L, o.targets, p)
  if (o.mouse && insidePlot(L, o.mouse.x, o.mouse.y)) drawCursor(ctx, L, o, o.mouse)
  return L
}

function drawTargets(ctx: CanvasRenderingContext2D, L: Layout, targets: Target[], p: Palette) {
  const levelsW: number[][] = []
  const levelsI: number[][] = []
  const level = (levels: number[][], v: number, dist: number) => {
    for (let lvl = 0; lvl < 6; lvl++) {
      levels[lvl] ??= []
      if (lvl === 5 || levels[lvl].every((u) => Math.abs(u - v) >= dist)) {
        levels[lvl].push(v)
        return lvl
      }
    }
    return 0
  }
  for (const t of targets) {
    const x = wToX(L, t.wavelength)
    const y = iToY(L, t.intensity)
    if (!insidePlot(L, x, y)) continue
    const lw = level(levelsW, x, 64)
    const li = level(levelsI, y, 18)
    const topY = L.t / 2 + lw * 18
    const rightX = L.w - 2 - li * 50
    ctx.strokeStyle = p.target
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, topY + 8)
    ctx.lineTo(x, L.h - L.b)
    ctx.moveTo(L.l, y)
    ctx.lineTo(rightX - 44, y)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - 8, y)
    ctx.lineTo(x + 8, y)
    ctx.moveTo(x, y - 8)
    ctx.lineTo(x, y + 8)
    ctx.stroke()
    pill(ctx, `${t.wavelength.toFixed(1)} nm`, x, topY, "#fff", p.target)
    pill(ctx, `${(t.intensity * 100).toFixed(1)}%`, rightX, y, "#fff", p.target, "right")
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, L: Layout, o: GraphOptions, m: { x: number; y: number }) {
  const p = o.palette
  ctx.strokeStyle = p.cursor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(Math.round(m.x) + 0.5, L.t)
  ctx.lineTo(Math.round(m.x) + 0.5, L.h - L.b)
  ctx.moveTo(L.l, Math.round(m.y) + 0.5)
  ctx.lineTo(L.w - L.r, Math.round(m.y) + 0.5)
  ctx.stroke()
  const w = xToW(L, m.x)
  if (o.mode === "intensity") {
    for (const s of o.series) {
      const v = valueAt(s.data, s.data.intensity, w)
      if (v == null) continue
      ctx.fillStyle = s.color
      ctx.strokeStyle = p.bg
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(m.x, iToY(L, v), 3.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fill()
    }
  }
  pill(ctx, `${w.toFixed(1)} nm`, m.x, L.t / 2, "#000", p.cursor)
  pill(ctx, `${(yToI(L, m.y) * 100).toFixed(1)}%`, L.w - 2, m.y, "#000", p.cursor, "right")
}

// ---------------------------------------------------------------------------
// Optical (waterfall) view
// ---------------------------------------------------------------------------

export class Waterfall {
  private line = document.createElement("canvas")
  private lctx = this.line.getContext("2d")!
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  private setLine(d: SpectrumData) {
    if (this.line.width !== d.width) this.line.width = d.width
    this.line.height = 1
    const img = this.lctx.createImageData(d.width, 1)
    for (let x = 0; x < d.width; x++) {
      img.data[x * 4] = d.r[x] * 255
      img.data[x * 4 + 1] = d.g[x] * 255
      img.data[x * 4 + 2] = d.b[x] * 255
      img.data[x * 4 + 3] = 255
    }
    this.lctx.putImageData(img, 0, 0)
  }

  /** New measurements enter at the top and scroll downward. */
  push(d: SpectrumData) {
    const { width: W, height: H } = this.canvas
    if (!W || !H) return
    this.setLine(d)
    const ctx = this.canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(this.canvas, 0, 0, W, H - 1, 0, 1, W, H - 1)
    ctx.drawImage(this.line, 0, 0, d.width, 1, 0, 0, W, 1)
  }

  /** Fills the whole view with one spectrum (still images / frozen). */
  fill(d: SpectrumData) {
    const { width: W, height: H } = this.canvas
    if (!W || !H) return
    this.setLine(d)
    const ctx = this.canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(this.line, 0, 0, d.width, 1, 0, 0, W, H)
  }

  clear() {
    const ctx = this.canvas.getContext("2d")!
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

/** Renders a spectrum line stretched to w×h (used for image export). */
export function drawOpticalStrip(ctx: CanvasRenderingContext2D, d: SpectrumData, x: number, y: number, w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = d.width
  c.height = 1
  const wf = new Waterfall(c)
  wf.fill(d)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(c, 0, 0, d.width, 1, x, y, w, h)
}

/** Wavelength ruler aligned with the optical view. */
export function drawRuler(ctx: CanvasRenderingContext2D, w: number, h: number, d: SpectrumData | null, p: Palette) {
  ctx.clearRect(0, 0, w, h)
  if (!d) return
  const [wMin, wMax] = wavelengthRange(d)
  const pxPer50 = (50 / (wMax - wMin)) * w
  const step = pxPer50 < 44 ? 100 : pxPer50 > 160 ? 25 : 50
  ctx.font = FONT
  ctx.fillStyle = p.muted
  ctx.strokeStyle = p.muted
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (let wl = Math.ceil(wMin / step) * step; wl <= wMax; wl += step) {
    const x = Math.round(((wl - d.n) / d.m / d.width) * w) + 0.5
    if (x < 16 || x > w - 16) continue
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 4)
    ctx.stroke()
    ctx.fillText(`${wl}`, x, 5)
  }
}

// ---------------------------------------------------------------------------
// Configuration dialog views
// ---------------------------------------------------------------------------

export interface FitRect {
  x: number
  y: number
  w: number
  h: number
  scale: number
}

export function fitRect(cw: number, ch: number, iw: number, ih: number): FitRect {
  const scale = Math.min(cw / iw, ch / ih)
  const w = iw * scale
  const h = ih * scale
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h, scale }
}

export function drawCameraView(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  frame: HTMLCanvasElement,
  row: number,
  left: number,
  right: number,
): FitRect | null {
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, cw, ch)
  if (!frame.width || !frame.height) return null
  const r = fitRect(cw, ch, frame.width, frame.height)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(frame, r.x, r.y, r.w, r.h)
  // dim the columns that are cropped away
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  ctx.fillRect(r.x, r.y, left * r.scale, r.h)
  ctx.fillRect(r.x + r.w - right * r.scale, r.y, right * r.scale, r.h)
  const y = Math.round(r.y + (row + 0.5) * r.scale) + 0.5
  ctx.strokeStyle = "#facc15"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(r.x, y)
  ctx.lineTo(r.x + r.w, y)
  ctx.stroke()
  pill(ctx, `row ${row}`, r.x + 6, Math.max(r.y + 10, y - 12), "#000", "#facc15", "left")
  return r
}

/** "Wavelength Config View": normalized colored spectrum with the CFL markers. */
export function drawCalibration(ctx: CanvasRenderingContext2D, w: number, h: number, d: SpectrumData | null, active: 1 | 2) {
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, w, h)
  if (!d) return
  const sx = w / d.width
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  const step = Math.max(1, Math.ceil(d.width / 256))
  for (let x = 0; x < d.width; x += step) {
    const [r, g, b] = vivid(d, x)
    grad.addColorStop(Math.min(1, (x * sx) / w), `rgba(${r | 0},${g | 0},${b | 0},0.7)`)
  }
  const top = h * 0.2
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x < d.width; x++) ctx.lineTo((x + 0.5) * sx, h - Math.min(1.25, d.intensity[x]) * (h - top))
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.85)"
  ctx.lineWidth = 1
  ctx.stroke()
  const marks: [number, string, string, 1 | 2][] = [
    [d.cflX1, "#3b82f6", "436.6 nm", 1],
    [d.cflX2, "#ef4444", "611.6 nm", 2],
  ]
  for (const [cx, color, label, idx] of marks) {
    const x = Math.round((cx + 0.5) * sx) + 0.5
    ctx.strokeStyle = color
    ctx.lineWidth = idx === active ? 2 : 1
    ctx.globalAlpha = idx === active ? 1 : 0.6
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
    ctx.globalAlpha = 1
    pill(ctx, label, x, 11, "#fff", color)
  }
}
