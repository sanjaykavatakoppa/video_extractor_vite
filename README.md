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

### S3 folder upload

You can push an entire folder structure to S3 directly from the UI:

1. Create a `.env` file alongside `server.js` (or export environment variables) with at least:
   ```
   AWS_REGION=ap-south-1
   AWS_S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   # Optional
   # AWS_S3_PREFIX=projects/video-uploads
   # AWS_S3_PUBLIC_BASE_URL=https://cdn.example.com/video-uploads
   # AWS_S3_MAX_FILE_SIZE_MB=4096
   ```
   Restart `npm run server` after changing these values.
2. Run the backend (`npm run server`) and the Vite dev server (`npm run dev`).
3. In the app, choose **☁️ Upload to S3** from the mode selector.
4. Click the dropzone (or drag a folder) to pick a directory. Subfolders are preserved and each file shows progress.
5. Optionally override the S3 prefix before uploading. The top-level folder name is excluded by default—enable the checkbox in the uploader if you need it in S3.

Each file is streamed through the backend to S3 so progress and failures are clear, and the response provides the resulting S3 URL.