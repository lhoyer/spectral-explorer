import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { downloadBlob, timestamp } from "@/lib/download"
import { drawOpticalStrip, type Series } from "@/lib/draw"
import { exportCSV, type SpectrumData } from "@/lib/spectrum"

export interface ExportRequest {
  title: string
  series: Series[]
  /** Spectrum for the optical strip on top of an exported image. */
  optical: SpectrumData | null
  graph: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

const STORE = "spectral-explorer.export"
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}")
  } catch {
    return {}
  }
}

export function ExportDialog({ request, onClose }: { request: ExportRequest; onClose: () => void }) {
  const saved = load()
  const [format, setFormat] = useState<"csv" | "png">(saved.format ?? "csv")
  const [european, setEuropean] = useState<boolean>(saved.european ?? false)
  const [width, setWidth] = useState<number>(saved.width ?? 1280)
  const [height, setHeight] = useState<number>(saved.height ?? 720)
  const [withGraph, setWithGraph] = useState<boolean>(saved.withGraph ?? true)
  const [withOptical, setWithOptical] = useState<boolean>(saved.withOptical ?? true)
  const hasOptical = !!request.optical

  const run = async () => {
    localStorage.setItem(STORE, JSON.stringify({ format, european, width, height, withGraph, withOptical }))
    const stamp = timestamp()
    if (format === "csv") {
      const csv = exportCSV(
        request.series.map((s) => ({ name: s.name, data: s.data })),
        european,
      )
      downloadBlob(new Blob([csv], { type: "text/csv" }), `spectrum_${stamp}.csv`)
    } else {
      const w = Math.min(8000, Math.max(200, width | 0))
      const h = Math.min(8000, Math.max(150, height | 0))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!
      const optical = hasOptical && withOptical ? request.optical : null
      if (optical && withGraph) {
        const oh = Math.round(h / 5)
        drawOpticalStrip(ctx, optical, 0, 0, w, oh)
        ctx.translate(0, oh)
        request.graph(ctx, w, h - oh)
      } else if (optical) {
        drawOpticalStrip(ctx, optical, 0, 0, w, h)
      } else {
        request.graph(ctx, w, h)
      }
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"))
      if (blob) downloadBlob(blob, `spectrum_${stamp}.png`)
    }
    toast.success("Exported")
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>
            {request.series.length} spectrum{request.series.length === 1 ? "" : "s"}: {request.series.map((s) => s.name).join(", ")}
          </DialogDescription>
        </DialogHeader>
        <ToggleGroup type="single" variant="outline" spacing={0} value={format} onValueChange={(v) => v && setFormat(v as "csv" | "png")} className="w-full">
          <ToggleGroupItem value="csv" className="flex-1">
            Raw data (.csv)
          </ToggleGroupItem>
          <ToggleGroupItem value="png" className="flex-1">
            Image (.png)
          </ToggleGroupItem>
        </ToggleGroup>
        {format === "csv" ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="eu" className="flex-col items-start gap-0.5">
              <span>European number format</span>
              <span className="text-xs font-normal text-muted-foreground">Semicolons and decimal commas (German Excel)</span>
            </Label>
            <Switch id="eu" checked={european} onCheckedChange={setEuropean} />
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="w">Width (px)</Label>
                <Input id="w" type="number" min={200} max={8000} value={width} onChange={(e) => setWidth(+e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="h">Height (px)</Label>
                <Input id="h" type="number" min={150} max={8000} value={height} onChange={(e) => setHeight(+e.target.value)} />
              </div>
            </div>
            <div className="flex gap-5">
              <Label className="font-normal">
                <Checkbox checked={withGraph} onCheckedChange={(v) => setWithGraph(!!v)} /> Graph
              </Label>
              <Label className="font-normal" aria-disabled={!hasOptical}>
                <Checkbox checked={hasOptical && withOptical} disabled={!hasOptical} onCheckedChange={(v) => setWithOptical(!!v)} />
                Optical view
              </Label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={format === "png" && !withGraph && !(hasOptical && withOptical)}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
