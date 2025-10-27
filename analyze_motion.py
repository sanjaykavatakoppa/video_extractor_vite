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

# Configuration
MIN_CLIP_DURATION = 9  # seconds
MAX_CLIP_DURATION = 20  # seconds
MOTION_THRESHOLD = 5.0  # Minimum motion score to consider a scene active
FRAME_SAMPLE_RATE = 5  # Analyze every Nth frame (for performance)

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
    """Split a scene longer than MAX_CLIP_DURATION into multiple clips"""
    clips = []
    duration = end_time - start_time
    
    # Calculate number of clips needed
    num_clips = int(np.ceil(duration / MAX_CLIP_DURATION))
    clip_duration = duration / num_clips
    
    for i in range(num_clips):
        clip_start = start_time + (i * clip_duration)
        clip_end = min(start_time + ((i + 1) * clip_duration), end_time)
        
        clips.append({
            "start": round(clip_start, 2),
            "end": round(clip_end, 2),
            "duration": round(clip_end - clip_start, 2),
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
    
    # Detect scenes
    log_progress("🔍 Detecting scenes...")
    try:
        scenes = detect(str(video_path), ContentDetector(threshold=27.0))
    except Exception as e:
        log_error(f"Scene detection failed: {str(e)}")
        return []
    
    log_progress(f"✅ Found {len(scenes)} scenes")
    
    # Analyze each scene for motion
    motion_clips = []
    
    for idx, (start_time, end_time) in enumerate(scenes):
        scene_duration = end_time.get_seconds() - start_time.get_seconds()
        
        log_progress(f"⚙️ Analyzing scene {idx + 1}/{len(scenes)} ({scene_duration:.1f}s)")
        
        # Skip scenes that are too short
        if scene_duration < MIN_CLIP_DURATION:
            log_progress(f"⏭️  Skipped (too short: {scene_duration:.1f}s < {MIN_CLIP_DURATION}s)")
            continue
        
        # Calculate motion score
        start_frame = int(start_time.get_frames())
        end_frame = int(end_time.get_frames())
        motion_score = calculate_motion_score(str(video_path), start_frame, end_frame, fps)
        
        # Skip low-motion scenes
        if motion_score < MOTION_THRESHOLD:
            log_progress(f"⏭️  Skipped (low motion: {motion_score:.2f} < {MOTION_THRESHOLD})")
            continue
        
        start_seconds = start_time.get_seconds()
        end_seconds = end_time.get_seconds()
        
        # Handle long scenes - split into multiple clips
        if scene_duration > MAX_CLIP_DURATION:
            log_progress(f"✂️  Splitting long scene ({scene_duration:.1f}s) into multiple clips")
            clips = split_long_scene(start_seconds, end_seconds, motion_score)
            motion_clips.extend(clips)
        else:
            # Scene is perfect length (9-20 seconds)
            motion_clips.append({
                "start": round(start_seconds, 2),
                "end": round(end_seconds, 2),
                "duration": round(scene_duration, 2),
                "motion_score": round(motion_score, 2)
            })
        
        log_progress(f"✅ Scene {idx + 1}: {scene_duration:.1f}s, motion: {motion_score:.2f}")
    
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

