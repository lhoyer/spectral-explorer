/** Reference spectral lines (from spectrum_drawing_strategy.cpp). */

export interface Peak {
  wavelength: number
  label: string
}

export const CFL_LINES: Peak[] = [
  { wavelength: 405.4, label: "Hg" },
  { wavelength: 436.6, label: "Hg" },
  { wavelength: 487.7, label: "Tb³⁺" },
  { wavelength: 542.4, label: "Tb³⁺" },
  { wavelength: 546.5, label: "Hg" },
  { wavelength: 577.0, label: "Hg" },
  { wavelength: 579.1, label: "Hg" },
  { wavelength: 580.0, label: "Tb³⁺" },
  { wavelength: 584.0, label: "Tb³⁺" },
  { wavelength: 587.6, label: "Eu³⁺" },
  { wavelength: 593.4, label: "Eu³⁺" },
  { wavelength: 599.7, label: "Eu³⁺" },
  { wavelength: 611.6, label: "Eu³⁺" },
  { wavelength: 625.7, label: "Tb³⁺" },
  { wavelength: 631.1, label: "Eu³⁺" },
  { wavelength: 650.8, label: "Eu³⁺" },
  { wavelength: 662.6, label: "Eu³⁺" },
]

export const CFL_ELEMENT_COLORS: Record<string, string> = {
  Hg: "#6366f1",
  "Tb³⁺": "#22c55e",
  "Eu³⁺": "#ef4444",
}

export const FRAUNHOFER_LINES: Peak[] = [
  { wavelength: 589.5, label: "D: Na" },
  { wavelength: 527.0, label: "E: Fe" },
  { wavelength: 518.4, label: "b" },
  { wavelength: 517.3, label: "" },
  { wavelength: 516.8, label: "" },
  { wavelength: 486.1, label: "F: H" },
  { wavelength: 430.8, label: "G: Ca/Fe" },
]

/** Approximate visible color of a wavelength (Bruton), 0..1 per channel. */
export function wavelengthToRgb(w: number): [number, number, number] {
  if (!(w >= 380 && w <= 780)) return [0, 0, 0]
  let r = 0
  let g = 0
  let b = 0
  if (w >= 380 && w < 440) {
    r = -(w - 440) / 60
    b = 1
  } else if (w < 490) {
    g = (w - 440) / 50
    b = 1
  } else if (w < 510) {
    g = 1
    b = -(w - 510) / 20
  } else if (w < 580) {
    r = (w - 510) / 70
    g = 1
  } else if (w < 645) {
    r = 1
    g = -(w - 645) / 65
  } else if (w <= 780) {
    r = 1
  }
  let f = 0
  if (w >= 380 && w < 420) f = 0.3 + (0.7 * (w - 380)) / 40
  else if (w < 701) f = 1
  else if (w <= 780) f = 0.3 + (0.7 * (780 - w)) / 80
  return [r * f, g * f, b * f]
}
