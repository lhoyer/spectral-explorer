/** App-wide preferences (gui/settings.cpp), persisted in localStorage. */
import { useSyncExternalStore } from "react"

export interface AppSettings {
  resolution: string
  saveConfigFile: boolean
  keepSavedAsSnapshot: boolean
  disableFilterWhileConfiguring: boolean
  lastCameraId: string | null
}

const KEY = "spectral-explorer.settings"
const DEFAULTS: AppSettings = {
  resolution: "1280x960",
  saveConfigFile: false,
  keepSavedAsSnapshot: false,
  disableFilterWhileConfiguring: true,
  lastCameraId: null,
}

let current: AppSettings = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
  } catch {
    return { ...DEFAULTS }
  }
})()
const listeners = new Set<() => void>()

export const getSettings = () => current

export function updateSettings(patch: Partial<AppSettings>) {
  current = { ...current, ...patch }
  localStorage.setItem(KEY, JSON.stringify(current))
  listeners.forEach((l) => l())
}

export function useSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getSettings,
  )
}

export function parseResolution(s: string) {
  const [w, h] = s.split("x").map(Number)
  return { width: w || 1280, height: h || 960 }
}
