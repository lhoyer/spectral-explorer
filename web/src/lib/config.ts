/**
 * Per-spectrum configuration, ported from spectrum/spectrum_config.cpp.
 *
 * Saved as an INI-style `.config` file that is compatible with the desktop
 * app (same [Camera] / [WavelengthConfiguration] keys). Browser-only values
 * live in extra [Web] / [WebCamera] groups, which the desktop app ignores.
 */

export type Rotation = 0 | 90 | 180 | 270

export interface SpectrumConfig {
  /** Camera row used for the spectrum; null = vertical center. */
  spectrumRow: number | null
  /** Absolute frame columns of the 436.6 nm and 611.6 nm CFL lines. */
  cflX1: number
  cflX2: number
  leftOffset: number
  rightOffset: number
  averageFrames: number
  filterEnabled: boolean
  rotation: Rotation
  /** Frame width the pixel values above refer to (used to rescale). */
  baseWidth: number
  /** Desktop (OpenCV) values, kept so files round-trip with the desktop app. */
  exposure: number
  gain: number
  /** Browser camera controls (MediaStreamTrack constraints). */
  camera: Record<string, number | string>
}

export const BUILTIN_DEFAULT: SpectrumConfig = {
  spectrumRow: null,
  cflX1: 510,
  cflX2: 860,
  leftOffset: 380,
  rightOffset: 250,
  averageFrames: 10,
  filterEnabled: true,
  rotation: 0,
  baseWidth: 1280,
  exposure: 6,
  gain: 255,
  camera: {},
}

export function cloneConfig(c: SpectrumConfig): SpectrumConfig {
  return { ...c, camera: { ...c.camera } }
}

/** Rescales pixel positions when a config is used with a different frame width. */
export function rescaleConfig(c: SpectrumConfig, width: number) {
  if (!width || c.baseWidth === width) return
  const s = width / c.baseWidth
  c.cflX1 = Math.round(c.cflX1 * s)
  c.cflX2 = Math.round(c.cflX2 * s)
  c.leftOffset = Math.round(c.leftOffset * s)
  c.rightOffset = Math.round(c.rightOffset * s)
  if (c.spectrumRow != null) c.spectrumRow = Math.round(c.spectrumRow * s)
  c.baseWidth = width
}

// ---------------------------------------------------------------------------
// INI (QSettings IniFormat) serialization
// ---------------------------------------------------------------------------

type Ini = Record<string, Record<string, string>>

export function parseIni(text: string): Ini {
  const out: Ini = {}
  let group = "General"
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith(";") || line.startsWith("#")) continue
    const g = line.match(/^\[(.+)\]$/)
    if (g) {
      group = g[1]
      continue
    }
    const eq = line.indexOf("=")
    if (eq < 0) continue
    ;(out[group] ??= {})[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^"|"$/g, "")
  }
  return out
}

export function configFromIni(text: string, base: SpectrumConfig = BUILTIN_DEFAULT): SpectrumConfig {
  const ini = parseIni(text)
  const c = cloneConfig(base)
  const num = (group: string, key: string, fallback: number) => {
    const v = ini[group]?.[key]
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  c.exposure = num("Camera", "Exposure", c.exposure)
  c.gain = num("Camera", "Gain", c.gain)
  c.averageFrames = Math.max(1, num("Camera", "AverageFrames", c.averageFrames))
  const row = ini.WavelengthConfiguration?.CameraSpectrumRow
  c.spectrumRow = row != null && row !== "" && Number.isFinite(Number(row)) ? Number(row) : null
  c.cflX1 = num("WavelengthConfiguration", "CFLX1", c.cflX1)
  c.cflX2 = num("WavelengthConfiguration", "CFLX2", c.cflX2)
  c.leftOffset = num("WavelengthConfiguration", "LeftOffset", c.leftOffset)
  c.rightOffset = num("WavelengthConfiguration", "RightOffset", c.rightOffset)
  // Desktop configs carry no width; they were made at the default 1280 px.
  c.baseWidth = num("Web", "FrameWidth", 1280)
  const rot = num("Web", "Rotation", 0)
  c.rotation = ([0, 90, 180, 270].includes(rot) ? rot : 0) as Rotation
  const filter = ini.Web?.FilterEnabled
  if (filter != null) c.filterEnabled = filter === "true"
  if (ini.WebCamera) {
    c.camera = {}
    for (const [k, v] of Object.entries(ini.WebCamera)) {
      const n = Number(v)
      c.camera[k] = v !== "" && Number.isFinite(n) ? n : v
    }
  }
  return c
}

export function configToIni(c: SpectrumConfig): string {
  const lines = [
    "[Camera]",
    `Exposure=${c.exposure}`,
    `Gain=${c.gain}`,
    `AverageFrames=${c.averageFrames}`,
    "",
    "[WavelengthConfiguration]",
    ...(c.spectrumRow != null ? [`CameraSpectrumRow=${c.spectrumRow}`] : []),
    `CFLX1=${c.cflX1}`,
    `CFLX2=${c.cflX2}`,
    `LeftOffset=${c.leftOffset}`,
    `RightOffset=${c.rightOffset}`,
    "",
    "[Web]",
    `FrameWidth=${c.baseWidth}`,
    `Rotation=${c.rotation}`,
    `FilterEnabled=${c.filterEnabled}`,
  ]
  const cam = Object.entries(c.camera)
  if (cam.length) lines.push("", "[WebCamera]", ...cam.map(([k, v]) => `${k}=${v}`))
  return lines.join("\n") + "\n"
}

// ---------------------------------------------------------------------------
// "Set as default" — persisted in localStorage (QSettings in the desktop app)
// ---------------------------------------------------------------------------

const DEFAULT_KEY = "spectral-explorer.default-config"

export function loadDefaultConfig(): SpectrumConfig {
  try {
    const text = localStorage.getItem(DEFAULT_KEY)
    if (text) return configFromIni(text)
  } catch {
    /* ignore */
  }
  return cloneConfig(BUILTIN_DEFAULT)
}

export function saveDefaultConfig(c: SpectrumConfig) {
  localStorage.setItem(DEFAULT_KEY, configToIni(c))
}
