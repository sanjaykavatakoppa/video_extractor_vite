# Video Clipper Guide

## 🎬 Overview

The Video Clipper is a powerful tool for splitting videos into multiple clips based on custom time ranges. It supports both fast copying (no re-encoding) and frame-accurate encoding methods.

---

## 🚀 Quick Start

### 1. Start the Application

```bash
# Terminal 1: Start the backend server
cd /Users/sanjayak/projects/engg/video_extractor_vite
npm run server

# Terminal 2: Start the frontend
npm run dev
```

### 2. Access Video Clipper

1. Open your browser to `http://localhost:5173`
2. Click on the **✂️ Video Clipper** button in the navigation bar

---

## 📖 Features

### ✅ Video Analysis
- Get detailed video metadata (duration, resolution, codec, bitrate, etc.)
- Validate video file before processing
- Display comprehensive video information

### ✅ Custom Time Ranges
- Define precise start and end times for each clip
- Visual duration calculator
- Time format: seconds with decimal precision

### ✅ Two Processing Methods

#### ⚡ Fast Copy (Recommended for Quick Tasks)
- No re-encoding
- Very fast processing
- Maintains original quality
- **Note:** May not be frame-accurate at cut points

#### 🎯 Accurate Encode (Recommended for Precision)
- Frame-accurate cuts
- Re-encodes video
- Slower processing
- Maintains high quality (CRF 18)

### ✅ Batch Processing
- Process multiple clips at once
- Real-time progress tracking
- Detailed results summary

### ✅ Marker XML Import
- Load clips from Premiere Pro marker files
- Automatic time conversion
- Preserves clip metadata

---

## 🎯 Use Cases

### Use Case 1: Re-clip from Markers

If you have a video with marker XML (like `1PWF92_EK4Q2TFQNB_fc_markers.xml`):

1. Enter video path: `public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov`
2. Click **🔍 Analyze Video**
3. Click **📄 Load from Marker XML**
4. Review auto-loaded clips
5. Choose processing method
6. Click **🚀 Process Clips**

### Use Case 2: Custom Clipping

To create custom clips:

1. Enter video path
2. Click **🔍 Analyze Video**
3. Click **➕ Add Clip** for each desired clip
4. Set start and end times for each clip
5. Click **🚀 Process Clips**

### Use Case 3: Fix Incomplete Splits

For videos like `1PWF92_EK4Q2TFQNB_fc.mov` where only 4 of 6 clips were created:

1. Load the video
2. Load from marker XML (gets all 6 clips)
3. Process with accurate encoding
4. Get all 6 complete clips

---

## 📝 API Reference

### Analyze Video

**Endpoint:** `POST /api/analyze-video-file`

**Request:**
```json
{
  "videoPath": "public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "fileName": "1PWF92_EK4Q2TFQNB_fc.mov",
    "fileSize": "162.00 MB",
    "duration": "107.21s",
    "durationSeconds": 107.207,
    "bitrate": "12.70 Mbps",
    "video": {
      "codec": "h264",
      "resolution": "3840 x 2160",
      "width": 3840,
      "height": 2160,
      "fps": 29.97,
      "bitrate": "12.70 Mbps"
    },
    "audio": {
      "codec": "aac",
      "sampleRate": "48000",
      "channels": 2,
      "bitrate": "192.00 kbps"
    }
  }
}
```

### Clip Video

**Endpoint:** `POST /api/clip-video`

**Request:**
```json
{
  "videoPath": "public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov",
  "clips": [
    { "start": 0, "end": 17.87, "name": "0000001" },
    { "start": 17.87, "end": 35.74, "name": "0000002" },
    { "start": 35.74, "end": 53.61, "name": "0000003" }
  ],
  "outputDir": "public/Videos",
  "method": "copy"
}
```

**Response (Streaming):**
```json
{"type":"info","message":"Video duration: 107.21s","totalDuration":107.207}
{"type":"progress","current":1,"total":3,"clip":{"start":0,"end":17.87,"duration":"17.87"},"outputFile":"1PWF92_EK4Q2TFQNB_fc_0000001.mp4"}
{"type":"encoding","current":1,"total":3,"percent":45,"timemark":"00:00:08.05"}
{"type":"success","clipNumber":1,"fileName":"1PWF92_EK4Q2TFQNB_fc_0000001.mp4","requestedDuration":"17.87","actualDuration":"17.89","fileSize":"45.2 MB"}
{"type":"complete","totalClips":3,"successCount":3,"errorCount":0,"outputDir":"/path/to/output","results":[...]}
```

---

## 🧪 Testing Your Videos

### Test 1: Analyze Original Video

```bash
curl -X POST http://localhost:3001/api/analyze-video-file \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov"
  }'
```

### Test 2: Create Single Clip

```bash
curl -X POST http://localhost:3001/api/clip-video \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov",
    "clips": [
      { "start": 0, "end": 20, "name": "test_clip" }
    ],
    "method": "copy"
  }'
```

### Test 3: Re-create All 6 Clips from Markers

Based on your marker XML, here are the exact clips:

```json
{
  "videoPath": "public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov",
  "clips": [
    { "start": 0.00, "end": 17.87, "name": "0000001" },
    { "start": 17.87, "end": 35.74, "name": "0000002" },
    { "start": 35.74, "end": 53.61, "name": "0000003" },
    { "start": 53.61, "end": 71.47, "name": "0000004" },
    { "start": 71.47, "end": 89.34, "name": "0000005" },
    { "start": 89.34, "end": 107.21, "name": "0000006" }
  ],
  "outputDir": "public/Videos-Complete",
  "method": "encode"
}
```

---

## 📊 Expected Results

### Your Video: 1PWF92_EK4Q2TFQNB_fc.mov

**Original Video:**
- Duration: 107.21 seconds
- 6 clips defined in marker XML

**Expected Output (All 6 clips):**

| Clip | Start | End | Duration | Status |
|------|-------|-----|----------|--------|
| 0000001 | 0.00s | 17.87s | 17.87s | ✅ Should match existing split 1 |
| 0000002 | 17.87s | 35.74s | 17.87s | ✅ Should match existing split 2 |
| 0000003 | 35.74s | 53.61s | 17.87s | ⚠️ Existing split 3 is shorter (14.31s) |
| 0000004 | 53.61s | 71.47s | 17.87s | ⚠️ Existing split 4 is longer (20.32s) |
| 0000005 | 71.47s | 89.34s | 17.87s | ❌ Missing (not created) |
| 0000006 | 89.34s | 107.21s | 17.87s | ❌ Missing (not created) |

**Total Duration Check:**
- 6 clips × 17.87s = 107.22s ≈ 107.21s ✅ Matches original

---

## ⚙️ Configuration

### Output Settings

**Default Output Directory:** Same as input video directory

**Custom Output Directory:** Specify in the UI or API request

**Output Format:** MP4 (H.264 + AAC)

### Quality Settings (Encode Method)

- **Video Codec:** H.264
- **CRF:** 18 (high quality)
- **Preset:** medium (balanced speed/quality)
- **Audio Codec:** AAC
- **Audio Bitrate:** 192 kbps

---

## 🐛 Troubleshooting

### Issue: "Video file not found"
**Solution:** Check the video path - use absolute path or path relative to project root

### Issue: Clips have wrong duration
**Solution:** 
- Use "Accurate Encode" method instead of "Fast Copy"
- Check start/end times are correct

### Issue: Processing is slow
**Solution:**
- Use "Fast Copy" for quicker processing
- Process fewer clips at once
- Close other applications

### Issue: Output file is too large
**Solution:**
- Check CRF value (lower = larger file)
- Consider using "Fast Copy" which maintains original bitrate

---

## 💡 Tips & Best Practices

1. **Always analyze video first** - Get accurate duration before setting clip times

2. **Use Fast Copy for quick previews** - Then use Accurate Encode for final output

3. **Load from Marker XML** - Saves time for videos that already have markers

4. **Check results table** - Compare requested vs actual duration to verify accuracy

5. **Use custom output directory** - Keep original and clipped videos organized

6. **Test with one clip first** - Before processing many clips

---

## 📚 Additional Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Video Analysis Report](./VIDEO_ANALYSIS_REPORT.md)
- [Motion Detection Guide](./MOTION_DETECTION_GUIDE.md)

---

**Last Updated:** 2025-10-30  
**Version:** 1.0.0

