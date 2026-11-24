import { useCallback, useEffect, useRef, useState } from "react"
import { EraserIcon, FileDownIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  drawGraph,
  insidePlot,
  iToY,
  readPalette,
  wToX,
  xToW,
  yToI,
  type GraphMode,
  type Layout,
  type Series,
  type Target,
} from "@/lib/draw"
import { registry, type Source } from "@/lib/sources"
import { subtract } from "@/lib/spectrum"
import { ColorSelect, GRAPH_COLORS, IconButton, Panel, SourceSelect, Toolbar } from "./common"
import { ExportDialog, type ExportRequest } from "./ExportDialog"
import { Plot, type Point } from "./Plot"

interface Selector {
  key: number
  sourceId: string | null
  color: string
}

let selectorKey = 0
const resolveColor = (c: string, fg: string) => (c === "fg" ? fg : c)

export function AnalysisPanel({ sources, opticalId }: { sources: readonly Source[]; opticalId: string | null }) {
  const [tab, setTab] = useState("compare")
  const [exportReq, setExportReq] = useState<ExportRequest | null>(null)

  return (
    <Panel className="flex-1">
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <TabsList>
            <TabsTrigger value="compare">Graph</TabsTrigger>
            <TabsTrigger value="difference">Difference</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="compare" className="flex min-h-0 flex-col" forceMount hidden={tab !== "compare"}>
          <CompareView sources={sources} opticalId={opticalId} onExport={setExportReq} />
        </TabsContent>
        <TabsContent value="difference" className="flex min-h-0 flex-col" forceMount hidden={tab !== "difference"}>
          <DifferenceView sources={sources} onExport={setExportReq} />
        </TabsContent>
      </Tabs>
      {exportReq && <ExportDialog request={exportReq} onClose={() => setExportReq(null)} />}
    </Panel>
  )
}

// ---------------------------------------------------------------------------

function CompareView({
  sources,
  opticalId,
  onExport,
}: {
  sources: readonly Source[]
  opticalId: string | null
  onExport: (r: ExportRequest) => void
}) {
  const [selectors, setSelectors] = useState<Selector[]>(() => [{ key: selectorKey++, sourceId: null, color: "fg" }])
  const [mode, setMode] = useState<GraphMode>("intensity")
  const [cfl, setCfl] = useState(false)
  const [fraunhofer, setFraunhofer] = useState(false)
  const [targets, setTargets] = useState<Target[]>([])
  const layout = useRef<Layout | null>(null)

  // Keep selectors pointing at existing spectra (fill empty ones).
  useEffect(() => {
    setSelectors((sel) => {
      let changed = false
      const next = sel.map((s, i) => {
        if (registry.get(s.sourceId)) return s
        changed = true
        const fallback = i === 0 ? (registry.get(opticalId) ?? sources[0]) : null
        return { ...s, sourceId: fallback?.id ?? null }
      })
      return changed ? next : sel
    })
  }, [sources, opticalId])

  // Snapshots are added to the graph automatically for comparison.
  const known = useRef(new Set<string>())
  useEffect(() => {
    const fresh = sources.filter((s) => s.isSnapshot && !known.current.has(s.id))
    known.current = new Set(sources.map((s) => s.id))
    if (!fresh.length) return
    setSelectors((sel) => [
      ...sel,
      ...fresh.map((f, i) => ({
        key: selectorKey++,
        sourceId: f.id,
        color: GRAPH_COLORS[(sel.length + i) % GRAPH_COLORS.length].value,
      })),
    ])
  }, [sources])

  const series = useCallback((): Series[] => {
    const fg = readPalette().fg
    return selectors.flatMap((s) => {
      const src = registry.get(s.sourceId)
      return src?.data ? [{ data: src.data, color: resolveColor(s.color, fg), name: src.name }] : []
    })
  }, [selectors])

  const options = { mode, cfl, fraunhofer, targets }

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, mouse: Point | null) => {
      layout.current = drawGraph(ctx, w, h, { mode, cfl, fraunhofer, targets, mouse, series: series(), palette: readPalette() })
    },
    [mode, cfl, fraunhofer, targets, series],
  )

  const nearTarget = (p: Point, tol: number) => {
    const L = layout.current
    if (!L) return -1
    return targets.findIndex((t) => Math.abs(wToX(L, t.wavelength) - p.x) < tol && Math.abs(iToY(L, t.intensity) - p.y) < tol)
  }

  const onPointer = (p: Point) => {
    const L = layout.current
    if (!L || !insidePlot(L, p.x, p.y)) return
    const i = nearTarget(p, 10)
    if (i >= 0) setTargets((t) => t.filter((_, j) => j !== i))
    else setTargets((t) => [...t, { wavelength: xToW(L, p.x), intensity: yToI(L, p.y) }])
  }

  const onContext = (p: Point) => {
    const i = nearTarget(p, 14)
    if (i >= 0) setTargets((t) => t.filter((_, j) => j !== i))
  }

  const update = (key: number, patch: Partial<Selector>) =>
    setSelectors((sel) => sel.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const add = () =>
    setSelectors((sel) => {
      const used = new Set(sel.map((s) => s.sourceId))
      const next = sources.find((s) => !used.has(s.id)) ?? sources[0]
      return [...sel, { key: selectorKey++, sourceId: next?.id ?? null, color: GRAPH_COLORS[sel.length % GRAPH_COLORS.length].value }]
    })

  const bound = selectors.map((s) => registry.get(s.sourceId))

  return (
    <>
      <Toolbar>
        <ToggleGroup type="single" size="sm" variant="outline" spacing={0} value={mode} onValueChange={(v) => v && setMode(v as GraphMode)}>
          <ToggleGroupItem value="intensity">Intensity</ToggleGroupItem>
          <ToggleGroupItem value="colored">Colored</ToggleGroupItem>
          <ToggleGroupItem value="rgb">RGB</ToggleGroupItem>
        </ToggleGroup>
        <Toggle size="sm" variant="outline" pressed={cfl} onPressedChange={setCfl} title="Reference lines of a compact fluorescent lamp">
          CFL lines
        </Toggle>
        <Toggle size="sm" variant="outline" pressed={fraunhofer} onPressedChange={setFraunhofer} title="Solar absorption lines">
          Fraunhofer
        </Toggle>
        <div className="ml-auto flex items-center gap-1">
          {targets.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTargets([])}>
              <EraserIcon /> Clear markers
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!sources.length}
            onClick={() =>
              onExport({
                title: "Export graph",
                series: series(),
                optical: registry.get(selectors[0]?.sourceId)?.data ?? null,
                graph: (ctx, w, h) => drawGraph(ctx, w, h, { ...options, series: series(), palette: readPalette() }),
              })
            }
          >
            <FileDownIcon /> Export
          </Button>
        </div>
      </Toolbar>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5">
        {selectors.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 rounded-lg border bg-background/40 p-0.5">
            <ColorSelect value={s.color} onChange={(color) => update(s.key, { color })} />
            <SourceSelect sources={sources} value={s.sourceId} onChange={(id) => update(s.key, { sourceId: id })} className="w-36 sm:w-48" />
            {i > 0 && (
              <IconButton label="Remove from graph" className="size-7" onClick={() => setSelectors((sel) => sel.filter((x) => x.key !== s.key))}>
                <XIcon />
              </IconButton>
            )}
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={add} disabled={!sources.length}>
          <PlusIcon /> Add spectrum
        </Button>
        {mode !== "intensity" && selectors.length > 1 && (
          <span className="text-xs text-muted-foreground">{mode === "rgb" ? "RGB" : "Colored"} view shows the first spectrum.</span>
        )}
        {sources.length > 0 && (
          <span className="ml-auto hidden pr-1 text-xs text-muted-foreground md:inline">Click the graph to place a marker · click it again to remove</span>
        )}
      </div>
      <div className="relative min-h-[240px] flex-1">
        <Plot
          className="absolute inset-0 cursor-crosshair"
          render={render}
          sources={bound}
          trackMouse
          onPlotPointer={onPointer}
          onPlotContextMenu={onContext}
          aria-label="Intensity over wavelength"
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function DifferenceView({ sources, onExport }: { sources: readonly Source[]; onExport: (r: ExportRequest) => void }) {
  const [a, setA] = useState<string | null>(null)
  const [b, setB] = useState<string | null>(null)
  const [mode, setMode] = useState<"intensity" | "rgb">("intensity")

  useEffect(() => {
    const nextA = registry.get(a) ? a : (sources[0]?.id ?? null)
    if (nextA !== a) setA(nextA)
    if (!registry.get(b) || (b === nextA && sources.length > 1)) setB(sources.find((s) => s.id !== nextA)?.id ?? nextA)
  }, [sources, a, b])

  const series = useCallback((): Series[] => {
    const da = registry.get(a)?.data
    const db = registry.get(b)?.data
    if (!da || !db) return []
    const name = `${registry.get(a)!.name} − ${registry.get(b)!.name}`
    return [{ data: subtract(da, db), color: readPalette().fg, name }]
  }, [a, b])

  const range = (s: Series[]) => {
    let min = 0
    const d = s[0]?.data
    if (d) {
      const chans = mode === "rgb" ? [d.r, d.g, d.b] : [d.intensity]
      for (const ch of chans) for (const v of ch) if (v < min) min = v
    }
    return { iMin: Math.max(-1, Math.floor(min * 4) / 4), iMax: 1 }
  }

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, mouse: Point | null) => {
      const s = series()
      drawGraph(ctx, w, h, { mode, series: s, mouse, palette: readPalette(), ...range(s) })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, series],
  )

  return (
    <>
      <Toolbar>
        <SourceSelect sources={sources} value={a} onChange={setA} className="w-36 sm:w-48" />
        <MinusIcon className="size-4 text-muted-foreground" aria-label="minus" />
        <SourceSelect sources={sources} value={b} onChange={setB} className="w-36 sm:w-48" />
        <ToggleGroup type="single" size="sm" variant="outline" spacing={0} value={mode} onValueChange={(v) => v && setMode(v as "intensity" | "rgb")}>
          <ToggleGroupItem value="intensity">Intensity</ToggleGroupItem>
          <ToggleGroupItem value="rgb">RGB</ToggleGroupItem>
        </ToggleGroup>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={!sources.length}
          onClick={() =>
            onExport({
              title: "Export difference",
              series: series(),
              optical: null,
              graph: (ctx, w, h) => {
                const s = series()
                drawGraph(ctx, w, h, { mode, series: s, palette: readPalette(), ...range(s) })
              },
            })
          }
        >
          <FileDownIcon /> Export
        </Button>
      </Toolbar>
      <div className="relative min-h-[240px] flex-1">
        <Plot className="absolute inset-0 cursor-crosshair" render={render} sources={[registry.get(a), registry.get(b)]} trackMouse aria-label="Difference spectrum" />
        {sources.length < 2 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">
            Subtract one spectrum from another — e.g. a sample from a blank reference. Take a snapshot first.
          </p>
        )}
      </div>
    </>
  )
}
