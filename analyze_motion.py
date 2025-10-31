#!/usr/bin/env python3
"""
Video Motion Detection & Premiere Pro Marker Generator
Analyzes video for motion, creates 9-20 second clips, generates XML markers
"""

import sys
import json
import cv2
import numpy as np
from pathlib import Path
from scenedetect import detect, ContentDetector

# Configuration - Quality-Based Clipping
MIN_CLIP_DURATION = 9   # seconds - MINIMUM clip length (hard requirement)
MAX_CLIP_DURATION = 19  # seconds - MAXIMUM clip length (absolute cap)
MOTION_THRESHOLD = 4.5  # Minimum motion score (lowered from 5.0 to catch more good clips)
FRAME_SAMPLE_RATE = 15  # Analyze every Nth frame (higher = faster, was 5)
WINDOW_SIZE = 1.0       # Size of analysis window in seconds for motion sampling
GAP_TOLERANCE = 1.0     # Allow up to 1 second lull inside a clip before splitting

# Logic: Sample motion in small windows, merge nearby windows, then enforce clip limits
# Threshold 4.5 captures clips with decent motion while still filtering out static content

def log_progress(message, data=None):
    """Send progress updates to Node.js"""
    output = {
        "type": "progress",
        "message": message
    }
    if data:
        output["data"] = data
    print(json.dumps(output), flush=True)

def log_error(message):
    """Send error to Node.js"""
    output = {
        "type": "error",
        "message": message
    }
    print(json.dumps(output), flush=True)

def log_result(clips):
    """Send final result to Node.js"""
    output = {
        "type": "complete",
        "clips": clips
    }
    print(json.dumps(output), flush=True)

def format_timecode(seconds, fps=30):
    """Convert seconds to HH:MM:SS:FF timecode"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    frames = int((seconds % 1) * fps)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}:{frames:02d}"

def calculate_motion_score(video_path, start_frame, end_frame, fps):
    """Calculate motion intensity for a scene using frame differences"""
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        return 0
    
    # Jump to start frame
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    ret, prev_frame = cap.read()
    if not ret:
        cap.release()
        return 0
    
    # Convert to grayscale and resize for faster processing
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    prev_gray = cv2.resize(prev_gray, (320, 180))
    
    total_motion = 0
    frame_count = 0
    
    # Sample frames for motion analysis
    for frame_num in range(start_frame + 1, end_frame, FRAME_SAMPLE_RATE):
        ret, curr_frame = cap.read()
        if not ret:
            break
        
        curr_gray = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)
        curr_gray = cv2.resize(curr_gray, (320, 180))
        
        # Calculate frame difference
        frame_diff = cv2.absdiff(curr_gray, prev_gray)
        motion = np.mean(frame_diff)
        
        total_motion += motion
        frame_count += 1
        prev_gray = curr_gray
    
    cap.release()
    
    return total_motion / frame_count if frame_count > 0 else 0

def analyze_video(video_path):
    """Main analysis function"""
    video_path = Path(video_path)
    
    if not video_path.exists():
        log_error(f"Video file not found: {video_path}")
        return []
    
    log_progress(f"🎬 Analyzing video: {video_path.name}")
    
    # Get video info
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    cap.release()
    
    log_progress(f"📊 Video info: {duration:.1f}s, {fps:.2f} fps, {total_frames} frames")
    
    log_progress("🔍 Analyzing video for high-quality segments (adaptive windows)...")
    log_progress(f"ℹ️  Processing ~{int(duration / WINDOW_SIZE)} windows at {WINDOW_SIZE:.1f}s each")

    # Step 1: Measure motion in small windows
    motion_windows = []
    current_time = 0.0
    window_index = 0

    while current_time < duration:
        window_end = min(current_time + WINDOW_SIZE, duration)
        window_duration = window_end - current_time

        if window_duration < WINDOW_SIZE * 0.5:
            break

        start_frame = int(current_time * fps)
        end_frame = int(window_end * fps)

        if end_frame > start_frame:
            motion_score = calculate_motion_score(str(video_path), start_frame, end_frame, fps)
            motion_windows.append({
                "start": current_time,
                "end": window_end,
                "duration": window_duration,
                "motion": motion_score,
                "high_motion": motion_score >= MOTION_THRESHOLD
            })

        window_index += 1
        current_time = window_end

    if not motion_windows:
        log_progress("⏭️  No motion detected in analysis windows")
        return []

    # Step 2: Group consecutive high-motion windows into provisional segments
    raw_segments = []
    current_segment = None
    low_motion_buffer = 0.0

    for window in motion_windows:
        if window["high_motion"]:
            if current_segment is None:
                current_segment = {
                    "start": window["start"],
                    "end": window["end"],
                    "windows": [window]
                }
            else:
                current_segment["end"] = window["end"]
                current_segment["windows"].append(window)
            low_motion_buffer = 0.0
        else:
            if current_segment is not None:
                low_motion_buffer += window["duration"]
                if low_motion_buffer <= GAP_TOLERANCE:
                    current_segment["end"] = window["end"]
                    current_segment["windows"].append(window)
                else:
                    raw_segments.append(current_segment)
                    current_segment = None
                    low_motion_buffer = 0.0

    if current_segment is not None:
        raw_segments.append(current_segment)

    if not raw_segments:
        log_progress("⏭️  Motion never stayed above threshold long enough for a clip")
        return []

    # Step 3: Merge segments separated by tiny gaps
    merged_segments = []
    for segment in raw_segments:
        if not merged_segments:
            merged_segments.append(segment)
            continue
        gap = segment["start"] - merged_segments[-1]["end"]
        if gap <= GAP_TOLERANCE:
            merged_segments[-1]["end"] = segment["end"]
            merged_segments[-1]["windows"].extend(segment["windows"])
        else:
            merged_segments.append(segment)

    # Step 4: Trim/merge to enforce 9-20s while preserving natural segments
    motion_clips = []
    for segment in merged_segments:
        segment_duration = segment["end"] - segment["start"]
        if segment_duration < MIN_CLIP_DURATION:
            continue

        high_windows = [w for w in segment["windows"] if w["high_motion"]]
        if not high_windows:
            continue
        avg_motion = sum(w["motion"] for w in high_windows) / len(high_windows)

        clip_start = segment["start"]
        segment_end = segment["end"]

        while segment_end - clip_start > MAX_CLIP_DURATION:
            clip_end = clip_start + MAX_CLIP_DURATION
            motion_clips.append({
                "start": round(clip_start, 2),
                "end": round(clip_end, 2),
                "duration": round(MAX_CLIP_DURATION, 2),
                "motion_score": round(avg_motion, 2)
            })
            clip_start = clip_end

        remaining = segment_end - clip_start
        if remaining >= MIN_CLIP_DURATION:
            motion_clips.append({
                "start": round(clip_start, 2),
                "end": round(segment_end, 2),
                "duration": round(remaining, 2),
                "motion_score": round(avg_motion, 2)
            })
        elif motion_clips:
            prev_clip = motion_clips[-1]
            if prev_clip["duration"] + remaining <= MAX_CLIP_DURATION:
                prev_clip["end"] = round(prev_clip["end"] + remaining, 2)
                prev_clip["duration"] = round(prev_clip["duration"] + remaining, 2)

    log_progress(f"🎯 Final result: {len(motion_clips)} motion clips created")

    return motion_clips

def generate_premiere_xml(clips, video_name, output_path, fps=30):
    """Generate Premiere Pro XML marker file"""
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<!DOCTYPE xmeml>\n'
    xml_content += '<xmeml version="5">\n'
    xml_content += '  <sequence>\n'
    xml_content += f'    <name>{video_name}</name>\n'
    xml_content += f'    <duration>{int(clips[-1]["end"] * fps) if clips else 0}</duration>\n'
    xml_content += '    <rate>\n'
    xml_content += '      <timebase>30</timebase>\n'
    xml_content += '      <ntsc>FALSE</ntsc>\n'
    xml_content += '    </rate>\n'
    xml_content += '    <media>\n'
    xml_content += '      <video>\n'
    xml_content += '        <track>\n'
    
    for idx, clip in enumerate(clips, 1):
        in_time = format_timecode(clip["start"], fps)
        out_time = format_timecode(clip["end"], fps)
        
        xml_content += '          <clipitem>\n'
        xml_content += f'            <name>Motion Clip {idx}</name>\n'
        xml_content += f'            <in>{in_time}</in>\n'
        xml_content += f'            <out>{out_time}</out>\n'
        xml_content += f'            <comment>Duration: {clip["duration"]}s, Motion: {clip["motion_score"]}</comment>\n'
        xml_content += '            <marker>\n'
        xml_content += f'              <name>Clip {idx}</name>\n'
        xml_content += f'              <in>{in_time}</in>\n'
        xml_content += f'              <out>{out_time}</out>\n'
        xml_content += f'              <comment>Motion Score: {clip["motion_score"]}</comment>\n'
        xml_content += '            </marker>\n'
        xml_content += '          </clipitem>\n'
    
    xml_content += '        </track>\n'
    xml_content += '      </video>\n'
    xml_content += '    </media>\n'
    xml_content += '  </sequence>\n'
    xml_content += '</xmeml>\n'
    
    # Write XML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)
    
    log_progress(f"💾 Premiere Pro XML saved: {output_path}")

def main():
    if len(sys.argv) < 2:
        log_error("Usage: python analyze_motion.py <video_path>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    try:
        # Analyze video
        clips = analyze_video(video_path)
        
        if not clips:
            log_error("No motion clips found in video")
            log_result([])
            return
        
        # Generate Premiere Pro XML
        video_name = Path(video_path).stem
        output_dir = Path(video_path).parent
        xml_path = output_dir / f"{video_name}_markers.xml"
        
        generate_premiere_xml(clips, video_name, str(xml_path))
        
        # Send results
        log_result(clips)
        
    except Exception as e:
        log_error(f"Analysis failed: {str(e)}")
        import traceback
        log_error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()

