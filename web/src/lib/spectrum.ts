/**
 * Core spectrum math, ported from spectrum/spectrum_data.cpp.
 *
 * A spectrum is one (averaged) camera row, cropped by the left/right offsets.
 * Each column becomes a point with normalized r/g/b (0..1) and an intensity
 * (the mean of r, g and b). Wavelengths come from a linear calibration through
 * two known CFL lines: 436.6 nm (Hg) and 611.6 nm (Eu3+).
 */
import type { SpectrumConfig } from "./config"

export const CFL_W1 = 436.6
export const CFL_W2 = 611.6

export interface SpectrumData {
  sourceId: string
  /** Number of columns (pixels) in the cropped spectrum line. */
  width: number
  r: Float32Array
  g: Float32Array
  b: Float32Array
  intensity: Float32Array
  /** wavelength = m * x + n, where x is the column inside the crop. */
  m: number
  n: number
  /** CFL calibration columns, relative to the crop. */
  cflX1: number
  cflX2: number
}

export function effectiveOffsets(frameWidth: number, config: SpectrumConfig) {
  let left = Math.max(0, Math.round(config.leftOffset))
  let right = Math.max(0, Math.round(config.rightOffset))
  if (left + right >= frameWidth) {
    left = 0
    right = 0
  }
  return { left, right }
}

/**
 * @param row interleaved RGB values (0..255), length frameWidth * 3
 */
export function extractSpectrum(
  sourceId: string,
  row: Float32Array,
  frameWidth: number,
  config: SpectrumConfig,
): SpectrumData {
  const { left, right } = effectiveOffsets(frameWidth, config)
  const width = Math.max(1, frameWidth - left - right)
  const r = new Float32Array(width)
  const g = new Float32Array(width)
  const b = new Float32Array(width)
  const intensity = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const i = (x + left) * 3
    r[x] = row[i] / 255
    g[x] = row[i + 1] / 255
    b[x] = row[i + 2] / 255
    intensity[x] = (r[x] + g[x] + b[x]) / 3
  }
  const cflX1 = config.cflX1 - left
  let cflX2 = config.cflX2 - left
  if (cflX2 === cflX1) cflX2 = cflX1 + 1
  const m = (CFL_W2 - CFL_W1) / (cflX2 - cflX1)
  const n = CFL_W1 - m * cflX1
  return { sourceId, width, r, g, b, intensity, m, n, cflX1, cflX2 }
}

export const x2w = (d: SpectrumData, x: number) => d.m * x + d.n
export const w2x = (d: SpectrumData, w: number) => (w - d.n) / d.m

export function wavelengthRange(d: SpectrumData): [number, number] {
  const a = x2w(d, 0)
  const b = x2w(d, d.width - 1)
  return a < b ? [a, b] : [b, a]
}

/** Linear interpolation of a channel at a wavelength; null when outside. */
export function valueAt(d: SpectrumData, channel: Float32Array, w: number): number | null {
  const x = w2x(d, w)
  if (!Number.isFinite(x) || x < 0 || x > d.width - 1) return null
  const x0 = Math.floor(x)
  const x1 = Math.min(d.width - 1, x0 + 1)
  const t = x - x0
  return channel[x0] * (1 - t) + channel[x1] * t
}

/** Point-wise difference a − b (used by the Difference view). */
export function subtract(a: SpectrumData, b: SpectrumData): SpectrumData {
  const width = Math.min(a.width, b.width)
  const r = new Float32Array(width)
  const g = new Float32Array(width)
  const bl = new Float32Array(width)
  const intensity = new Float32Array(width)
  for (let i = 0; i < width; i++) {
    r[i] = a.r[i] - b.r[i]
    g[i] = a.g[i] - b.g[i]
    bl[i] = a.b[i] - b.b[i]
    intensity[i] = a.intensity[i] - b.intensity[i]
  }
  return { ...a, width, r, g, b: bl, intensity }
}

/**
 * Scales intensity so the peak is 1 (capped at 5×), optionally smoothed
 * against the previous scale. Returns a new spectrum and the scale used.
 */
export function normalize(d: SpectrumData, lastScale = -1, smooth = 0) {
  let max = 0
  for (let i = 0; i < d.width; i++) if (d.intensity[i] > max) max = d.intensity[i]
  if (max <= 0) return { data: d, scale: 1 }
  let scale = 1 / max
  if (lastScale !== -1) scale = lastScale * smooth + scale * (1 - smooth)
  if (scale >= 5) scale = 5
  const intensity = new Float32Array(d.width)
  for (let i = 0; i < d.width; i++) intensity[i] = d.intensity[i] * scale
  return { data: { ...d, intensity }, scale }
}

export interface NamedSpectrum {
  name: string
  data: SpectrumData
}

export function exportCSV(spectra: NamedSpectrum[], european: boolean): string {
  const sep = european ? ";" : ","
  const num = (v: number, digits: number) => {
    const s = v.toFixed(digits)
    return european ? s.replace(".", ",") : s
  }
  const quote = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines: string[] = []
  lines.push(spectra.map((s) => `${quote(s.name)}${sep}`).join(sep))
  lines.push(spectra.map(() => `Wavelength in nm${sep}Intensity in %`).join(sep))
  const rows = Math.max(0, ...spectra.map((s) => s.data.width))
  for (let i = 0; i < rows; i++) {
    lines.push(
      spectra
        .map((s) =>
          i < s.data.width
            ? `${num(x2w(s.data, i), 2)}${sep}${num(s.data.intensity[i] * 100, 3)}`
            : sep,
        )
        .join(sep),
    )
  }
  return lines.join("\n") + "\n"
}
