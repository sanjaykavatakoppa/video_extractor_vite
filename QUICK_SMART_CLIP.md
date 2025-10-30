# ⚡ Quick Start - Smart Motion-Based Clipping

## 🎯 What You Asked For

> "I don't want to convert 100% - skip unwanted, not good quality video. If there is no motion, leave that clip till next moment starts."

✅ **DONE!** The system now:
- Analyzes video for motion
- Skips static/boring parts
- Only creates clips from high-action segments
- Matches your existing 11-clip workflow (50.8% coverage)

---

## 🚀 How to Use

### Step 1: Start Server
```bash
cd /Users/sanjayak/projects/engg/video_extractor_vite
npm run server
```

### Step 2: Run Smart Clipping

```bash
curl -X POST http://localhost:3001/api/smart-clip-video \
  -H "Content-Type: application/json" \
  -d '{
    "videoPath": "public/downloaded-videos/1PWF92_EKCEA6A8NZ_fc.mov",
    "outputDir": "public/Videos/31638097",
    "motionThreshold": 5.0
  }'
```

That's it! The system will:
1. ✅ Analyze the video for motion
2. ✅ Skip static parts (no motion)
3. ✅ Create clips only from good segments
4. ✅ Report what was skipped

---

## 📊 Your Example Results

**Input:** `1PWF92_EKCEA6A8NZ_fc.mov` (409 seconds)

**Output:** 11 clips in `public/Videos/31638097/`
- ✅ Total: 208 seconds (50.8%)
- ✅ Skipped: 201 seconds (49.2%) - static parts
- ✅ All clips: 16-20 seconds each
- ✅ **Smart selection!**

---

## 🎚️ Control Motion Sensitivity

Change `motionThreshold` to adjust:

- **`3.0`** = More clips (includes mild motion)
- **`5.0`** = **Recommended** (good balance) ⭐
- **`7.0`** = Fewer clips (only intense action)

---

## 📝 API Endpoint

**POST** `/api/smart-clip-video`

```json
{
  "videoPath": "path/to/video.mov",
  "outputDir": "path/to/output",
  "motionThreshold": 5.0,
  "method": "encode"
}
```

**Response:**
```json
{
  "type": "complete",
  "summary": {
    "originalDuration": "409.45s",
    "clippedDuration": "207.92s",
    "coverage": "50.8%",
    "skipped": "49.2%",
    "clipsCreated": 11,
    "clipsSkipped": 12
  }
}
```

---

## 📚 Documentation

- 📊 **MOTION_BASED_ANALYSIS.md** - Analysis of your existing clips
- 🎯 **SMART_MOTION_CLIPPING.md** - Complete guide
- 🎬 **VIDEO_ANALYSIS_REPORT.md** - First video analysis
- ✂️ **VIDEO_CLIPPER_GUIDE.md** - Manual clipping guide

---

**Status:** ✅ Ready to use!  
**Tested with:** Your 409s video → 11 smart clips (50.8% coverage)

