# Windows Setup Guide

Run this one-time script to install everything automatically on Windows:

```powershell
cd <project-root>
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1
```

The script will:

1. Install Python 3 if missing (using winget)
2. Install required Python packages: `opencv-python`, `numpy`, `scenedetect`
3. Create a `python3` shim so Node can call `python3`
4. Install Node ffmpeg binaries (`@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`)
5. Run `npm install`

After it completes, run the app as usual:

```powershell
npm run dev:all
```

If you prefer manual steps, run `scripts/setup-windows.ps1` to see all commands executed.

