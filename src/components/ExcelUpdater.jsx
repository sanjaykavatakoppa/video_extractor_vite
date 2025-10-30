import { useState, useEffect } from 'react';
import './ExcelUpdater.css';

function ExcelUpdater() {
  const [folderPath, setFolderPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    baseFilename: '',
    status: 'idle'
  });
  const [results, setResults] = useState({
    totalFiles: 0,
    updatedFiles: [],
    notFoundFiles: [],
    errorFiles: []
  });
  const [suggestedPaths, setSuggestedPaths] = useState([]);

  // Check server health and get suggested paths
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/health');
        setServerOnline(response.ok);
      } catch (error) {
        setServerOnline(false);
      }
    };
    
    const getSuggestedPaths = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/suggested-paths');
        if (response.ok) {
          const data = await response.json();
          setSuggestedPaths(data.paths || []);
        }
      } catch (error) {
        console.error('Failed to fetch suggested paths:', error);
      }
    };
    
    checkServer();
    getSuggestedPaths();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      const firstFile = files[0];
      const fullPath = firstFile.webkitRelativePath || firstFile.name;
      const pathParts = fullPath.split('/');
      const folderName = pathParts[0];
      const finalPath = 'public/' + folderName;
      setFolderPath(finalPath);
      
      // Warn if selecting from outside project
      if (folderName !== 'Videos' && !folderName.startsWith('test')) {
        alert('⚠️ WARNING: You selected a folder from outside the project!\n\n' +
              'The Browse button only works for folders inside video_extractor_vite/public/\n\n' +
              'For external folders:\n' +
              '1. Clear the path field\n' +
              '2. Type the FULL path manually\n' +
              '3. Example: /Users/sanjayak/Dropbox/Videos\n\n' +
              'Click OK to clear and try again.');
        setFolderPath('');
        setSelectedFiles([]);
      }
    }
  };

  const handleUpdate = async () => {
    const finalPath = folderPath || 'public/Videos';
    
    setIsUpdating(true);
    setProgress({ current: 0, total: 0, currentFile: '', baseFilename: '', status: 'starting' });
    setResults({ totalFiles: 0, updatedFiles: [], notFoundFiles: [], errorFiles: [] });

    try {
      const response = await fetch('http://localhost:3001/api/update-excel-from-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath: finalPath })
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
              setProgress({
                current: data.current,
                total: data.total,
                currentFile: data.file,
                baseFilename: data.baseFilename,
                status: 'processing'
              });
            } else if (data.type === 'updated') {
              setResults(prev => ({
                ...prev,
                updatedFiles: [...prev.updatedFiles, {
                  file: data.file,
                  baseFilename: data.baseFilename,
                  message: data.message
                }]
              }));
            } else if (data.type === 'notfound') {
              setResults(prev => ({
                ...prev,
                notFoundFiles: [...prev.notFoundFiles, {
                  file: data.file,
                  baseFilename: data.baseFilename,
                  message: data.message
                }]
              }));
            } else if (data.type === 'error') {
              setResults(prev => ({
                ...prev,
                errorFiles: [...prev.errorFiles, {
                  file: data.file || 'Unknown',
                  message: data.message
                }]
              }));
            } else if (data.type === 'complete') {
              setResults(prev => ({
                ...prev,
                totalFiles: data.totalFiles
              }));
              setProgress(prev => ({ ...prev, status: 'complete' }));
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error updating Excel:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const progressPercentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="excel-updater-container">
      <div className="excel-updater-header">
        <h2>📊 Excel Updater</h2>
        <p className="excel-updater-subtitle">Update Excel download status from video files</p>
      </div>

      <div className={`server-status ${serverOnline ? 'online' : 'offline'}`}>
        <span className="status-indicator"></span>
        {serverOnline ? 'Server Online' : 'Server Offline'}
      </div>

      {/* Input Section */}
      <div className="updater-input-section">
        <div className="input-group">
          <label>
            📁 Video Folder *
            <span className="label-hint">(Type path or browse public/)</span>
          </label>
          <div className="folder-selector">
            <input
              type="text"
              className="folder-path-input"
              placeholder="Enter folder path (e.g., /Users/name/Dropbox/Videos)"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              disabled={isUpdating}
            />
            <button
              type="button"
              className="select-folder-btn"
              onClick={() => document.getElementById('excelFolderInput').click()}
              disabled={isUpdating}
              title="Browse public/ directory only"
            >
              📂 Browse
            </button>
            <input
              id="excelFolderInput"
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              disabled={isUpdating}
              style={{ display: 'none' }}
            />
          </div>
          {selectedFiles.length > 0 && (
            <div className="file-count-info">
              <span className="file-count-badge">📄 {selectedFiles.length} files selected</span>
            </div>
          )}
          <small className="input-help">
            ⚠️ For external folders: <strong>Type the full path manually</strong>
            <br />
            📂 Browse button only works for public/ directory
          </small>
          
          {suggestedPaths.length > 0 && (
            <div className="suggested-paths">
              <label className="suggested-label">
                ⚡ Quick Select (click to use):
              </label>
              <div className="suggested-paths-grid">
                {suggestedPaths.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="suggested-path-btn"
                    onClick={() => setFolderPath(suggestion.path)}
                    disabled={isUpdating}
                    title={suggestion.path}
                  >
                    <span className="path-icon">📁</span>
                    <span className="path-name">{suggestion.name}</span>
                    <span className="path-count">({suggestion.fileCount} files)</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleUpdate}
          disabled={isUpdating || !serverOnline}
          className={`update-button ${isUpdating ? 'updating' : ''}`}
        >
          {isUpdating ? (
            <>
              <span className="spinner"></span>
              Updating Excel...
            </>
          ) : (
            <>
              <span className="button-icon">⚡</span>
              Update Excel Status
            </>
          )}
        </button>
      </div>

      {/* Info Section */}
      <div className="updater-info-section">
        <h3>ℹ️ How it works</h3>
        <div className="info-content">
          <p>
            This tool scans video files in the selected folder and updates the Excel download status.
            For each video file (e.g., <code>1PWF92_EK4Q2TFQNB_fc-0000001.mp4</code>), it:
          </p>
          <ol>
            <li>Extracts the base name (<code>1PWF92_EK4Q2TFQNB</code>)</li>
            <li>Searches for this name in the Excel "File Name" column</li>
            <li>Updates the "Download Status" column to "Downloaded" if found</li>
          </ol>
        </div>
      </div>

      {/* Progress Section */}
      {isUpdating && progress.status !== 'idle' && (
        <div className="updater-progress-section">
          <div className="progress-header">
            <h3>⚙️ Processing</h3>
            <span className="progress-count">{progress.current} / {progress.total} files</span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          {progress.status === 'processing' && (
            <div className="current-file-info">
              <p>
                <strong>📄 Current file:</strong> {progress.currentFile}
              </p>
              <p>
                <strong>🔍 Base name:</strong> {progress.baseFilename}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {results.totalFiles > 0 && (
        <div className="results-section">
          <div className="results-summary">
            <h3>📊 Summary</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Total Files:</span>
                <span className="stat-value">{results.totalFiles}</span>
              </div>
              <div className="stat-item updated">
                <span className="stat-label">Updated:</span>
                <span className="stat-value">{results.updatedFiles.length}</span>
              </div>
              <div className="stat-item notfound">
                <span className="stat-label">Not Found:</span>
                <span className="stat-value">{results.notFoundFiles.length}</span>
              </div>
              <div className="stat-item error">
                <span className="stat-label">Errors:</span>
                <span className="stat-value">{results.errorFiles.length}</span>
              </div>
            </div>
          </div>

          {/* Updated Files */}
          {results.updatedFiles.length > 0 && (
            <div className="results-list-section updated-section">
              <h3>✅ Updated Files ({results.updatedFiles.length})</h3>
              <div className="results-list">
                {results.updatedFiles.map((item, index) => (
                  <div key={index} className="result-item updated-item">
                    <span className="result-icon">✅</span>
                    <div className="result-info">
                      <span className="result-file">{item.file}</span>
                      <span className="result-base">Base: {item.baseFilename}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Found Files */}
          {results.notFoundFiles.length > 0 && (
            <div className="results-list-section notfound-section">
              <h3>⚠️ Not Found in Excel ({results.notFoundFiles.length})</h3>
              <div className="results-list">
                {results.notFoundFiles.map((item, index) => (
                  <div key={index} className="result-item notfound-item">
                    <span className="result-icon">⚠️</span>
                    <div className="result-info">
                      <span className="result-file">{item.file}</span>
                      <span className="result-base">Base: {item.baseFilename}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Files */}
          {results.errorFiles.length > 0 && (
            <div className="results-list-section error-section">
              <h3>❌ Errors ({results.errorFiles.length})</h3>
              <div className="results-list">
                {results.errorFiles.map((item, index) => (
                  <div key={index} className="result-item error-item">
                    <span className="result-icon">❌</span>
                    <div className="result-info">
                      <span className="result-file">{item.file}</span>
                      <span className="result-error">{item.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExcelUpdater;

