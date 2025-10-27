import { useState, useEffect } from 'react';
import './MotionAnalyzer.css';

function MotionAnalyzer() {
  const [videoPath, setVideoPath] = useState('');
  const [supplierFolder, setSupplierFolder] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [progress, setProgress] = useState([]);
  const [clips, setClips] = useState([]);
  const [errors, setErrors] = useState([]);

  // Check if server is online
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/health');
        setServerOnline(response.ok);
      } catch (error) {
        setServerOnline(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async () => {
    if (!videoPath.trim()) {
      alert('Please enter a video filename');
      return;
    }

    setIsAnalyzing(true);
    setProgress([]);
    setClips([]);
    setErrors([]);

    try {
      const response = await fetch('http://localhost:3001/api/analyze-motion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoPath: videoPath.trim(),
          supplierFolder: supplierFolder.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

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

            if (data.type === 'progress') {
              setProgress(prev => [...prev, data.message]);
            } else if (data.type === 'complete') {
              setClips(data.clips || []);
            } else if (data.type === 'error') {
              setErrors(prev => [...prev, data.message]);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing video:', error);
      setErrors([error.message]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadXML = () => {
    const baseFileName = videoPath.replace(/\.[^/.]+$/, '');
    const xmlFileName = `${baseFileName}_markers.xml`;
    const xmlPath = supplierFolder 
      ? `/downloaded-videos/${supplierFolder}/${xmlFileName}`
      : `/downloaded-videos/${xmlFileName}`;
    
    window.open(`http://localhost:3001${xmlPath}`, '_blank');
  };

  return (
    <div className="motion-analyzer-container">
      <div className="motion-analyzer-header">
        <h2>🎬 Motion Analyzer</h2>
        <p className="motion-analyzer-subtitle">Analyze videos and create Premiere Pro markers</p>
      </div>

      {/* Server Status */}
      <div className={`server-status ${serverOnline ? 'online' : 'offline'}`}>
        <span className="status-indicator"></span>
        {serverOnline ? 'Server Online' : 'Server Offline'}
      </div>

      {/* Input Section */}
      <div className="motion-input-section">
        <div className="input-group">
          <label htmlFor="supplierFolder">
            📁 Supplier Folder (optional)
            <span className="label-hint">Leave empty for default folder</span>
          </label>
          <input
            id="supplierFolder"
            type="text"
            value={supplierFolder}
            onChange={(e) => setSupplierFolder(e.target.value)}
            placeholder="31638097"
            disabled={isAnalyzing}
            className="folder-input"
          />
          <small className="input-help">
            Enter the supplier ID folder (e.g., "31638097") or leave empty
          </small>
        </div>

        <div className="input-group">
          <label htmlFor="videoPath">
            🎥 Video Filename *
          </label>
          <input
            id="videoPath"
            type="text"
            value={videoPath}
            onChange={(e) => setVideoPath(e.target.value)}
            placeholder="1PWF92_EK4Q2TFQNB_fc.mov"
            disabled={isAnalyzing}
            className="folder-input"
            required
          />
          <small className="input-help">
            Enter the video filename (must be in downloaded-videos folder)
          </small>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !serverOnline || !videoPath.trim()}
          className={`analyze-button ${isAnalyzing ? 'analyzing' : ''}`}
        >
          {isAnalyzing ? (
            <>
              <span className="spinner"></span>
              Analyzing Video...
            </>
          ) : (
            <>
              <span className="button-icon">🎬</span>
              Analyze Motion
            </>
          )}
        </button>
      </div>

      {/* Progress Section */}
      {progress.length > 0 && (
        <div className="motion-progress-section">
          <h3>📊 Analysis Progress</h3>
          <div className="progress-log">
            {progress.map((msg, idx) => (
              <div key={idx} className="progress-line">
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      {clips.length > 0 && (
        <div className="motion-results-section">
          <div className="results-header">
            <h3>✅ Motion Clips Detected ({clips.length})</h3>
            <button onClick={downloadXML} className="download-xml-button">
              📥 Download XML Markers
            </button>
          </div>

          <div className="clips-summary">
            <div className="summary-stat">
              <span className="stat-label">Total Clips:</span>
              <span className="stat-value">{clips.length}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Total Duration:</span>
              <span className="stat-value">
                {clips.reduce((sum, clip) => sum + clip.duration, 0).toFixed(1)}s
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Avg Motion:</span>
              <span className="stat-value">
                {(clips.reduce((sum, clip) => sum + clip.motion_score, 0) / clips.length).toFixed(1)}
              </span>
            </div>
          </div>

          <div className="clips-list">
            {clips.map((clip, idx) => (
              <div key={idx} className="clip-item">
                <div className="clip-header">
                  <span className="clip-number">Clip {idx + 1}</span>
                  <span className="clip-duration">{clip.duration.toFixed(1)}s</span>
                </div>
                <div className="clip-details">
                  <div className="clip-time">
                    <span className="time-label">Start:</span>
                    <span className="time-value">{formatTime(clip.start)}</span>
                    <span className="time-separator">→</span>
                    <span className="time-label">End:</span>
                    <span className="time-value">{formatTime(clip.end)}</span>
                  </div>
                  <div className="clip-motion">
                    <span className="motion-label">Motion Score:</span>
                    <div className="motion-bar-container">
                      <div 
                        className="motion-bar-fill" 
                        style={{ width: `${Math.min(clip.motion_score * 2, 100)}%` }}
                      ></div>
                      <span className="motion-value">{clip.motion_score.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Section */}
      {errors.length > 0 && (
        <div className="errors-section">
          <h3>⚠️ Errors</h3>
          <div className="errors-list">
            {errors.map((error, idx) => (
              <div key={idx} className="error-item">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      {!isAnalyzing && clips.length === 0 && (
        <div className="info-section">
          <div className="info-card">
            <h4>ℹ️ How it works</h4>
            <ul>
              <li>Enter the video filename from downloaded-videos folder</li>
              <li>Optionally specify supplier folder</li>
              <li>Click "Analyze Motion" to detect active scenes</li>
              <li>Clips are created between 9-20 seconds</li>
              <li>Download XML markers for Premiere Pro</li>
            </ul>
          </div>

          <div className="info-card">
            <h4>🎯 What gets detected</h4>
            <ul>
              <li><strong>Motion Scenes:</strong> Active segments with movement</li>
              <li><strong>Skip Static:</strong> Idle scenes are automatically removed</li>
              <li><strong>Perfect Length:</strong> 9-20 second clips for editing</li>
              <li><strong>Premiere Ready:</strong> Import XML directly into Premiere Pro</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format seconds to MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default MotionAnalyzer;

