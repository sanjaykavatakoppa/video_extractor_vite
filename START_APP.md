# 🚀 Video Extractor Application - Quick Start Guide

## 📱 Access the Application

### ✅ **The servers are already running!**

**React App (Main UI):** [http://localhost:3000](http://localhost:3000)  
**API Server:** [http://localhost:3001](http://localhost:3001)

---

## 🎯 How to Use the Video Downloader

### Step 1: Open the App
Navigate to: **http://localhost:3000**

### Step 2: Select Mode
Click on the **"⬇️ Download from Excel"** tab

### Step 3: Configure Download
- **Start from Row**: Enter the Excel row number (1-500)
- **Number of Videos**: How many videos to download (1-50)

### Step 4: Start Download
Click **"Start Download"** button

### Step 5: Watch Progress
- See real-time download progress
- View downloaded files list
- Check for any errors

---

## 🔄 If Servers Are Not Running

### Option 1: Run Both Together (Recommended)
```bash
cd /Users/sanjayak/projects/engg/video_extractor_vite
npm run dev:all
```

### Option 2: Run Separately

**Terminal 1 - React App:**
```bash
cd /Users/sanjayak/projects/engg/video_extractor_vite
npm run dev
```

**Terminal 2 - API Server:**
```bash
cd /Users/sanjayak/projects/engg/video_extractor_vite
npm run server
```

### Option 3: Use Start Script
```bash
cd /Users/sanjayak/projects/engg/video_extractor_vite
./start.sh
```

---

## 📂 Where Are Downloaded Videos?

All videos are saved to:
```
/Users/sanjayak/projects/engg/video_extractor_vite/public/downloaded-videos/
```

---

## 🎬 Example Usage Scenarios

### Download First Video
- Start from Row: **1**
- Number of Videos: **1**
- Click "Start Download"

### Download Videos 10-14
- Start from Row: **10**
- Number of Videos: **5**
- Click "Start Download"

### Download Single Video from Row 100
- Start from Row: **100**
- Number of Videos: **1**
- Click "Start Download"

---

## 📊 What You'll See

### During Download:
- ⏳ Progress bar with percentage
- 📄 Current file being downloaded
- 🔢 Count (e.g., "Downloading 2 of 5")

### After Download:
- ✅ List of successfully downloaded files with sizes
- ❌ List of any errors (if any)
- 📊 Summary statistics

---

## 🔧 Features

✅ Real-time progress updates  
✅ Server status indicator  
✅ Error handling and reporting  
✅ Proper comp file naming (`1PWF92_xxx_fc.mov`)  
✅ Configurable start row and count  
✅ Beautiful, modern UI  

---

## 💡 Tips

- Start with 1-2 videos to test
- Check available disk space before downloading many videos
- Comp files are typically 100-600 MB each
- If download fails, check the error message in the UI

---

## 🛑 To Stop Servers

Press `Ctrl + C` in the terminal where servers are running

---

## 📞 Troubleshooting

**"Server Offline" message:**
- Make sure you run `npm run server` in a separate terminal
- Check that port 3001 is not in use

**Download stuck:**
- Refresh the page
- Restart both servers

**"No space left on device":**
- Free up disk space
- Download fewer videos at a time

---

**You're all set! Open http://localhost:3000 and start downloading!** 🎉

