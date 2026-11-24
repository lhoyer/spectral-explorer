# Spectral-Explorer Web

A browser version of the Spectral-Explorer desktop app. It runs on Chromebooks, Macs and PCs with nothing to install: plug in the spectrometer and open the page.

It's built with React, Vite, Tailwind and [shadcn/ui](https://ui.shadcn.com) (Radix primitives). It's fully static, so it can be hosted on GitHub Pages.

## Features (parity with the desktop app)

- Live camera capture via `getUserMedia`, with spectrum extraction from a selectable camera row
- Optical (waterfall) view, plus intensity, colored-intensity and RGB graphs
- Several spectra compared in one graph, each in its own color, with click-to-place measurement markers
- Difference view (A − B)
- Noise filter (frame averaging), left/right crop and 90° rotation
- Two-point CFL wavelength calibration (436.6 nm / 611.6 nm) with CFL and Fraunhofer reference lines
- Camera exposure, white balance and focus where the browser exposes them (Chrome / ChromeOS)
- Save spectra as PNG. The calibration is embedded in the PNG, and an optional `.config` file can be downloaded too
- Open saved spectra (`.png`/`.jpg` + `.config`, including files saved by the desktop app) by picker or drag-and-drop
- Export CSV (standard or European format) and PNG graph images
- Snapshots for quick comparisons, demo spectra (CFL, sunlight, white LED), light and dark themes

`.config` files use the same `[Camera]` / `[WavelengthConfiguration]` keys as the desktop app, so the two can share calibrations. Browser-only values are stored in extra `[Web]` / `[WebCamera]` groups, which the desktop app ignores.

## Develop

```bash
cd web
npm install
npm run dev
```

Camera access requires a secure context: `localhost` during development, and HTTPS in production (GitHub Pages provides HTTPS).

## Deploy to GitHub Pages

The `.github/workflows/deploy-web.yml` workflow builds `web/` and publishes `web/dist` on every push to `main` that touches `web/`. To enable it once, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

The build uses relative asset paths (`base: './'`), so it works at any subpath, such as `https://<user>.github.io/Spectral-Explorer/`.

## Code map

| Path | Ported from |
| --- | --- |
| `src/lib/spectrum.ts` | `spectrum/spectrum_data.cpp`: extraction, calibration, difference, CSV |
| `src/lib/config.ts` | `spectrum/spectrum_config.cpp`: config and INI `.config` files |
| `src/lib/sources.ts` | `camera/*`, `spectrum/spectrum.cpp`, `spectrum_disposer.cpp` |
| `src/lib/draw.ts` | `spectrum/spectrum_*_drawing.cpp`, camera / calibration views |
| `src/components/ConfigDialog.tsx` | `gui/config_dialog.cpp` |
| `src/components/AnalysisPanel.tsx` | `gui/spectrum_graph_dock.cpp`, `spectrum_combination_dock.cpp` |
| `src/components/OpticalPanel.tsx` | `gui/spectrum_optical_dock.cpp` |
| `src/components/ExportDialog.tsx` | `gui/export_dialog.cpp` |
