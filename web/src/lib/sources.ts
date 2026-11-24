/**
 * Spectrum sources: live cameras and still images (loaded files, snapshots,
 * demos). Replaces camera/* and spectrum/spectrum.cpp + spectrum_disposer.cpp.
 *
 * Each source owns a config, keeps its current (rotated) frame in a canvas,
 * and emits `changed` whenever a new spectrum has been extracted.
 */
import { useSyncExternalStore } from "react"
import { cloneConfig, configFromIni, configToIni, loadDefaultConfig, rescaleConfig, type SpectrumConfig } from "./config"
import { downloadBlob } from "./download"
import { addPngText, CONFIG_KEYWORD, readPngText } from "./png"
import { getSettings, parseResolution } from "./settings"
import { extractSpectrum, type SpectrumData } from "./spectrum"

export class Emitter {
  private ls = new Set<() => void>()
  on(l: () => void) {
    this.ls.add(l)
    return () => {
      this.ls.delete(l)
    }
  }
  emit() {
    this.ls.forEach((l) => l())
  }
}

let nextId = 1

export abstract class Source {
  readonly id = `src-${nextId++}`
  abstract readonly kind: "camera" | "image"
  name: string
  config: SpectrumConfig
  data: SpectrumData | null = null
  /** Current frame, after rotation. */
  readonly frame = document.createElement("canvas")
  frozen = false
  /** True for snapshots: they join the graph instead of taking over the optical view. */
  isSnapshot = false
  /** Set while the configuration dialog wants unfiltered, immediate output. */
  filterSuspended = false
  readonly changed = new Emitter()

  private rowCanvas = document.createElement("canvas")
  private rowCtx = this.rowCanvas.getContext("2d", { willReadFrequently: true })!
  private rows: Float32Array[] = []
  private rowKey = ""

  constructor(name: string, config: SpectrumConfig) {
    this.name = name
    this.config = config
  }

  get live() {
    return this.kind === "camera"
  }

  get averageFrames() {
    return this.config.filterEnabled && !this.filterSuspended ? Math.max(1, this.config.averageFrames) : 1
  }

  /** Re-renders the frame (e.g. after rotation) and re-extracts the spectrum. */
  abstract redraw(): void

  /** Re-extracts the spectrum from the current frame after a config change. */
  refresh() {
    this.process(false)
  }

  setFrozen(frozen: boolean) {
    this.frozen = frozen
    this.changed.emit()
  }

  dispose() {}

  protected drawRotated(src: CanvasImageSource, w: number, h: number) {
    rescaleConfig(this.config, w)
    const rot = this.config.rotation
    const fw = rot % 180 ? h : w
    const fh = rot % 180 ? w : h
    if (this.frame.width !== fw) this.frame.width = fw
    if (this.frame.height !== fh) this.frame.height = fh
    const ctx = this.frame.getContext("2d")!
    ctx.setTransform(1, 0, 0, 1, fw / 2, fh / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.drawImage(src, -w / 2, -h / 2, w, h)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** Reads the configured row (averaging the last N frames) into a spectrum. */
  protected process(freshFrame: boolean) {
    const fw = this.frame.width
    const fh = this.frame.height
    if (!fw || !fh) return
    const row = Math.min(fh - 1, Math.max(0, Math.round(this.config.spectrumRow ?? fh / 2)))
    const key = `${row}|${fw}|${fh}`
    if (key !== this.rowKey) {
      this.rows = []
      this.rowKey = key
      freshFrame = true
    }
    if (freshFrame || this.rows.length === 0) {
      if (this.rowCanvas.width !== fw) this.rowCanvas.width = fw
      this.rowCanvas.height = 1
      this.rowCtx.drawImage(this.frame, 0, row, fw, 1, 0, 0, fw, 1)
      const px = this.rowCtx.getImageData(0, 0, fw, 1).data
      const line = new Float32Array(fw * 3)
      for (let x = 0; x < fw; x++) {
        line[x * 3] = px[x * 4]
        line[x * 3 + 1] = px[x * 4 + 1]
        line[x * 3 + 2] = px[x * 4 + 2]
      }
      this.rows.push(line)
    }
    const n = this.averageFrames
    while (this.rows.length > n) this.rows.shift()
    let avg = this.rows[this.rows.length - 1]
    if (n > 1 && this.rows.length > 1) {
      avg = new Float32Array(fw * 3)
      for (const r of this.rows) for (let i = 0; i < avg.length; i++) avg[i] += r[i]
      for (let i = 0; i < avg.length; i++) avg[i] /= this.rows.length
    }
    this.data = extractSpectrum(this.id, avg, fw, this.config)
    this.changed.emit()
  }

  /** The current frame as a stand-alone still (snapshot / save). */
  stillConfig(): SpectrumConfig {
    return { ...cloneConfig(this.config), rotation: 0, baseWidth: this.frame.width }
  }
}

// ---------------------------------------------------------------------------

export class ImageSource extends Source {
  readonly kind = "image" as const
  private image: CanvasImageSource & { width: number; height: number }

  constructor(name: string, image: CanvasImageSource & { width: number; height: number }, config: SpectrumConfig) {
    super(name, config)
    this.image = image
  }

  redraw() {
    this.drawRotated(this.image, this.image.width, this.image.height)
    this.process(true)
  }
}

// ---------------------------------------------------------------------------

type Caps = Record<string, unknown>

export class CameraSource extends Source {
  readonly kind = "camera" as const
  readonly video = document.createElement("video")
  readonly ended = new Emitter()
  deviceId: string | undefined
  track: MediaStreamTrack | null = null
  capabilities: Caps = {}
  private stream: MediaStream | null = null
  private disposed = false
  private lastTime = -1

  private constructor(name: string, config: SpectrumConfig, deviceId?: string) {
    super(name, config)
    this.deviceId = deviceId
    this.video.muted = true
    this.video.playsInline = true
    // Attached (but invisible) so requestVideoFrameCallback keeps firing.
    this.video.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none"
    document.body.appendChild(this.video)
  }

  static async open(deviceId?: string) {
    const source = new CameraSource("Camera", loadDefaultConfig(), deviceId)
    try {
      await source.start()
    } catch (e) {
      source.dispose()
      throw e
    }
    const label = source.track?.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "").trim()
    source.name = registry.availableName(label || "Camera")
    return source
  }

  async start() {
    const { width, height } = parseResolution(getSettings().resolution)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height },
      },
    })
    this.stream = stream
    this.track = stream.getVideoTracks()[0]
    this.deviceId = this.track.getSettings().deviceId ?? this.deviceId
    this.capabilities = (this.track.getCapabilities?.() ?? {}) as Caps
    this.track.addEventListener("ended", () => this.ended.emit())
    this.video.srcObject = stream
    await this.video.play()
    await this.applyCameraControls()
    this.loop()
  }

  async restart() {
    this.stream?.getTracks().forEach((t) => t.stop())
    await this.start()
  }

  private loop() {
    const v = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }
    const stream = this.stream
    if (v.requestVideoFrameCallback) {
      const cb = () => {
        if (this.disposed || this.stream !== stream) return
        this.onVideoFrame()
        v.requestVideoFrameCallback!(cb)
      }
      v.requestVideoFrameCallback(cb)
    } else {
      const tick = () => {
        if (this.disposed || this.stream !== stream) return
        if (v.currentTime !== this.lastTime) {
          this.lastTime = v.currentTime
          this.onVideoFrame()
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }

  private onVideoFrame() {
    if (this.frozen || !this.video.videoWidth) return
    this.drawRotated(this.video, this.video.videoWidth, this.video.videoHeight)
    this.process(true)
  }

  redraw() {
    if (!this.video.videoWidth) return
    this.drawRotated(this.video, this.video.videoWidth, this.video.videoHeight)
    this.process(true)
  }

  /** Current value of a camera control (from the track's live settings). */
  controlValue(key: string): unknown {
    return (this.track?.getSettings() as Record<string, unknown> | undefined)?.[key]
  }

  async applyCameraControls() {
    if (!this.track) return
    const advanced: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(this.config.camera)) if (k in this.capabilities) advanced[k] = v
    if (!Object.keys(advanced).length) return
    try {
      await this.track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints)
    } catch (e) {
      console.warn("[camera] applyConstraints failed", e)
    }
  }

  dispose() {
    this.disposed = true
    this.stream?.getTracks().forEach((t) => t.stop())
    this.video.srcObject = null
    this.video.remove()
  }
}

// ---------------------------------------------------------------------------
// Registry (SpectrumDisposer)
// ---------------------------------------------------------------------------

class Registry {
  private list: Source[] = []
  private ls = new Set<() => void>()

  subscribe = (l: () => void) => {
    this.ls.add(l)
    return () => {
      this.ls.delete(l)
    }
  }
  getSnapshot = () => this.list
  private emit() {
    this.ls.forEach((l) => l())
  }

  get(id: string | null | undefined) {
    return this.list.find((s) => s.id === id) ?? null
  }
  add(s: Source) {
    this.list = [...this.list, s]
    this.emit()
  }
  remove(s: Source) {
    s.dispose()
    this.list = this.list.filter((x) => x !== s)
    this.emit()
  }
  rename(s: Source, name: string) {
    s.name = this.availableName(name, s)
    this.list = [...this.list]
    this.emit()
  }
  availableName(base: string, except?: Source) {
    let name = base
    for (let i = 2; this.list.some((s) => s !== except && s.name === name); i++) name = `${base} (${i})`
    return name
  }
}

export const registry = new Registry()

export function useSources() {
  return useSyncExternalStore(registry.subscribe, registry.getSnapshot)
}

// ---------------------------------------------------------------------------
// Snapshots, saving and loading
// ---------------------------------------------------------------------------

function copyCanvas(src: HTMLCanvasElement) {
  const c = document.createElement("canvas")
  c.width = src.width
  c.height = src.height
  c.getContext("2d")!.drawImage(src, 0, 0)
  return c
}

export function snapshot(s: Source, name?: string): ImageSource | null {
  if (!s.frame.width) return null
  const snap = new ImageSource(registry.availableName(name ?? `${s.name} · snapshot`), copyCanvas(s.frame), s.stillConfig())
  snap.isSnapshot = true
  registry.add(snap)
  snap.redraw()
  return snap
}

export async function saveSource(s: Source, baseName: string) {
  if (!s.frame.width) return
  const ini = configToIni(s.stillConfig())
  const png = await new Promise<Blob | null>((res) => s.frame.toBlob(res, "image/png"))
  if (!png) return
  downloadBlob(await addPngText(png, CONFIG_KEYWORD, ini), `${baseName}.png`)
  if (getSettings().saveConfigFile) downloadBlob(new Blob([ini], { type: "text/plain" }), `${baseName}.config`)
  if (getSettings().keepSavedAsSnapshot) snapshot(s, baseName)
}

const baseName = (f: string) => f.replace(/\.[^.]+$/, "")

/**
 * Loads saved spectra. A `.config` with the same base name (desktop app
 * style) wins over a config embedded in the PNG.
 */
export async function loadFiles(files: File[]): Promise<{ added: ImageSource[]; skipped: string[] }> {
  const configs = new Map<string, string>()
  for (const f of files) if (/\.config$/i.test(f.name)) configs.set(baseName(f.name), await f.text())
  const added: ImageSource[] = []
  const skipped: string[] = []
  for (const f of files) {
    if (/\.config$/i.test(f.name)) continue
    if (!f.type.startsWith("image/") && !/\.(png|jpe?g)$/i.test(f.name)) {
      skipped.push(f.name)
      continue
    }
    try {
      const bitmap = await createImageBitmap(f)
      let text = configs.get(baseName(f.name)) ?? null
      if (!text && /png$/i.test(f.type || f.name)) text = readPngText(new Uint8Array(await f.arrayBuffer()), CONFIG_KEYWORD)
      const config = text ? configFromIni(text, loadDefaultConfig()) : loadDefaultConfig()
      const src = new ImageSource(registry.availableName(baseName(f.name)), bitmap, config)
      registry.add(src)
      src.redraw()
      added.push(src)
    } catch {
      skipped.push(f.name)
    }
  }
  return { added, skipped }
}
