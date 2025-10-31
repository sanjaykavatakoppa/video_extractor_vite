npm install
npm run dev
```

### Windows setup

Run the automated script once to install Python, ffmpeg/ffprobe and required packages:

```
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1
```

Then start everything:

```
npm run dev:all
```

Once the UI opens, use **Batch Folder Mode** to select the original videos folder and the export folder. Click **Smart Clip Entire Folder** to process every video automatically.