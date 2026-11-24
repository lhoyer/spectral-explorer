import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react"
import { ChevronLeftIcon, ChevronRightIcon, FileCogIcon, RotateCwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  cloneConfig,
  configFromIni,
  configToIni,
  loadDefaultConfig,
  saveDefaultConfig,
  type Rotation,
  type SpectrumConfig,
} from "@/lib/config"
import { downloadBlob, pickFiles } from "@/lib/download"
import { drawCalibration, drawCameraView, type FitRect } from "@/lib/draw"
import { updateSettings, useSettings } from "@/lib/settings"
import { CameraSource, registry, type Source } from "@/lib/sources"
import { effectiveOffsets, normalize } from "@/lib/spectrum"
import { Plot, type Point } from "./Plot"

export function ConfigDialog({ source, onClose }: { source: Source; onClose: () => void }) {
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const original = useRef<SpectrumConfig>(cloneConfig(source.config))
  const settings = useSettings()
  const [active, setActive] = useState<1 | 2>(1)
  const camRect = useRef<FitRect | null>(null)
  const lastScale = useRef(-1)

  useEffect(() => {
    source.filterSuspended = settings.disableFilterWhileConfiguring
    source.refresh()
  }, [source, settings.disableFilterWhileConfiguring])

  useEffect(
    () => () => {
      source.filterSuspended = false
      source.refresh()
    },
    [source],
  )

  const c = source.config
  const fw = source.frame.width
  const fh = source.frame.height
  const { left, right } = effectiveOffsets(fw, c)
  const row = Math.min(fh - 1, Math.max(0, Math.round(c.spectrumRow ?? fh / 2)))

  const update = (patch: Partial<SpectrumConfig>, redraw = false) => {
    Object.assign(source.config, patch)
    if (redraw) source.redraw()
    else source.refresh()
    rerender()
  }

  const replaceConfig = async (next: SpectrumConfig) => {
    source.config = next
    if (source instanceof CameraSource) await source.applyCameraControls()
    source.redraw()
    rerender()
  }

  const finish = async (keep: boolean) => {
    if (!keep) await replaceConfig(original.current)
    onClose()
  }

  const renderCamera = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const fw = source.frame.width
      const fh = source.frame.height
      const { left, right } = effectiveOffsets(fw, source.config)
      const row = Math.min(fh - 1, Math.max(0, Math.round(source.config.spectrumRow ?? fh / 2)))
      camRect.current = drawCameraView(ctx, w, h, source.frame, row, left, right)
    },
    [source],
  )

  const renderCalibration = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      let d = source.data
      if (d) {
        const n = source.live ? normalize(d, lastScale.current, 0.6) : normalize(d)
        lastScale.current = n.scale
        d = n.data
      }
      drawCalibration(ctx, w, h, d, active)
    },
    [source, active],
  )

  const pickRow = (p: Point) => {
    const r = camRect.current
    if (!r) return
    const y = Math.floor((p.y - r.y) / r.scale)
    if (y >= 0 && y < fh) update({ spectrumRow: y })
  }

  const pickLine = (p: Point, e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = source.data
    if (!d) return
    const x = Math.round(p.x / (e.currentTarget.clientWidth / d.width) - 0.5) + left
    update(active === 1 ? { cflX1: x } : { cflX2: x })
  }

  const nudgeLine = (dx: number) => update(active === 1 ? { cflX1: c.cflX1 + dx } : { cflX2: c.cflX2 + dx })

  const nmPerPx = Math.abs((611.6 - 436.6) / ((c.cflX2 - c.cflX1) || 1))

  const configMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="mr-auto">
          <FileCogIcon /> Configuration
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem
          onSelect={async () => {
            const [f] = await pickFiles(".config,text/plain", false)
            if (!f) return
            await replaceConfig(configFromIni(await f.text(), source.config))
            toast.success(`Loaded ${f.name}`)
          }}
        >
          Load .config…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadBlob(new Blob([configToIni(c)], { type: "text/plain" }), "spectrometer.config")}>
          Save .config
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => replaceConfig(loadDefaultConfig())}>Restore default</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            saveDefaultConfig(c)
            toast.success("Saved as default for new cameras and files")
          }}
        >
          Set as default
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const others = registry.getSnapshot().filter((s) => s !== source)
            for (const s of others) {
              s.config = cloneConfig(c)
              if (s instanceof CameraSource) await s.applyCameraControls()
              s.redraw()
            }
            toast.success(`Applied to ${others.length} other spectrum${others.length === 1 ? "" : "s"}`)
          }}
        >
          Apply to all spectra
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && finish(false)}>
      <DialogContent className="flex max-h-[94svh] flex-col gap-3 p-4 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Configure · {source.name}</DialogTitle>
          <DialogDescription>
            Click the camera view to choose the measurement row, then calibrate the wavelength scale with a fluorescent lamp.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[1fr_300px] lg:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="relative aspect-[4/3] max-h-[56svh] w-full overflow-hidden rounded-lg border bg-black lg:aspect-auto lg:flex-1">
              <Plot
                className="absolute inset-0 cursor-row-resize"
                render={renderCamera}
                sources={[source]}
                onPlotPointer={pickRow}
                aria-label="Camera view — click to choose the measurement row"
              />
            </div>
            <div className="relative h-28 shrink-0 overflow-hidden rounded-lg border bg-black">
              <Plot
                className="absolute inset-0 cursor-col-resize"
                render={renderCalibration}
                sources={[source]}
                onPlotPointer={pickLine}
                aria-label="Wavelength calibration view — click a spectral line"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-2">
            <Section title="Wavelength calibration">
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={String(active)}
                onValueChange={(v) => v && setActive(Number(v) as 1 | 2)}
                className="w-full"
              >
                <ToggleGroupItem value="1" className="flex-1">
                  <span className="size-2 rounded-full bg-blue-500" /> 436.6 nm
                </ToggleGroupItem>
                <ToggleGroupItem value="2" className="flex-1">
                  <span className="size-2 rounded-full bg-red-500" /> 611.6 nm
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {active === 1
                  ? "Point at a fluorescent lamp and click the middle blue line."
                  : "Click the brightest red line."}
              </p>
              <div className="flex items-center gap-2">
                <Button size="icon-sm" variant="outline" onClick={() => nudgeLine(-1)} aria-label="Move line left">
                  <ChevronLeftIcon />
                </Button>
                <span className="flex-1 text-center text-sm tabular-nums">
                  px {active === 1 ? c.cflX1 : c.cflX2}
                </span>
                <Button size="icon-sm" variant="outline" onClick={() => nudgeLine(1)} aria-label="Move line right">
                  <ChevronRightIcon />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">Resolution ≈ {nmPerPx.toFixed(2)} nm per pixel</p>
            </Section>

            <Section title="Measurement row">
              <div className="flex items-center gap-2">
                <Button size="icon-sm" variant="outline" onClick={() => update({ spectrumRow: Math.max(0, row - 1) })} aria-label="Row up">
                  <ChevronLeftIcon className="rotate-90" />
                </Button>
                <span className="flex-1 text-center text-sm tabular-nums">
                  Row {row} of {fh}
                </span>
                <Button size="icon-sm" variant="outline" onClick={() => update({ spectrumRow: Math.min(fh - 1, row + 1) })} aria-label="Row down">
                  <ChevronRightIcon className="rotate-90" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use one of the middle rows, where the spectrum is sharpest.</p>
            </Section>

            <Section title="Noise filter">
              <SliderRow
                label="Filter level"
                value={c.averageFrames}
                min={1}
                max={30}
                display={c.averageFrames === 1 ? "off" : `${c.averageFrames} frames`}
                onChange={(v) => update({ averageFrames: v })}
              />
              <SwitchRow
                id="pause-filter"
                label="Pause filter while configuring"
                hint="See slit and focus changes immediately"
                checked={settings.disableFilterWhileConfiguring}
                onChange={(v) => updateSettings({ disableFilterWhileConfiguring: v })}
              />
            </Section>

            <Section title="Crop">
              <SliderRow
                label="Left"
                value={c.leftOffset}
                min={0}
                max={Math.max(0, fw - c.rightOffset - 2)}
                display={`${left} px`}
                onChange={(v) => update({ leftOffset: v })}
              />
              <SliderRow
                label="Right"
                value={c.rightOffset}
                min={0}
                max={Math.max(0, fw - c.leftOffset - 2)}
                display={`${right} px`}
                onChange={(v) => update({ rightOffset: v })}
              />
            </Section>

            <Section
              title="Camera"
              action={
                <Button size="sm" variant="ghost" onClick={() => update({ rotation: (((c.rotation + 90) % 360) as Rotation) }, true)}>
                  <RotateCwIcon /> Rotate
                </Button>
              }
            >
              {source instanceof CameraSource ? (
                <CameraControls source={source} />
              ) : (
                <p className="text-xs text-muted-foreground">Still image — camera settings don't apply.</p>
              )}
            </Section>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-end">
          {configMenu}
          <Button variant="outline" onClick={() => finish(false)}>
            Cancel
          </Button>
          <Button onClick={() => finish(true)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <div className="flex h-7 items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display?: string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="grid gap-2" aria-disabled={disabled}>
      <div className="flex items-center justify-between text-sm">
        <Label className={disabled ? "opacity-50" : undefined}>{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{display ?? value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="flex-col items-start gap-0.5 font-normal">
        <span>{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Browser camera controls (Image Capture constraints — Chrome / ChromeOS)
// ---------------------------------------------------------------------------

const MODES = [
  { key: "exposureMode", label: "Auto exposure" },
  { key: "whiteBalanceMode", label: "Auto white balance" },
  { key: "focusMode", label: "Autofocus" },
]

const CONTROLS: { key: string; label: string; mode?: string; unit?: string; log?: boolean }[] = [
  { key: "exposureTime", label: "Exposure", mode: "exposureMode", log: true },
  { key: "exposureCompensation", label: "Exposure compensation" },
  { key: "iso", label: "Gain (ISO)" },
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
  { key: "sharpness", label: "Sharpness" },
  { key: "colorTemperature", label: "White balance", mode: "whiteBalanceMode", unit: "K" },
  { key: "focusDistance", label: "Focus", mode: "focusMode" },
]

type Range = { min: number; max: number; step?: number }
const isRange = (v: unknown): v is Range =>
  !!v && typeof v === "object" && typeof (v as Range).min === "number" && typeof (v as Range).max === "number" && (v as Range).max > (v as Range).min

function CameraControls({ source }: { source: CameraSource }) {
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const caps = source.capabilities
  const value = (k: string) => source.config.camera[k] ?? (source.controlValue(k) as number | string | undefined)

  const set = (patch: Record<string, number | string>) => {
    Object.assign(source.config.camera, patch)
    void source.applyCameraControls()
    rerender()
  }

  const modes = MODES.filter((m) => {
    const opts = caps[m.key]
    return Array.isArray(opts) && opts.includes("manual") && opts.some((o) => o !== "manual")
  })
  const autoValue = (key: string) => {
    const opts = caps[key] as string[]
    return opts.includes("continuous") ? "continuous" : opts.find((o) => o !== "manual")!
  }
  const controls = CONTROLS.filter((c) => isRange(caps[c.key]))

  if (!modes.length && !controls.length) {
    return (
      <p className="text-xs text-muted-foreground">
        This browser doesn't offer manual camera controls. Chrome (including on Chromebooks) supports exposure on most USB webcams — otherwise
        control brightness with the slit width.
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {modes.map((m) => (
        <SwitchRow
          key={m.key}
          id={m.key}
          label={m.label}
          checked={value(m.key) !== "manual"}
          onChange={(auto) => set({ [m.key]: auto ? autoValue(m.key) : "manual" })}
        />
      ))}
      {controls.map((c) => {
        const r = caps[c.key] as Range
        const raw = Number(value(c.key) ?? r.min)
        const auto = !!c.mode && modes.some((m) => m.key === c.mode) && value(c.mode) !== "manual"
        const log = c.log && r.max / Math.max(r.min, 1) > 50
        const lo = Math.max(r.min, 1)
        const toPos = (v: number) => (log ? (Math.log(Math.max(v, lo) / lo) / Math.log(r.max / lo)) * 1000 : v)
        const fromPos = (p: number) => {
          if (!log) return p
          const v = lo * Math.pow(r.max / lo, p / 1000)
          const step = r.step || 1
          return Math.min(r.max, Math.max(r.min, Math.round(v / step) * step))
        }
        return (
          <SliderRow
            key={c.key}
            label={c.label}
            value={toPos(raw)}
            min={log ? 0 : r.min}
            max={log ? 1000 : r.max}
            step={log ? 1 : r.step || 1}
            disabled={auto}
            display={`${Number.isInteger(raw) ? raw : raw.toFixed(2)}${c.unit ? ` ${c.unit}` : ""}`}
            onChange={(p) => set({ [c.key]: fromPos(p), ...(c.mode && modes.some((m) => m.key === c.mode) ? { [c.mode]: "manual" } : {}) })}
          />
        )
      })}
      <Button
        size="sm"
        variant="ghost"
        className="justify-self-start"
        onClick={() => {
          source.config.camera = Object.fromEntries(modes.map((m) => [m.key, autoValue(m.key)]))
          void source.applyCameraControls()
          rerender()
        }}
      >
        Reset camera to automatic
      </Button>
    </div>
  )
}
