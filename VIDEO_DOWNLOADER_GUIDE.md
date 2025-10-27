# 📥 Video Downloader - Complete Guide

## 🎯 What Was Built

A full-stack video downloader application integrated into your existing Video Metadata Extractor app.

### Features:
- ✅ Read Clip IDs from Excel file (`video.xlsx`)
- ✅ Fetch video metadata from API
- ✅ Download comp renditions with proper naming (`1PWF92_xxx_fc.mov`)
- ✅ Real-time progress updates in UI
- ✅ Server status monitoring
- ✅ Error handling and reporting
- ✅ Beautiful, modern React interface

---

## 🚀 Quick Start (Application is Already Running!)

### Access the App:
**👉 http://localhost:3000**

1. Click on **"⬇️ Download from Excel"** tab
2. Enter **Start from Row** (e.g., 1, 10, 50)
3. Enter **Number of Videos** (e.g., 1, 5, 10)
4. Click **"Start Download"**
5. Watch real-time progress! 📊

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Port 3000)                             │
│  - Video Metadata Extractor                             │
│  - Video Downloader UI                                  │
│  - Real-time Progress Display                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP POST /api/download-videos
                 │
┌────────────────▼────────────────────────────────────────┐
│  Express API Server (Port 3001)                         │
│  - Read Excel File (video.xlsx)                         │
│  - Fetch Clip Metadata API                              │
│  - Get Signed Download URLs                             │
│  - Stream Video Downloads                               │
│  - Send Progress Updates                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Files Created/Modified

### New Files:
```
src/components/VideoDownloader.jsx      - Download UI component
src/components/VideoDownloader.css      - Styling
server.js                               - Express API server
start.sh                                - Startup script
START_APP.md                            - Quick start guide
DOWNLOADER_README.md                    - CLI documentation
VIDEO_DOWNLOADER_GUIDE.md              - This file
```

### Modified Files:
```
src/App.jsx                - Added download mode tab
package.json               - Added server scripts
download-videos.js         - Added CLI arguments support
```

---

## 🎨 UI Features

### Server Status Indicator
- ✅ Green badge when API server is online
- ❌ Red badge when offline
- ⏳ Orange badge while checking

### Download Progress
- Progress bar with percentage
- Current file being downloaded
- Download count (e.g., "2 of 5")
- Real-time file size display

### Results Display
- ✅ Success list with file names and sizes
- ❌ Error list with specific error messages
- 📊 Summary cards (Downloaded / Errors)

---

## 🔧 API Endpoints Used

### 1. Get Clip Metadata:
```
GET https://crxextapi.pd.dmh.veritone.com/assets-api/v1/clip/byIds
    ?ids={clipId}
    &fields=Title,Description,TWK.SupplierID,Format.FrameSize,Format.FrameRate,...
    &api_key=xxx
```

### 2. Get Download URL:
```
GET https://crxextapi.pd.dmh.veritone.com/assets-api/v1/renditionUrl/select/{clipId}
    ?scheme=https
    &context=browser
    &sizes=f
    &purposes=c
    &api_key=xxx
```

Returns comp rendition with signed S3 URL for download.

---

## 📊 Download Flow

1. **User Input** → Start Row + Number of Videos
2. **Read Excel** → Extract Clip IDs from specified rows
3. **Fetch Metadata** → Get clip info and renditions
4. **Get Download URL** → Retrieve signed S3 URL for comp file
5. **Download Video** → Stream file with progress updates
6. **Save File** → Store as `{ClipName}_fc.mov` in `public/downloaded-videos/`
7. **Update UI** → Real-time progress and results

---

## 🎯 File Naming Convention

**Downloaded files follow this pattern:**
```
{SupplierCode}_{UniqueID}_fc.{format}
```

**Examples:**
- `1PWF92_EK4Q2TFQNB_fc.mov`
- `1PWF92_EKCEA6A8NZ_fc.mov`
- `1PWF92_EKJXE4T56M_fc.mov`

**Where:**
- `1PWF92` = Supplier code
- `EK4Q2TFQNB` = Unique clip identifier
- `fc` = Full comp rendition
- `mov` = QuickTime format

---

## 🔄 Alternative: Command Line Usage

If you prefer command line, you can still use:

```bash
# Download 1 video from row 5
node download-videos.js --start 5 --count 1

# Download 3 videos starting from row 20
node download-videos.js --start 20 --count 3
```

---

## 📦 Dependencies

All installed and ready:
- `express` - API server
- `cors` - Cross-origin requests
- `xlsx` - Excel file reading
- `concurrently` - Run multiple servers
- `react` - Frontend framework

---

## 🎊 Success!

Your Video Downloader is fully integrated and running as a web application with:
- ✅ Beautiful UI
- ✅ Real-time progress
- ✅ Error handling
- ✅ Server monitoring
- ✅ Proper file naming

**Start downloading now at: http://localhost:3000** 🚀

