# Video Analysis Report - 1PWF92_EK4Q2TFQNB_fc

## Overview
Analysis of video `1PWF92_EK4Q2TFQNB_fc.mov` and its split parts to understand the clipping behavior and build a comprehensive video clipping system.

---

## Original Video Metadata

**File:** `/public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov`

| Property | Value |
|----------|-------|
| Duration | 107.21 seconds (1m 47s) |
| Resolution | 3840 x 2160 (4K UHD) |
| Codec | H.264 |
| Bitrate | 12.7 Mbps |
| Frame Rate | 29.97 fps (30000/1001) |
| File Size | 162 MB |

---

## Marker XML Analysis

**File:** `1PWF92_EK4Q2TFQNB_fc_markers.xml`

The marker file defines **6 motion clips**, all with equal duration:

| Clip | Start Timecode | End Timecode | Duration | Motion Score |
|------|---------------|--------------|----------|--------------|
| 1 | 00:00:00:00 | 00:00:17:26 | 17.87s | 5.78 |
| 2 | 00:00:17:26 | 00:00:35:22 | 17.87s | 5.78 |
| 3 | 00:00:35:22 | 00:00:53:18 | 17.87s | 5.78 |
| 4 | 00:00:53:18 | 00:01:11:14 | 17.87s | 5.78 |
| 5 | 00:01:11:14 | 00:01:29:10 | 17.87s | 5.78 |
| 6 | 00:01:29:10 | 00:01:47:06 | 17.87s | 5.78 |

**Total marked duration:** 107.22 seconds (matches original video)

**Observations:**
- All clips have identical motion scores (5.78) - suggests uniform splitting
- All clips are exactly 17.87 seconds - algorithmic split, not scene-based
- Timecodes are sequential with no gaps

---

## Split Video Files

**Location:** `/public/Videos/`

| File | Duration | Size | Discrepancy |
|------|----------|------|-------------|
| 1PWF92_EK4Q2TFQNB_fc-0000001.mp4 | 19.59s | 190 MB | **+1.72s longer than marked** |
| 1PWF92_EK4Q2TFQNB_fc-0000002.mp4 | 17.48s | 171 MB | -0.39s shorter |
| 1PWF92_EK4Q2TFQNB_fc-0000003.mp4 | 14.31s | 134 MB | **-3.56s shorter** |
| 1PWF92_EK4Q2TFQNB_fc-0000004.mp4 | 20.32s | 190 MB | **+2.45s longer** |

**Total split duration:** 71.7 seconds  
**Missing content:** 35.51 seconds (33% of original video)

---

## Critical Issues Identified

### 🚨 Issue 1: Missing Content
- Original video: 107.21 seconds
- Split videos total: 71.7 seconds
- **Missing: 35.51 seconds (33%)**

### 🚨 Issue 2: Marker Mismatch
- Markers define 6 clips
- Physical splits: 4 files
- **2 clips not created** (clips 5 & 6)

### 🚨 Issue 3: Duration Discrepancies
- Split 1: +1.72s extra
- Split 3: -3.56s missing
- Split 4: +2.45s extra
- **Inconsistent splitting algorithm**

### 🚨 Issue 4: Variable Quality
- File sizes don't correlate with duration
- Part 1 (19.59s) = 190MB → ~9.7 Mbps
- Part 3 (14.31s) = 134MB → ~9.4 Mbps
- **Encoding inconsistency**

---

## Splitting Hypothesis

Based on the analysis, the splitting appears to be:
1. **Not marker-based** - Splits don't match marker boundaries
2. **Potentially manual** - Irregular durations suggest human intervention
3. **Incomplete** - Only 4 of 6 marked segments were created
4. **Lossy** - 33% of original content is missing

---

## Recommendations for Video Clipping System

### 1. **Accurate Marker-Based Splitting**
- Use FFmpeg with precise timestamp cutting
- Preserve all content from original video
- Validate output duration matches markers

### 2. **Quality Preservation**
- Use `-c copy` for lossless splitting when possible
- If re-encoding needed, match original bitrate (12.7 Mbps)
- Maintain 4K resolution (3840x2160)

### 3. **Validation System**
- Verify sum of split durations = original duration
- Check for gaps or overlaps
- Report discrepancies

### 4. **Flexible Clipping Interface**
- Allow custom time ranges
- Preview before splitting
- Batch processing with progress tracking
- Support both scene-based and time-based splitting

---

## Next Steps

1. ✅ Complete video analysis
2. ⏳ Build API endpoint for precise video clipping
3. ⏳ Create UI for interactive clip selection
4. ⏳ Implement validation system
5. ⏳ Test with multiple videos

---

## Technical Details

### FFmpeg Commands for Accurate Splitting

**Lossless copy (fast, no quality loss):**
```bash
ffmpeg -i input.mov -ss 00:00:00 -to 00:00:17.87 -c copy output_001.mp4
```

**Re-encode (slower, but frame-accurate):**
```bash
ffmpeg -i input.mov -ss 00:00:00 -t 17.87 \
  -c:v libx264 -preset medium -crf 18 \
  -c:a aac -b:a 192k \
  output_001.mp4
```

### Validation Query
```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 video.mp4
```

---

**Generated:** 2025-10-30  
**Tool:** Video Extractor Vite Analysis System

