# 📄 XML Generator - Frontend Design Guide

## 🎨 UI Overview

The XML Generator provides a beautiful, modern interface for generating XML files from video metadata.

---

## 🖥️ Visual Layout

```
┌────────────────────────────────────────────────────────────────┐
│                     📄 XML Generator                            │
│           Generate XML files from video metadata                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [●] Server Online                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  📁 Folder Name (relative to public/ directory)         │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │ public/ │ Videos                    │           │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  Enter the folder name containing video files           │  │
│  │  (e.g., "Videos" or "downloaded-videos/31638097")      │  │
│  │                                                          │  │
│  │           [  ⚡ Generate XML Files  ]                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⚙️ Processing                      12 / 58 files       │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │  │
│  │  │                    21%                            │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │  📹 1PWF92_EKCEA6A8NZ_0000003.mp4                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ✅ Generated XML Files (12)                            │  │
│  │  ┌───────────────────────────────────────────────────┐ │  │
│  │  │ 📄 1PWF92_EK4Q2TFQNB_0000001.xml                  │ │  │
│  │  │    Video: 1PWF92_EK4Q2TFQNB_0000001.mp4           │ │  │
│  │  │    Title: Sorano, Italy                           │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  │  ┌───────────────────────────────────────────────────┐ │  │
│  │  │ 📄 1PWF92_EKCEA6A8NZ_0000001.xml                  │ │  │
│  │  │    Video: 1PWF92_EKCEA6A8NZ_0000001.mp4           │ │  │
│  │  │    Title: 12-15-2018 - Venice, Italy 1            │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Features

### 1. **Folder Input Section**
- **Input field with prefix:** Shows `public/` as a fixed prefix
- **Placeholder:** Default value "Videos"
- **Help text:** Provides examples of valid folder paths
- **Validation:** Disabled when generation is in progress

### 2. **Generate Button**
- **Gradient design:** Purple gradient (667eea → 764ba2)
- **Icon:** ⚡ lightning bolt
- **States:**
  - Normal: Purple gradient
  - Hover: Elevated with shadow
  - Disabled: Gray
  - Generating: Pink gradient with spinner

### 3. **Real-time Progress**
- **Progress bar:** Smooth animated fill
- **File counter:** "X / Y files"
- **Current file:** Shows which file is being processed
- **Percentage:** Displayed inside the progress bar

### 4. **Generated Files List**
- **Green theme:** Success color scheme
- **Card-based layout:** Each file in its own card
- **Hover effect:** Border color changes on hover
- **Details shown:**
  - XML filename
  - Source video filename
  - Title from Excel

### 5. **Error Handling**
- **Red theme:** Error color scheme
- **Detailed messages:** Shows file and error description
- **Stacked layout:** Easy to scan multiple errors

### 6. **Information Cards**
- **How it works:** Step-by-step guide
- **Data sources:** Shows what data comes from where
- **Gradient background:** Subtle purple gradient
- **Responsive:** Stacks on mobile

---

## 🎨 Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| **Primary Button** | `#667eea → #764ba2` | Generate button gradient |
| **Success** | `#4CAF50` | Progress bar, success messages |
| **Error** | `#f44336` | Error messages |
| **Background** | `#ffffff` | Card backgrounds |
| **Border** | `#e0e0e0` | Input borders |
| **Text Primary** | `#333333` | Main text |
| **Text Secondary** | `#666666` | Help text |

---

## 📱 Responsive Design

### Desktop (> 768px)
- Full width cards
- Two-column info section
- Large button and inputs

### Mobile (< 768px)
- Stacked layout
- Single-column info section
- Full-width inputs
- Vertical folder input (prefix stacks on top)

---

## 🔄 User Flow

```
1. User enters folder name
   ↓
2. Clicks "Generate XML Files"
   ↓
3. Server checks if folder exists
   ↓
4. For each video:
   - Extract metadata with ffprobe
   - Read Excel data
   - Read JSON metadata
   - Generate XML
   - Save to same folder
   ↓
5. Show success/error for each file
   ↓
6. Display completion summary
```

---

## 🚀 How to Use

### 1. **Start the servers:**
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
npm run server

# Or both together:
npm run dev:all
```

### 2. **Access the UI:**
- Open: `http://localhost:3000`
- Click: **"📄 Generate XML"** button in the mode selector

### 3. **Generate XML files:**
- Enter folder name (default: "Videos")
- Click "⚡ Generate XML Files"
- Watch real-time progress
- View generated files list

---

## 📊 Data Sources

The XML generator pulls data from multiple sources:

| XML Field | Source | Example |
|-----------|--------|---------|
| `TE_ParentClip` | Excel "File Name" | `1PWF92_EK4Q2TFQNB` |
| `Filename` | Video file | `1PWF92_EK4Q2TFQNB_0000001.mp4` |
| `Duration` | ffprobe (video metadata) | `0:00:19` |
| `Resolution` | ffprobe (video metadata) | `3840 x 2160` |
| `FPS` | ffprobe (video metadata) | `29.97` |
| `Primary_Language` | Fixed (empty) | `` |
| `CountryOrigin` | JSON `Production.CountryOfOrigin` | `Italy` |
| `CD_Category` | Fixed | `Emerging Objects and Cinematic Storytelling` |
| `Production_TextRef` | Fixed | `false` |
| `Title` | Excel "TITLE" | `Sorano, Italy` |
| `Description` | Excel "DESCRIPTION" | `DJI_0218.MP4` |

---

## 🎯 Technical Details

### Frontend Component
- **File:** `src/components/XmlGenerator.jsx`
- **Styling:** `src/components/XmlGenerator.css`
- **State Management:** React hooks (useState, useEffect)
- **API Communication:** Fetch API with streaming response

### Backend Endpoint
- **URL:** `POST http://localhost:3001/api/generate-xml`
- **Request Body:**
  ```json
  {
    "folderName": "Videos"
  }
  ```
- **Response:** Streaming JSON (Server-Sent Events style)
  ```json
  {"type":"progress","current":1,"total":58,"file":"video.mp4"}
  {"type":"success","videoFile":"video.mp4","xmlFile":"video.xml","title":"..."}
  {"type":"complete","successCount":58,"errorCount":0,"total":58}
  ```

---

## ✨ UI Highlights

### Interactive Elements
- **Smooth transitions:** All hover effects have 0.3s transitions
- **Animated progress bar:** Green gradient with smooth fill
- **Spinner animation:** Rotating circle during processing
- **Hover cards:** Files lift slightly on hover
- **Status indicator:** Pulsing dot for server status

### Accessibility
- **Labels:** All inputs have proper labels
- **ARIA attributes:** Buttons have descriptive text
- **Color contrast:** WCAG AA compliant
- **Keyboard navigation:** Tab through all elements
- **Disabled states:** Visual feedback when not available

---

## 🎉 Complete!

The XML Generator is now fully integrated into the Video Metadata Extractor application!

**Features:**
✅ Folder input with validation  
✅ Real-time progress tracking  
✅ Success/error feedback  
✅ Generated files list  
✅ Responsive design  
✅ Beautiful UI with gradients and animations  
✅ Server health monitoring  

