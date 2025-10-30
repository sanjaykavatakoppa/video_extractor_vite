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
MAX_CLIP_DURATION = 20  # seconds - MAXIMUM clip length (soft limit - can be longer if quality is good)
MOTION_THRESHOLD = 4.5  # Minimum motion score (lowered from 5.0 to catch more good clips)
FRAME_SAMPLE_RATE = 15  # Analyze every Nth frame (higher = faster, was 5)
CHUNK_SIZE = 18.0       # Divide video into 18-second chunks for analysis

# Logic: Divide video into chunks, check motion, keep good chunks, skip bad chunks
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

def split_long_scene(start_time, end_time, motion_score):
    """Split a scene longer than MAX_CLIP_DURATION into multiple clips
    
    Creates clips of 17-20 seconds with slight variation (like manual clips).
    Target: ~18-19 seconds per clip with some natural variation.
    """
    clips = []
    duration = end_time - start_time
    
    # Target duration: 18.5s (matches the average of manual clips: 18.9s)
    TARGET_DURATION = 18.5
    
    # Calculate number of clips needed
    num_clips = int(np.ceil(duration / TARGET_DURATION))
    
    # If that makes clips too short, reduce number of clips
    if duration / num_clips < MIN_CLIP_DURATION:
        num_clips = max(1, int(duration / MIN_CLIP_DURATION))
    
    # Calculate actual duration per clip
    clip_duration = duration / num_clips
    
    # Add slight variation to make clips more natural (±1 second)
    for i in range(num_clips):
        # Base clip boundaries
        clip_start = start_time + (i * clip_duration)
        clip_end = min(start_time + ((i + 1) * clip_duration), end_time)
        actual_duration = clip_end - clip_start
        
        # Add slight random variation (±5% or ±0.9s, whichever is smaller)
        # This makes clips slightly varied like manual clips (16.5s - 20s range)
        variation = min(0.9, actual_duration * 0.05) * (np.random.random() - 0.5) * 2
        
        # Apply variation but keep within bounds
        adjusted_end = clip_end + variation
        
        # Ensure we don't exceed the scene boundary
        if adjusted_end > end_time:
            adjusted_end = end_time
        
        # Ensure previous clip doesn't overlap
        if i > 0 and clips:
            adjusted_start = clips[-1]["end"]
            actual_duration = adjusted_end - adjusted_start
        else:
            adjusted_start = clip_start
            actual_duration = adjusted_end - adjusted_start
        
        # Only add if within valid range
        if MIN_CLIP_DURATION <= actual_duration <= MAX_CLIP_DURATION:
            clips.append({
                "start": round(adjusted_start, 2),
                "end": round(adjusted_end, 2),
                "duration": round(actual_duration, 2),
                "motion_score": round(motion_score, 2)
            })
    
    return clips

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
    
    # FAST: Skip scene detection entirely - divide video into chunks and check motion
    log_progress("🔍 Analyzing video for high-quality segments (fast method)...")
    log_progress(f"ℹ️  Processing ~{int(duration / CHUNK_SIZE)} chunks at {CHUNK_SIZE}s each")
    
    motion_clips = []
    
    # Simple approach: Divide video into ~18 second chunks and validate motion
    # This is MUCH faster than PySceneDetect for large 4K videos
    current_time = 0.0
    chunk_num = 0
    
    while current_time < duration:
        chunk_end = min(current_time + CHUNK_SIZE, duration)
        chunk_duration = chunk_end - current_time
        chunk_num += 1
        total_chunks = int(duration / CHUNK_SIZE) + 1
        
        # Skip if chunk is too short
        if chunk_duration < MIN_CLIP_DURATION:
            log_progress(f"⏭️  Skipping final small segment: {chunk_duration:.1f}s")
            break
        
        log_progress(f"⚙️ Chunk {chunk_num}/{total_chunks}: {current_time:.1f}s - {chunk_end:.1f}s ({chunk_duration:.1f}s)")
        
        # Calculate motion for this chunk
        start_frame = int(current_time * fps)
        end_frame = int(chunk_end * fps)
        
        if end_frame > start_frame:
            motion_score = calculate_motion_score(str(video_path), start_frame, end_frame, fps)
            
            # Good motion? Keep this chunk
            if motion_score >= MOTION_THRESHOLD:
                log_progress(f"   ✅ KEEP - motion: {motion_score:.2f}")
                motion_clips.append({
                    "start": round(current_time, 2),
                    "end": round(chunk_end, 2),
                    "duration": round(chunk_duration, 2),
                    "motion_score": round(motion_score, 2)
                })
            else:
                log_progress(f"   ⏭️  SKIP - motion: {motion_score:.2f}")
        
        # Move to next chunk
        current_time = chunk_end
    
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

