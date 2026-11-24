/** User actions shared by the header menu, empty state and drag-and-drop. */
import { toast } from "sonner"
import { BUILTIN_DEFAULT, cloneConfig } from "./config"
import { DEMOS, renderDemoFrame, type DemoKind } from "./demo"
import { pickFiles } from "./download"
import { getSettings, updateSettings } from "./settings"
import { CameraSource, ImageSource, loadFiles, registry } from "./sources"

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === "videoinput")
}

function cameraError(e: unknown) {
  const name = (e as { name?: string })?.name
  switch (name) {
    case "NotAllowedError":
      return "Camera access was blocked. Allow the camera in your browser's site settings and try again."
    case "NotFoundError":
      return "No camera found. Plug in the spectrometer and try again."
    case "NotReadableError":
      return "The camera is busy — close other apps or tabs that are using it."
    case "OverconstrainedError":
      return "That camera is no longer available."
    default:
      return `Couldn't start the camera${e instanceof Error ? `: ${e.message}` : "."}`
  }
}

const SPECTROMETER = /c270|spectral/i

export async function connectCamera(deviceId?: string) {
  if (!cameraSupported()) {
    toast.error("This browser can't access cameras. Use a current version of Chrome, Edge, Firefox or Safari over https.")
    return
  }
  const cameras = () => registry.getSnapshot().filter((s): s is CameraSource => s instanceof CameraSource)
  if (deviceId && cameras().some((c) => c.deviceId === deviceId)) {
    toast.info("That camera is already connected.")
    return
  }
  try {
    let source = await CameraSource.open(deviceId)
    if (!deviceId && !SPECTROMETER.test(source.track?.label ?? "")) {
      // The default camera is often the built-in one; prefer the spectrometer.
      const preferred = (await listCameras()).find((d) => SPECTROMETER.test(d.label))
      if (preferred && preferred.deviceId !== source.deviceId) {
        source.dispose()
        source = await CameraSource.open(preferred.deviceId)
      }
    }
    if (cameras().some((c) => c.deviceId === source.deviceId)) {
      source.dispose()
      toast.info("That camera is already connected.")
      return
    }
    source.ended.on(() => {
      toast.warning(`${source.name} was disconnected.`)
      registry.remove(source)
    })
    registry.add(source)
    updateSettings({ lastCameraId: source.deviceId ?? null })
  } catch (e) {
    toast.error(cameraError(e))
  }
}

let autoConnected = false
/** Reconnects the last used camera if the browser already granted access. */
export async function autoConnect() {
  if (autoConnected) return
  autoConnected = true
  try {
    const status = await navigator.permissions?.query({ name: "camera" as PermissionName })
    if (status?.state !== "granted") return
    const last = getSettings().lastCameraId
    const device = (await listCameras()).find((d) => d.deviceId === last)
    if (device) await connectCamera(device.deviceId)
  } catch {
    /* permissions API unsupported for camera (e.g. Firefox) */
  }
}

export async function openFiles(files?: File[]) {
  files ??= await pickFiles("image/png,image/jpeg,.png,.jpg,.jpeg,.config")
  if (!files.length) return
  const { added, skipped } = await loadFiles(files)
  if (added.length) toast.success(added.length === 1 ? `Opened ${added[0].name}` : `Opened ${added.length} spectra`)
  else if (!skipped.length) toast.info("Choose an image (.png/.jpg) along with its .config file.")
  if (skipped.length) toast.error(`Couldn't open ${skipped.join(", ")}`)
}

export function addDemo(kind: DemoKind) {
  const demo = DEMOS.find((d) => d.kind === kind)!
  const src = new ImageSource(registry.availableName(`Demo · ${demo.name}`), renderDemoFrame(kind), cloneConfig(BUILTIN_DEFAULT))
  registry.add(src)
  src.redraw()
}
