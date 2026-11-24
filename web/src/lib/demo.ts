/**
 * Synthetic camera frames so the app can be explored without the hardware.
 * They mimic what the spectrometer camera sees with the default calibration.
 */
import { BUILTIN_DEFAULT } from "./config"
import { CFL_W1, CFL_W2 } from "./spectrum"
import { FRAUNHOFER_LINES, wavelengthToRgb } from "./lines"

export type DemoKind = "cfl" | "sun" | "led"

export const DEMOS: { kind: DemoKind; name: string; description: string }[] = [
  { kind: "cfl", name: "Fluorescent lamp", description: "Sharp Hg / Tb / Eu emission lines" },
  { kind: "sun", name: "Sunlight", description: "Continuous spectrum with Fraunhofer lines" },
  { kind: "led", name: "White LED", description: "Blue LED peak plus broad phosphor" },
]

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))

function spectrumFn(kind: DemoKind): (w: number) => number {
  switch (kind) {
    case "cfl": {
      const lines: [number, number, number][] = [
        [405.4, 0.35, 1.2],
        [436.6, 0.9, 1.2],
        [487.7, 0.45, 1.6],
        [542.4, 0.85, 1.6],
        [546.5, 1.0, 1.2],
        [577.0, 0.25, 1.2],
        [579.1, 0.25, 1.2],
        [587.6, 0.3, 1.5],
        [593.4, 0.25, 1.5],
        [599.7, 0.2, 1.5],
        [611.6, 1.1, 1.5],
        [625.7, 0.25, 1.5],
        [631.1, 0.3, 1.5],
        [650.8, 0.15, 1.5],
        [662.6, 0.1, 1.5],
      ]
      return (w) => 0.03 + lines.reduce((s, [mu, a, sd]) => s + a * gauss(w, mu, sd), 0)
    }
    case "sun": {
      const planck = (w: number) => {
        const l = w * 1e-9
        return 1 / (l ** 5 * (Math.exp(0.0143877516 / (l * 5800)) - 1))
      }
      const peak = planck(500)
      const depths: Record<number, number> = { 589.5: 0.55, 527: 0.35, 518.4: 0.45, 517.3: 0.4, 516.8: 0.35, 486.1: 0.6, 430.8: 0.5 }
      return (w) => {
        let v = (planck(w) / peak) * 0.95
        for (const p of FRAUNHOFER_LINES) v *= 1 - (depths[p.wavelength] ?? 0.3) * gauss(w, p.wavelength, 1.4)
        v *= 1 - 0.5 * gauss(w, 656.3, 1.5)
        return v
      }
    }
    case "led":
      return (w) => 0.95 * gauss(w, 452, 10) + 0.62 * gauss(w, 565, 48)
  }
}

/** Renders a demo frame at the default camera resolution. */
export function renderDemoFrame(kind: DemoKind, width = 1280, height = 960): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(width, height)
  const s = width / BUILTIN_DEFAULT.baseWidth
  const m = (CFL_W2 - CFL_W1) / ((BUILTIN_DEFAULT.cflX2 - BUILTIN_DEFAULT.cflX1) * s)
  const n = CFL_W1 - m * BUILTIN_DEFAULT.cflX1 * s
  const fn = spectrumFn(kind)
  const cols = new Float32Array(width * 3)
  for (let x = 0; x < width; x++) {
    const w = m * x + n
    const [r, g, b] = wavelengthToRgb(w)
    const v = fn(w)
    cols[x * 3] = r * v
    cols[x * 3 + 1] = g * v
    cols[x * 3 + 2] = b * v
  }
  const cy = height / 2
  for (let y = 0; y < height; y++) {
    const fall = gauss(y, cy, height * 0.16) * (0.9 + 0.1 * Math.sin(y / 7))
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // a slight bloom makes it look like a camera image
      const k = fall * 255 * 1.15
      img.data[i] = Math.min(255, cols[x * 3] * k + 4)
      img.data[i + 1] = Math.min(255, cols[x * 3 + 1] * k + 4)
      img.data[i + 2] = Math.min(255, cols[x * 3 + 2] * k + 6)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
