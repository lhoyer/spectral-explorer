import { useCallback, useEffect, useRef, useState } from "react"
import {
  CameraIcon,
  DownloadIcon,
  EllipsisIcon,
  FolderOpenIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { addDemo, cameraSupported, connectCamera, openFiles } from "@/lib/actions"
import { DEMOS } from "@/lib/demo"
import { timestamp } from "@/lib/download"
import { drawRuler, readPalette, Waterfall } from "@/lib/draw"
import { registry, saveSource, snapshot, type Source } from "@/lib/sources"
import { IconButton, Panel, SourceSelect, Toolbar } from "./common"
import { Plot } from "./Plot"

interface Props {
  sources: readonly Source[]
  sourceId: string | null
  onSourceChange: (id: string) => void
  onConfigure: () => void
}

export function OpticalPanel({ sources, sourceId, onSourceChange, onConfigure }: Props) {
  const source = registry.get(sourceId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wfRef = useRef<Waterfall | null>(null)
  const [frozen, setFrozen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [hasData, setHasData] = useState(false)

  useEffect(() => setFrozen(source?.frozen ?? false), [source])

  const sourceIdRef = useRef(sourceId)

  // Size the canvas in CSS pixels: one row per measurement.
  useEffect(() => {
    const c = canvasRef.current!
    wfRef.current = new Waterfall(c)
    const ro = new ResizeObserver(([e]) => {
      c.width = Math.max(1, Math.round(e.contentRect.width))
      c.height = Math.max(1, Math.round(e.contentRect.height))
      const s = registry.get(sourceIdRef.current)
      wfRef.current!.clear()
      if (s?.data) wfRef.current!.fill(s.data)
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    sourceIdRef.current = sourceId
    const wf = wfRef.current!
    wf.clear()
    setHasData(!!source?.data)
    if (!source) return
    if (source.data) wf.fill(source.data)
    return source.changed.on(() => {
      if (!source.data) return
      setHasData(true)
      if (source.live && !source.frozen) wf.push(source.data)
      else wf.fill(source.data)
    })
  }, [source, sourceId])

  const toggleFreeze = useCallback(() => {
    if (!source) return
    source.setFrozen(!source.frozen)
    setFrozen(source.frozen)
  }, [source])

  // Space bar freezes / resumes (like the "Freeze" button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, select, button, [role=dialog], [role=menu], [role=listbox]")) return
      e.preventDefault()
      toggleFreeze()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleFreeze])

  const save = async () => {
    if (!source) return
    const slug = source.name.replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "") || "spectrum"
    await saveSource(source, `${slug}_${timestamp()}`)
    toast.success("Spectrum saved", { description: "The PNG keeps its calibration — open it here again any time." })
  }

  const doSnapshot = () => {
    if (!source) return
    const snap = snapshot(source)
    if (snap) toast.success(`Added “${snap.name}”`, { description: "Compare it with the live spectrum in the graph below." })
  }

  const stills = sources.filter((s) => !s.live)

  return (
    <Panel className="flex-1">
      <Toolbar>
        <SourceSelect sources={sources} value={sourceId} onChange={onSourceChange} className="w-44 sm:w-60" />
        <IconButton label="Configure (camera, crop & calibration)" onClick={onConfigure} disabled={!source}>
          <SlidersHorizontalIcon />
        </IconButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={frozen ? "secondary" : "ghost"}
              onClick={toggleFreeze}
              disabled={!source?.live}
              aria-pressed={frozen}
            >
              {frozen ? <PlayIcon /> : <PauseIcon />}
              <span className="hidden sm:inline">{frozen ? "Resume" : "Freeze"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Freeze / resume the live spectrum (Space)</TooltipContent>
        </Tooltip>
        <IconButton label="Snapshot — keep the current spectrum for comparison" onClick={doSnapshot} disabled={!hasData}>
          <CameraIcon />
        </IconButton>
        <IconButton label="Save image with calibration (.png)" onClick={save} disabled={!hasData}>
          <DownloadIcon />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="More" disabled={!source}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <PencilIcon /> Rename…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => source && registry.remove(source)}>
              <XIcon /> {source?.live ? "Disconnect camera" : "Remove this spectrum"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!stills.length}
              onSelect={() => stills.forEach((s) => registry.remove(s))}
            >
              <Trash2Icon /> Remove all saved & snapshot spectra
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {frozen && <span className="ml-auto pr-1 text-xs font-medium text-amber-500">Frozen</span>}
      </Toolbar>
      <div className="relative min-h-0 flex-1 bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 size-full" role="img" aria-label="Optical spectrum view" />
        {!sources.length && <EmptyState />}
      </div>
      <div className="h-5 border-t bg-card px-0">
        <Plot sources={[source]} render={(ctx, w, h) => drawRuler(ctx, w, h, source?.data ?? null, readPalette())} aria-label="Wavelength (nm)" />
      </div>
      {source && renaming && <RenameDialog source={source} onClose={() => setRenaming(false)} />}
    </Panel>
  )
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
      <p className="text-sm text-white/70">Connect the spectrometer, open a saved spectrum, or try a demo.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {cameraSupported() && (
          <Button size="sm" onClick={() => connectCamera()}>
            <CameraIcon /> Connect camera
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => openFiles()}>
          <FolderOpenIcon /> Open saved spectrum
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary">
              <SparklesIcon /> Try a demo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {DEMOS.map((d) => (
              <DropdownMenuItem key={d.kind} onSelect={() => addDemo(d.kind)} className="flex-col items-start gap-0">
                <span>{d.name}</span>
                <span className="text-xs text-muted-foreground">{d.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function RenameDialog({ source, onClose }: { source: Source; onClose: () => void }) {
  const [name, setName] = useState(source.name)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) registry.rename(source, name.trim())
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename spectrum</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Name" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
