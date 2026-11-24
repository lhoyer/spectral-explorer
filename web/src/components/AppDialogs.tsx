import type { ReactNode } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { updateSettings, useSettings } from "@/lib/settings"
import { CameraSource, registry } from "@/lib/sources"

const RESOLUTIONS = ["640x480", "1280x720", "1280x960", "1920x1080"]

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSettings()

  const setResolution = async (resolution: string) => {
    updateSettings({ resolution })
    const cams = registry.getSnapshot().filter((x): x is CameraSource => x instanceof CameraSource)
    for (const c of cams) await c.restart().catch(() => toast.error(`Couldn't restart ${c.name}`))
    if (cams.length) toast.success(`Camera resolution set to ${resolution.replace("x", " × ")}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved in this browser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Row label="Camera resolution" hint="The Logitech C270 delivers 1280 × 960.">
            <Select value={s.resolution} onValueChange={setResolution}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace("x", " × ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Separator />
          <Row label="Add saved spectra to the list" hint="Saving also keeps the spectrum as a snapshot.">
            <Switch checked={s.keepSavedAsSnapshot} onCheckedChange={(v) => updateSettings({ keepSavedAsSnapshot: v })} />
          </Row>
          <Row label="Also download a .config file" hint="For opening saved images in the desktop app.">
            <Switch checked={s.saveConfigFile} onCheckedChange={(v) => updateSettings({ saveConfigFile: v })} />
          </Row>
          <Row label="Pause filter while configuring" hint="Slit and focus changes show up immediately.">
            <Switch
              checked={s.disableFilterWhileConfiguring}
              onCheckedChange={(v) => updateSettings({ disableFilterWhileConfiguring: v })}
            />
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="flex-col items-start gap-0.5 font-normal">
        <span>{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  )
}

const REPO = "https://github.com/jbobrow/Spectral-Explorer"

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Getting started</DialogTitle>
          <DialogDescription>Measure spectra with the 3D-printed Spectral-Explorer and a USB webcam.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm leading-relaxed [&_h3]:font-medium [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:text-muted-foreground">
          <section>
            <h3>1. Connect</h3>
            <p>Plug in the spectrometer and choose <b>Add → camera</b>. Allow camera access when the browser asks.</p>
          </section>
          <section>
            <h3>2. Align, slit and exposure</h3>
            <ol>
              <li>Aim the spectrometer at the light source and open <b>Configure</b>.</li>
              <li>If the bright band isn't near the vertical middle of the camera view, adjust your setup.</li>
              <li>Close the slit evenly with both knurled nuts until no pure white areas appear. Never force it shut.</li>
              <li>Click the camera view to place the yellow line on a middle row, where the spectrum is sharpest.</li>
            </ol>
          </section>
          <section>
            <h3>3. Calibrate with a fluorescent lamp</h3>
            <p>
              Point at a compact fluorescent lamp. In the calibration strip, select <b>436.6 nm</b> and click the middle blue line, then select{" "}
              <b>611.6 nm</b> and click the brightest red line. Press <b>OK</b>, and use <b>Configuration → Set as default</b> to remember it.
            </p>
          </section>
          <section>
            <h3>4. Measure and compare</h3>
            <ol>
              <li>
                <b>Freeze</b> (Space) holds the live spectrum; <b>Snapshot</b> keeps a copy to compare in the graph.
              </li>
              <li>Click the graph to place a wavelength / intensity marker; click it again to remove it.</li>
              <li>
                <b>Difference</b> subtracts one spectrum from another — useful for absorption with a blank reference.
              </li>
              <li>
                <b>Save</b> downloads a PNG that keeps its calibration. <b>Export</b> writes CSV data or a graph image.
              </li>
            </ol>
          </section>
          <section>
            <h3>Safety</h3>
            <p>
              The slit uses strong magnets — keep them away from pacemakers, cards and other magnets. Keep distance from hot light sources and
              never nick the razor-blade edges.
            </p>
          </section>
          <p>
            Full guide and hardware:{" "}
            <a className="text-foreground underline underline-offset-4" href={`${REPO}/blob/main/docs/user_guide.md`} target="_blank" rel="noreferrer">
              User guide
            </a>{" "}
            ·{" "}
            <a className="text-foreground underline underline-offset-4" href={`${REPO}/blob/main/hardware/assembly_instructions.md`} target="_blank" rel="noreferrer">
              Build instructions
            </a>{" "}
            ·{" "}
            <a className="text-foreground underline underline-offset-4" href="https://spectral-explorer.de/" target="_blank" rel="noreferrer">
              spectral-explorer.de
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
