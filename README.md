# Spectral-Explorer

*Language: English | [Deutsch](README.de.md)*

**Spectral-Explorer** is a USB-based optical spectrometer and companion Qt/C++ desktop application designed for science education (physics, chemistry, and biology) as well as hobbyist and lab experiments. Originally awarded a special prize at the 50th German *Jugend forscht* national competition, it makes quantitative spectral measurements accessible without expensive laboratory equipment.

More information about the hardware and project background is available at [spectral-explorer.de](https://spectral-explorer.de/).

<p align="center">
  <img src="https://spectral-explorer.de/wp-content/uploads/2018/03/Rev6-7.jpg" alt="Spectral-Explorer Hardware" width="100%" />
</p>

## Web App (Chromebook, Mac, PC)

A browser version of the software lives in [`web/`](web/). It needs no installation and runs anywhere Chrome, Edge, Firefox or Safari does, including Chromebooks. It is deployed to GitHub Pages by [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml). See [`web/README.md`](web/README.md) for details.

## Overview

* **Measurement range:** 400–650 nm (visible spectrum)
* **Wavelength resolution:** Up to 1 nm
* **Adjustable optical slit:** Fine-tunable for different light intensities and sources
* **USB connectivity:** Powered by a standard USB webcam (Logitech C270) for live demonstrations via projector or individual student experiments
* **Expandable hardware:** Supports an optional cuvette holder for liquid absorption/transmission measurements and includes a 1/4″ tripod thread
* **3D-printable case & cuvette holder:** STL meshes, FreeCAD source files, and print profiles are included in [`hardware/case/`](hardware/case/) and [`hardware/cuvette_holder/`](hardware/cuvette_holder/), with step-by-step build instructions in [`hardware/assembly_instructions.md`](hardware/assembly_instructions.md)
* **User guide:** Safety notes, slit adjustment, CFL wavelength calibration, and software usage are documented in [`docs/user_guide.md`](docs/user_guide.md)

## Applications

Spectral-Explorer can be used across physics, chemistry, and biology experiments (see [spectral-explorer.de/kategorie/experimente](https://spectral-explorer.de/kategorie/experimente/)):

* **Flame Spectroscopy** — Identify elements via their characteristic emission lines.
* **Fraunhofer Lines** — Observe solar absorption lines in daylight spectra.
* **Fluorescent Lamp Spectra** — Analyze discrete gas-discharge emission lines (also used for 436 nm / 611 nm calibration).
* **Indicator Absorption (Red Cabbage Juice)** — Measure pH-dependent absorption shifts using the cuvette holder.
* **Juice Differentiation** — Compare absorption spectra of different liquid samples.

<p align="center">
  <img src="https://spectral-explorer.de/wp-content/uploads/2015/07/Flammenspektroskopie3.png" alt="Flame Spectroscopy" width="46%" />
  &nbsp;
  <img src="https://spectral-explorer.de/wp-content/uploads/2015/07/Fraunhoferlinien2.png" alt="Fraunhofer Lines" width="46%" />
</p>
<p align="center">
  <img src="https://spectral-explorer.de/wp-content/uploads/2015/07/Indikator.jpg" alt="Red Cabbage Indicator Absorption" width="46%" />
  &nbsp;
  <img src="https://spectral-explorer.de/wp-content/uploads/2015/07/Saftspektroskopie2.png" alt="Juice Differentiation" width="46%" />
</p>

## Software Features

* Live camera capture and real-time spectrum extraction
* Optical spectrum view and intensity graph view
* Multiple spectrum comparison with automatic color cycling
* Noise reduction / filtering options
* CFL spectral line calibration (436 nm and 611 nm)
* Save, load, and export spectrum data and images

## Download & Install (Windows)

Pre-built binaries are available on the [GitHub Releases](https://github.com/lhoyer/spectral-explorer/releases) page — no compilation or Qt/OpenCV installation is required:

* **Windows Installer (recommended):** Download `Spectral-Explorer-<version>-Setup.exe` and run it to install the application with Start Menu / Desktop shortcuts.
* **Portable Archive (no admin rights required):** Download `Spectral-Explorer-<version>-portable.zip`, extract all files to a folder of your choice, and run `Spectral-Explorer.exe`.

**Next steps:** Read the **[User Guide](docs/user_guide.md)** for safety notes, slit adjustment, CFL wavelength calibration (436 nm / 611 nm), and software usage.

## Hardware

**Want to build your own?** The spectrometer uses a 3D-printed matte black housing for low-cost, reproducible assembly. Follow the step-by-step **[Hardware Assembly Guide](hardware/assembly_instructions.md)** and find all `.stl` meshes, FreeCAD source files (`.FCStd`), and print profiles (`.ini`) in [`hardware/case/`](hardware/case/) and [`hardware/cuvette_holder/`](hardware/cuvette_holder/).

* **Housing & lid:** Main body ([`case.stl`](hardware/case/case.stl)), top lid ([`cap.stl`](hardware/case/cap.stl)), cover plates ([`plate_front.stl`](hardware/case/plate_front.stl), [`plate_right.stl`](hardware/case/plate_right.stl)), and internal nut holder ([`nut_holder.stl`](hardware/case/nut_holder.stl)) — printed in matte black to minimize internal reflections.
* **Optical slit:** Two razor-blade halves—a fixed left half ([`aperture.stl`](hardware/case/aperture.stl)) and a magnetically held right half ([`aperture_magnet.stl`](hardware/case/aperture_magnet.stl))—adjusted via knurled nuts for fine slit-width control.
* **Diffraction grating:** A small piece cut from a standard DVD-R/DVD+R disperses incoming light into its spectrum.
* **Sensor:** A modified **Logitech C270** USB webcam (focus ring manually adjusted and status LED covered) captures the dispersed spectrum.
* **Cuvette holder (optional):** A clip-on [`cuvette_holder.stl`](hardware/cuvette_holder/cuvette_holder.stl) with cap ([`cuvette_cap.stl`](hardware/cuvette_holder/cuvette_cap.stl)) enables liquid absorption and transmission measurements.
* **Mounting:** Integrated 1/4″ tripod thread ([`tripod_nut_cover.stl`](hardware/case/tripod_nut_cover.stl)).

<p align="center">
  <img src="docs/images/case_stl.jpg" alt="3D-printable Spectrometer Case STL preview" width="65%" />
</p>

## Building from Source (Developers)

*Regular users do not need this section — use the pre-built installer or portable zip from [Download & Install (Windows)](#download--install-windows) above.*

<details>
<summary>Click to expand Windows build, deployment, and packaging instructions</summary>

### System Setup (Windows)

The project targets **Qt 5.11.3 (MinGW 32-bit)** and **OpenCV 2.4.13 (MinGW)** installed at `C:/opencv-2-4-13/install/` (as configured in `spectral_explorer.pro`).

*Note: OpenCV 3.4.5 is intentionally avoided because it does not allow using the full native resolution of the Logitech C270 webcam (it scales up the image instead).*

### 1. Install Prerequisites

Install **Python 3** and **CMake** (for example via `winget`):

```powershell
winget install --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
winget install --id Kitware.CMake --accept-source-agreements --accept-package-agreements
```

### 2. Install Qt 5.11.3 and MinGW 5.3.0

Using [`aqtinstall`](https://github.com/miurahr/aqtinstall) (no Qt account required):

```powershell
pip install aqtinstall
aqt install-qt windows desktop 5.11.3 win32_mingw53 -O C:\Qt
aqt install-tool windows desktop tools_mingw qt.tools.win32_mingw530 -O C:\Qt
```

### 3. Build and Install OpenCV 2.4.13

1. Download and extract the OpenCV 2.4.13 source archive to `C:\opencv-2-4-13\opencv-2.4.13`:
   ```powershell
   New-Item -ItemType Directory -Force -Path C:\opencv-2-4-13
   Invoke-WebRequest -Uri https://github.com/opencv/opencv/archive/refs/tags/2.4.13.zip -OutFile C:\opencv-2-4-13\opencv-2.4.13.zip
   Expand-Archive -Path C:\opencv-2-4-13\opencv-2.4.13.zip -DestinationPath C:\opencv-2-4-13 -Force
   ```
2. If you are using **CMake 4.x**, update `C:\opencv-2-4-13\opencv-2.4.13\CMakeLists.txt` so it does not fail on removed legacy policies:
   * Change `CMP0022`, `CMP0026`, and `CMP0042` from `OLD` to `NEW`.
   * Comment out `include(cmake/OpenCVGenPkgconfig.cmake)` and `include(cmake/OpenCVGenConfig.cmake)`.
3. Configure, build, and install (`core`, `imgproc`, and `highgui` are the modules required by `spectral_explorer.pro`):
   ```powershell
   $env:PATH = "C:\Qt\Tools\mingw530_32\bin;C:\Program Files\CMake\bin;" + $env:PATH
   cmake -S C:\opencv-2-4-13\opencv-2.4.13 -B C:\opencv-2-4-13\build -G "MinGW Makefiles" `
     "-DCMAKE_POLICY_VERSION_MINIMUM=3.5" `
     "-DCMAKE_INSTALL_PREFIX=C:/opencv-2-4-13/install" `
     "-DCMAKE_BUILD_TYPE=Release" `
     -DBUILD_TESTS=OFF -DBUILD_PERF_TESTS=OFF -DBUILD_EXAMPLES=OFF -DBUILD_DOCS=OFF `
     -DBUILD_opencv_apps=OFF -DWITH_FFMPEG=OFF -DENABLE_PRECOMPILED_HEADERS=OFF `
     -DBUILD_opencv_calib3d=OFF -DBUILD_opencv_contrib=OFF -DBUILD_opencv_features2d=OFF `
     -DBUILD_opencv_flann=OFF -DBUILD_opencv_gpu=OFF -DBUILD_opencv_legacy=OFF `
     -DBUILD_opencv_ml=OFF -DBUILD_opencv_nonfree=OFF -DBUILD_opencv_objdetect=OFF `
     -DBUILD_opencv_ocl=OFF -DBUILD_opencv_photo=OFF -DBUILD_opencv_stitching=OFF `
     -DBUILD_opencv_superres=OFF -DBUILD_opencv_ts=OFF -DBUILD_opencv_video=OFF `
     -DBUILD_opencv_videostab=OFF
   cmake --build C:\opencv-2-4-13\build -j 8 --target install
   ```

### Building Spectral-Explorer

Open `spectral_explorer.pro` in Qt Creator (Release configuration) or build from PowerShell:

```powershell
$env:PATH = "C:\Qt\5.11.3\mingw53_32\bin;C:\Qt\Tools\mingw530_32\bin;" + $env:PATH
New-Item -ItemType Directory -Force -Path build_windows
Push-Location build_windows
qmake ..\spectral_explorer.pro CONFIG+=release
mingw32-make -j 8
Pop-Location
```

The compiled binary will be at `build_windows\release\Spectral-Explorer.exe`. To deploy all required Qt, MinGW, and OpenCV DLLs next to the `.exe` so it runs standalone:

```powershell
$env:PATH = "C:\Qt\5.11.3\mingw53_32\bin;C:\Qt\Tools\mingw530_32\bin;" + $env:PATH
windeployqt --release build_windows\release\Spectral-Explorer.exe
Copy-Item C:\opencv-2-4-13\install\x86\mingw\bin\libopencv_core2413.dll, `
          C:\opencv-2-4-13\install\x86\mingw\bin\libopencv_highgui2413.dll, `
          C:\opencv-2-4-13\install\x86\mingw\bin\libopencv_imgproc2413.dll `
          -Destination build_windows\release\ -Force
```

### Packaging for Distribution

To create a clean portable `.zip` and a Windows installer (using [Inno Setup](https://jrsoftware.org/isinfo.php)) in `dist\`:

```powershell
$dist = "dist\Spectral-Explorer-1.6.0-win32"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Copy-Item build_windows\release\Spectral-Explorer.exe, build_windows\release\*.dll, LICENSE -Destination $dist -Force
Copy-Item build_windows\release\audio, build_windows\release\bearer, build_windows\release\iconengines, `
          build_windows\release\imageformats, build_windows\release\mediaservice, build_windows\release\platforms, `
          build_windows\release\playlistformats, build_windows\release\styles, build_windows\release\translations `
          -Destination $dist -Recurse -Force
Compress-Archive -Path "$dist\*" -DestinationPath "dist\Spectral-Explorer-1.6.0-portable.zip" -Force

# Build the Windows installer (requires Inno Setup 6)
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" win_resources\installer.iss
```

### Running Automated Tests

```powershell
$env:PATH = "C:\Qt\5.11.3\mingw53_32\bin;C:\Qt\Tools\mingw530_32\bin;C:\opencv-2-4-13\install\x86\mingw\bin;" + $env:PATH
$env:QT_PLUGIN_PATH = "C:\Qt\5.11.3\mingw53_32\plugins"
New-Item -ItemType Directory -Force -Path build_tests
Push-Location build_tests
qmake ..\tests\tests.pro CONFIG+=release
mingw32-make -j 8
Pop-Location
.\build_tests\release\spectral_explorer_tests.exe -platform offscreen
```

</details>

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](LICENSE) license — free for non-commercial use with attribution and ShareAlike.
