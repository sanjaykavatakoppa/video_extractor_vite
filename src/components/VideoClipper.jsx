import React, { useState, useRef } from 'react';
import './VideoClipper.css';

const VideoClipper = () => {
  const [videoPath, setVideoPath] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState([]);
  const [results, setResults] = useState(null);
  const [method, setMethod] = useState('copy'); // 'copy', 'high-quality', or 'encode'
  const [outputDir, setOutputDir] = useState('');
  const [motionThreshold, setMotionThreshold] = useState(4.5);  // Lowered to 4.5 for more clips
  const [useSmartClipping, setUseSmartClipping] = useState(false);
  const [outputQuality, setOutputQuality] = useState('enhanced'); // 'source' or 'enhanced' - default to enhanced
  const progressRef = useRef(null);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Analyze video to get metadata
  const analyzeVideo = async () => {
    if (!videoPath) {
      alert('Please enter a video path');
      return;
    }

    setAnalyzing(true);
    setVideoInfo(null);
    setProgress([]);

    try {
      const response = await fetch('http://localhost:3001/api/analyze-video-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath })
      });

      const data = await response.json();

      if (data.success) {
        setVideoInfo(data.analysis);
        setProgress([{ 
          type: 'success', 
          message: `✅ Video analyzed: ${data.analysis.duration}. Use Smart Clipping for automatic quality-based clips, or add clips manually.` 
        }]);
        
        // Don't auto-populate clips anymore
        // User should either:
        // 1. Enable Smart Clipping checkbox for automatic quality-based clips
        // 2. Add clips manually
        // 3. Load from Marker XML
        setClips([]);
      } else {
        setProgress([{ type: 'error', message: `❌ ${data.error}` }]);
      }
    } catch (error) {
      setProgress([{ type: 'error', message: `❌ Error: ${error.message}` }]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Add a new clip
  const addClip = () => {
    const lastClip = clips.length > 0 ? clips[clips.length - 1] : null;
    const start = lastClip ? lastClip.end : 0;
    const end = videoInfo ? Math.min(start + 20, videoInfo.durationSeconds) : start + 20;
    const clipNumber = String(clips.length + 1).padStart(7, '0');
    
    setClips([...clips, { start, end, name: clipNumber }]);
  };

  // Remove a clip
  const removeClip = (index) => {
    setClips(clips.filter((_, i) => i !== index));
  };

  // Update clip values
  const updateClip = (index, field, value) => {
    const newClips = [...clips];
    newClips[index][field] = field === 'name' ? value : parseFloat(value) || 0;
    setClips(newClips);
  };

  // Load clips from marker XML
  const loadFromMarkerXML = async () => {
    if (!videoPath) {
      alert('Please enter a video path first');
      return;
    }

    // Construct marker XML path
    const markerPath = videoPath.replace(/\.(mov|mp4|avi|mkv|wmv|flv|webm)$/i, '_markers.xml');
    
    try {
      const response = await fetch(markerPath);
      const xmlText = await response.text();
      
      // Parse XML to extract clip markers
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const clipItems = xmlDoc.querySelectorAll('clipitem');
      const loadedClips = [];
      
      clipItems.forEach((item, idx) => {
        const inTime = item.querySelector('in')?.textContent;
        const outTime = item.querySelector('out')?.textContent;
        
        if (inTime && outTime) {
          // Convert timecode (HH:MM:SS:FF) to seconds
          const inSeconds = timecodeToSeconds(inTime);
          const outSeconds = timecodeToSeconds(outTime);
          
          loadedClips.push({
            start: inSeconds,
            end: outSeconds,
            name: String(idx + 1).padStart(7, '0')
          });
        }
      });
      
      if (loadedClips.length > 0) {
        setClips(loadedClips);
        setProgress([{ type: 'success', message: `✅ Loaded ${loadedClips.length} clips from marker XML` }]);
      } else {
        setProgress([{ type: 'warning', message: '⚠️ No clips found in marker XML' }]);
      }
    } catch (error) {
      setProgress([{ type: 'error', message: `❌ Error loading marker XML: ${error.message}` }]);
    }
  };

  // Convert timecode (HH:MM:SS:FF) to seconds
  const timecodeToSeconds = (timecode, fps = 30) => {
    const parts = timecode.split(':');
    if (parts.length !== 4) return 0;
    
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    const frames = parseInt(parts[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds + (frames / fps);
  };

  // Process video clips
  const processClips = async () => {
    if (!videoPath) {
      alert('Please enter a video path');
      return;
    }

    if (!useSmartClipping && clips.length === 0) {
      alert('Please add at least one clip or enable Smart Motion-Based Clipping');
      return;
    }

    setProcessing(true);
    setProgress([]);
    setResults(null);

    try {
      // Determine method based on quality selection
      const finalMethod = outputQuality === 'enhanced' ? 'enhanced-quality' : method;
      
      // Use smart clipping or manual clipping
      const endpoint = useSmartClipping ? '/api/smart-clip-video' : '/api/clip-video';
      const requestBody = useSmartClipping 
        ? {
            videoPath,
            outputDir: outputDir || undefined,
            method: finalMethod,
            motionThreshold,
            minDuration: 9,
            maxDuration: 20
          }
        : {
            videoPath,
            clips,
            outputDir: outputDir || undefined,
            method: finalMethod
          };

      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            setProgress(prev => [...prev, data]);
            
            if (data.type === 'complete') {
              setResults(data);
            }

            // Auto-scroll to bottom
            if (progressRef.current) {
              progressRef.current.scrollTop = progressRef.current.scrollHeight;
            }
          } catch (e) {
            console.error('Failed to parse line:', line);
          }
        }
      }
    } catch (error) {
      setProgress(prev => [...prev, { type: 'error', message: `❌ Error: ${error.message}` }]);
    } finally {
      setProcessing(false);
    }
  };

  // Clear all
  const clearAll = () => {
    setClips([]);
    setProgress([]);
    setResults(null);
  };

  return (
    <div className="video-clipper">
      <h2>🎬 Video Clipper</h2>
      <p className="description">
        Split videos into multiple clips based on custom time ranges.
        Supports both fast copying (no re-encoding) and frame-accurate encoding.
      </p>

      {/* Video Input Section */}
      <div className="input-section">
        <h3>📹 Video Input</h3>
        
        <div className="input-group">
          <label>Video Path:</label>
          <input
            type="text"
            value={videoPath}
            onChange={(e) => setVideoPath(e.target.value)}
            placeholder="e.g., public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov"
            className="video-path-input"
          />
          <button 
            onClick={analyzeVideo} 
            disabled={analyzing || !videoPath}
            className="btn-analyze"
          >
            {analyzing ? '⏳ Analyzing...' : '🔍 Analyze Video'}
          </button>
        </div>

        {videoInfo && (
          <div className="video-info-card">
            <h4>📊 Video Information</h4>
            <div className="info-grid">
              <div><strong>File:</strong> {videoInfo.fileName}</div>
              <div><strong>Size:</strong> {videoInfo.fileSize}</div>
              <div><strong>Duration:</strong> {videoInfo.duration}</div>
              <div><strong>Bitrate:</strong> {videoInfo.bitrate}</div>
              {videoInfo.video && (
                <>
                  <div><strong>Resolution:</strong> {videoInfo.video.resolution}</div>
                  <div><strong>FPS:</strong> {videoInfo.video.fps.toFixed(2)}</div>
                  <div><strong>Video Codec:</strong> {videoInfo.video.codec}</div>
                  <div><strong>Video Bitrate:</strong> {videoInfo.video.bitrate}</div>
                </>
              )}
              {videoInfo.audio && (
                <>
                  <div><strong>Audio Codec:</strong> {videoInfo.audio.codec}</div>
                  <div><strong>Audio Bitrate:</strong> {videoInfo.audio.bitrate}</div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="input-group">
          <label>Output Directory (optional):</label>
          <input
            type="text"
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            placeholder="Leave empty to use same directory as input video"
            className="output-dir-input"
          />
        </div>

        <div className="input-group">
          <label>Output Quality / File Size:</label>
          <select value={outputQuality} onChange={(e) => setOutputQuality(e.target.value)} className="quality-select">
            <option value="enhanced">📦 Large Size - Enhanced Quality (77 Mbps, ~170 MB per clip) ⭐ RECOMMENDED</option>
            <option value="source">💾 Small Size - Source Quality (13 Mbps, ~28 MB per clip)</option>
          </select>
          <div className="quality-info">
            {outputQuality === 'enhanced' && (
              <div className="info-box info-success">
                <strong>⭐ Enhanced Quality (Large Size):</strong> Re-encodes at 77 Mbps to match your manual clips. 
                File size: ~170 MB per 18s clip. Processing time: ~1-2 minutes per clip. 
                <strong>This matches your manual workflow!</strong>
              </div>
            )}
            {outputQuality === 'source' && (
              <div className="info-box info-warning">
                <strong>💾 Source Quality (Small Size):</strong> Preserves original video quality (12.8 Mbps). 
                File size: ~28 MB per 18s clip. Very fast processing (codec copy). 
                <strong>Note:</strong> Smaller files but lower quality than manual clips.
              </div>
            )}
          </div>
        </div>

        <div className="input-group">
          <label>Processing Method:</label>
          <select 
            value={method} 
            onChange={(e) => setMethod(e.target.value)} 
            className="method-select"
            disabled={outputQuality === 'enhanced'}
          >
            <option value="copy">⚡ Fast Copy (No Re-encoding)</option>
            <option value="high-quality">🎯 High Quality Re-encode</option>
            <option value="encode">💾 Standard Quality</option>
          </select>
          {outputQuality === 'enhanced' && (
            <p className="method-locked-hint">
              ℹ️ Method is automatically set to High Quality when using Enhanced Quality output.
            </p>
          )}
        </div>

        <div className="input-group">
          <label>
            <input 
              type="checkbox" 
              checked={useSmartClipping} 
              onChange={(e) => setUseSmartClipping(e.target.checked)}
            />
            {' '}Use Smart Motion-Based Clipping (Skip static/low-motion segments)
          </label>
        </div>

        {useSmartClipping && (
          <div className="input-group smart-clipping-options">
            <label>Motion Threshold: {motionThreshold.toFixed(1)}</label>
            <input 
              type="range" 
              min="3" 
              max="10" 
              step="0.5" 
              value={motionThreshold}
              onChange={(e) => setMotionThreshold(parseFloat(e.target.value))}
              className="threshold-slider"
            />
            <div className="threshold-labels">
              <span>3.0 (More clips)</span>
              <span className="threshold-current">{motionThreshold.toFixed(1)} - {
                motionThreshold < 4 ? 'Low' :
                motionThreshold < 6 ? 'Medium (Recommended)' :
                motionThreshold < 8 ? 'High' : 'Very High'
              }</span>
              <span>10.0 (Fewer clips)</span>
            </div>
            <p className="threshold-hint">
              💡 Lower = includes mild motion. Higher = only intense action. 
              <strong>4.5</strong> recommended (balances quality & quantity).
            </p>
          </div>
        )}
      </div>

      {/* Clips Section */}
      <div className="clips-section">
        <div className="clips-header">
          <h3>✂️ Clips ({clips.length})</h3>
          <div className="clips-actions">
            <button onClick={loadFromMarkerXML} className="btn-secondary">
              📄 Load from Marker XML
            </button>
            <button onClick={addClip} className="btn-add">
              ➕ Add Clip
            </button>
            {clips.length > 0 && (
              <button onClick={clearAll} className="btn-danger">
                🗑️ Clear All
              </button>
            )}
          </div>
        </div>

        {clips.length > 0 ? (
          <div className="clips-list">
            <div className="clips-list-header">
              <span className="col-num">#</span>
              <span className="col-name">Name</span>
              <span className="col-time">Start (s)</span>
              <span className="col-time">End (s)</span>
              <span className="col-duration">Duration</span>
              <span className="col-actions">Actions</span>
            </div>
            <div className="manual-clips-hint">
              💡 These are manual clips. For automatic quality-based clipping, use Smart Clipping checkbox above.
            </div>
            {clips.map((clip, index) => (
              <div key={index} className="clip-item">
                <span className="col-num">{index + 1}</span>
                <input
                  type="text"
                  value={clip.name}
                  onChange={(e) => updateClip(index, 'name', e.target.value)}
                  className="col-name"
                  placeholder="0000001"
                />
                <input
                  type="number"
                  value={clip.start}
                  onChange={(e) => updateClip(index, 'start', e.target.value)}
                  className="col-time"
                  step="0.1"
                  min="0"
                />
                <input
                  type="number"
                  value={clip.end}
                  onChange={(e) => updateClip(index, 'end', e.target.value)}
                  className="col-time"
                  step="0.1"
                  min="0"
                />
                <span className="col-duration">
                  {formatTime(clip.end - clip.start)}
                </span>
                <button
                  onClick={() => removeClip(index)}
                  className="btn-remove"
                >
                  ✖
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No clips added yet.</p>
            <p className="hint">
              <strong>✅ Recommended:</strong> Enable "Smart Motion-Based Clipping" above for automatic quality-based clips
            </p>
            <p className="hint">
              <strong>OR</strong> manually add clips using "+ Add Clip" button
            </p>
            <p className="hint">
              <strong>OR</strong> load clips from "Load from Marker XML"
            </p>
          </div>
        )}
      </div>

      {/* Process Button */}
      {(clips.length > 0 || useSmartClipping) && (
        <div className="process-section">
          <button
            onClick={processClips}
            disabled={processing || (!useSmartClipping && clips.length === 0) || !videoPath}
            className="btn-process"
          >
            {processing ? '⏳ Processing...' : 
             useSmartClipping ? '🤖 Smart Clip Video (Auto-detect Motion)' :
             `🚀 Process ${clips.length} Clip(s)`}
          </button>
          {useSmartClipping && (
            <p className="smart-clip-hint">
              🎯 Smart clipping will analyze the video, detect motion, and create clips only from high-action segments (skipping static parts).
            </p>
          )}
        </div>
      )}

      {/* Progress Section */}
      {progress.length > 0 && (
        <div className="progress-section">
          <h3>📋 Progress Log</h3>
          <div className="progress-log" ref={progressRef}>
            {progress.map((item, index) => (
              <div key={index} className={`log-item log-${item.type}`}>
                {item.type === 'info' && <span>ℹ️ {item.message}</span>}
                {item.type === 'progress' && (
                  <span>
                    ⏳ Processing clip {item.current}/{item.total}: {item.outputFile}
                    {item.clip && ` (${item.clip.start}s → ${item.clip.end}s, ${item.clip.duration}s)`}
                  </span>
                )}
                {item.type === 'encoding' && (
                  <span>
                    🎬 Encoding clip {item.current}/{item.total}: {item.percent}% 
                    {item.timemark && ` - ${item.timemark}`}
                  </span>
                )}
                {item.type === 'success' && (
                  <span>
                    ✅ Clip {item.clipNumber}: {item.fileName} 
                    ({item.actualDuration}s, {item.fileSize})
                  </span>
                )}
                {item.type === 'error' && (
                  <span>❌ Error: {item.message}</span>
                )}
                {item.type === 'warning' && (
                  <span>⚠️ Warning: {item.message}</span>
                )}
                {item.type === 'complete' && (
                  <div className="complete-summary">
                    <h4>🎉 Processing Complete!</h4>
                    <p>✅ Success: {item.successCount} | ❌ Errors: {item.errorCount} | 📁 Total: {item.totalClips}</p>
                    <p>📂 Output: {item.outputDir}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && results.results && results.results.length > 0 && (
        <div className="results-section">
          <h3>📊 Results Summary</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>#</th>
                <th>File Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Requested</th>
                <th>Actual</th>
                <th>Size</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.results.map((result, index) => (
                <tr key={index}>
                  <td>{result.clipNumber}</td>
                  <td className="filename">{result.fileName}</td>
                  <td>{result.inputStart.toFixed(2)}s</td>
                  <td>{result.inputEnd.toFixed(2)}s</td>
                  <td>{result.requestedDuration}s</td>
                  <td className={
                    Math.abs(parseFloat(result.actualDuration) - parseFloat(result.requestedDuration)) > 0.1
                      ? 'duration-warning'
                      : ''
                  }>
                    {result.actualDuration}s
                  </td>
                  <td>{result.fileSize}</td>
                  <td>✅</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VideoClipper;

