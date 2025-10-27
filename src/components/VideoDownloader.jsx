import React, { useState } from 'react';
import './VideoDownloader.css';

const VideoDownloader = () => {
  const [startRow, setStartRow] = useState(1);
  const [numberOfVideos, setNumberOfVideos] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [serverOnline, setServerOnline] = useState(null);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    percentage: 0,
    downloadedMB: 0,
    totalMB: 0
  });
  const [downloadedFiles, setDownloadedFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  // Check server status on component mount
  React.useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch (error) {
      setServerOnline(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadedFiles([]);
    setErrors([]);
    setProgress({ 
      current: 0, 
      total: 0, 
      currentFile: '', 
      percentage: 0,
      downloadedMB: 0,
      totalMB: 0
    });

    try {
      // Call the backend server API
      const response = await fetch('http://localhost:3001/api/download-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startRow: startRow,
          numberOfVideos: numberOfVideos
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        lines.forEach(line => {
          if (!line.trim()) return;

          try {
            const data = JSON.parse(line);
            
            if (data.type === 'progress') {
              setProgress({
                current: data.current,
                total: data.total,
                currentFile: data.file,
                percentage: data.percentage,
                downloadedMB: data.downloadedMB || 0,
                totalMB: data.totalMB || 0
              });
            } else if (data.type === 'success') {
              setDownloadedFiles(prev => [...prev, data.file]);
            } else if (data.type === 'error') {
              setErrors(prev => [...prev, data]);
            } else if (data.type === 'complete') {
              console.log('Download complete:', data);
            }
          } catch (e) {
            console.warn('Failed to parse line:', line, e);
          }
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      setErrors(prev => [...prev, { file: 'Connection', message: error.message }]);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="video-downloader-container">
      <div className="downloader-card">
        <div className="header-section">
          <div>
            <h2>📥 Video Downloader</h2>
            <p className="subtitle">Download videos from Excel using API</p>
          </div>
          <div className="server-status">
            {serverOnline === null ? (
              <span className="status-checking">⏳ Checking server...</span>
            ) : serverOnline ? (
              <span className="status-online">✅ API Server Online</span>
            ) : (
              <span className="status-offline">❌ Server Offline</span>
            )}
          </div>
        </div>

        {serverOnline === false && (
          <div className="error-banner">
            <strong>⚠️ API Server Not Running</strong>
            <p>Please run: <code>npm run server</code> in a separate terminal</p>
          </div>
        )}

        <div className="download-controls">
          <div className="input-group">
            <label htmlFor="startRow">
              <span className="label-icon">📊</span>
              Start from Row:
            </label>
            <input
              id="startRow"
              type="number"
              min="1"
              max="500"
              value={startRow}
              onChange={(e) => setStartRow(parseInt(e.target.value) || 1)}
              disabled={isDownloading}
              placeholder="e.g., 1"
            />
            <span className="helper-text">Excel row number (1-500)</span>
          </div>

          <div className="input-group">
            <label htmlFor="numberOfVideos">
              <span className="label-icon">🎬</span>
              Number of Videos:
            </label>
            <input
              id="numberOfVideos"
              type="number"
              min="1"
              max="50"
              value={numberOfVideos}
              onChange={(e) => setNumberOfVideos(parseInt(e.target.value) || 1)}
              disabled={isDownloading}
              placeholder="e.g., 5"
            />
            <span className="helper-text">How many videos to download (1-50)</span>
          </div>

          <button
            className="download-btn"
            onClick={handleDownload}
            disabled={isDownloading || !serverOnline}
          >
            {isDownloading ? (
              <>
                <span className="spinner-small"></span>
                Downloading...
              </>
            ) : (
              <>
                <span>⬇️</span>
                Start Download
              </>
            )}
          </button>
        </div>

        {/* Progress Section */}
        {isDownloading && (
          <div className="progress-section">
            {progress.total > 0 && (
              <>
                <div className="progress-header">
                  <span>Video {progress.current} of {progress.total}</span>
                  <span className="progress-percentage">{progress.percentage}%</span>
                </div>
                
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>

                {progress.currentFile && (
                  <div className="current-file-info">
                    <span className="file-icon">📄</span>
                    <div className="file-progress-details">
                      <div className="file-name">{progress.currentFile}</div>
                      {progress.downloadedMB && progress.totalMB && (
                        <div className="file-size-progress">
                          {progress.downloadedMB} MB / {progress.totalMB} MB
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {progress.total === 0 && (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Initializing download...</p>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {(downloadedFiles.length > 0 || errors.length > 0) && (
          <div className="results-section">
            <div className="results-summary">
              <div className="summary-item success">
                <div className="summary-number">{downloadedFiles.length}</div>
                <div className="summary-label">Downloaded</div>
              </div>
              <div className="summary-item error">
                <div className="summary-number">{errors.length}</div>
                <div className="summary-label">Errors</div>
              </div>
            </div>

            {/* Downloaded Files List */}
            {downloadedFiles.length > 0 && (
              <div className="files-list success-list">
                <h3>✅ Successfully Downloaded ({downloadedFiles.length})</h3>
                <div className="list-items">
                  {downloadedFiles.map((file, index) => (
                    <div key={index} className="list-item success-item">
                      <span className="item-icon">✓</span>
                      <span className="item-text">{file.name}</span>
                      <span className="item-size">{file.size}</span>
                      {file.excelUpdated && (
                        <span className="excel-badge" title="Excel updated">📝</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors List */}
            {errors.length > 0 && (
              <div className="files-list error-list">
                <h3>❌ Errors ({errors.length})</h3>
                <div className="list-items">
                  {errors.map((error, index) => (
                    <div key={index} className="list-item error-item">
                      <span className="item-icon">✗</span>
                      <span className="item-text">{error.file || 'Unknown'}</span>
                      <span className="item-error">{error.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="info-box">
          <h4>ℹ️ How it works:</h4>
          <ul>
            <li>Reads Clip IDs from <code>video.xlsx</code></li>
            <li>Fetches video metadata from API</li>
            <li>Downloads comp renditions (<code>_fc.mov</code> files)</li>
            <li>Files saved to <code>public/downloaded-videos/</code></li>
            <li><strong>Updates Excel</strong> with "Downloaded" status <span style={{fontSize: '16px'}}>📝</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VideoDownloader;

