import { useState, useEffect } from 'react';
import './FileRenamer.css';

function FileRenamer() {
  const [folderPath, setFolderPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });
  const [renamedFiles, setRenamedFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  // Check server health
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

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      const firstFile = files[0];
      const fullPath = firstFile.webkitRelativePath || firstFile.name;
      const folderName = fullPath.substring(0, fullPath.lastIndexOf('/')) || fullPath;
      setFolderPath('public/' + folderName);
    }
  };

  const handleRename = async () => {
    const finalPath = folderPath || 'public/Videos';
    
    if (!finalPath.trim()) {
      alert('Please select a folder');
      return;
    }

    setIsRenaming(true);
    setProgress({ current: 0, total: 0, currentFile: '', status: 'starting' });
    setRenamedFiles([]);
    setErrors([]);

    try {
      const response = await fetch('http://localhost:3001/api/rename-files', {
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
                status: 'processing'
              });
            } else if (data.type === 'success') {
              setRenamedFiles(prev => [...prev, {
                oldName: data.oldName,
                newName: data.newName
              }]);
            } else if (data.type === 'skipped') {
              // File already has correct format, skipped
            } else if (data.type === 'error') {
              setErrors(prev => [...prev, {
                file: data.file,
                error: data.error
              }]);
            } else if (data.type === 'complete') {
              setProgress(prev => ({ ...prev, status: 'complete' }));
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error renaming files:', error);
      setErrors([{ file: 'System', error: error.message }]);
    } finally {
      setIsRenaming(false);
    }
  };

  const progressPercentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="file-renamer-container">
      <div className="file-renamer-header">
        <h2>📝 File Renamer</h2>
        <p className="file-renamer-subtitle">Batch rename video files to standardized format</p>
      </div>

      <div className={`server-status ${serverOnline ? 'online' : 'offline'}`}>
        <span className="status-indicator"></span>
        {serverOnline ? 'Server Online' : 'Server Offline'}
      </div>

      {/* Input Section */}
      <div className="rename-input-section">
        <div className="input-group">
          <label>
            📁 Video Folder *
            <span className="label-hint">(Select from public/ directory or leave empty for default)</span>
          </label>
          <div className="folder-selector">
            <input
              id="folderInput"
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              disabled={isRenaming}
              style={{ display: 'none' }}
            />
            <label htmlFor="folderInput" className="select-folder-btn">
              📂 Select Folder
            </label>
            {folderPath ? (
              <div className="selected-folder-info">
                <span className="folder-icon">✅</span>
                <span className="folder-path">{folderPath}</span>
                {selectedFiles.length > 0 && (
                  <span className="file-count">({selectedFiles.length} files)</span>
                )}
              </div>
            ) : (
              <div className="default-folder-info">
                <span className="folder-icon">ℹ️</span>
                <span className="folder-path">Will use: public/Videos</span>
              </div>
            )}
          </div>
          <small className="input-help">
            Select folder from public/ directory (or leave empty for default: public/Videos)
          </small>
        </div>

        <button
          onClick={handleRename}
          disabled={isRenaming || !serverOnline}
          className={`rename-button ${isRenaming ? 'renaming' : ''}`}
        >
          {isRenaming ? (
            <>
              <span className="spinner"></span>
              Renaming Files...
            </>
          ) : (
            <>
              <span className="button-icon">✏️</span>
              Rename Files
            </>
          )}
        </button>
      </div>

      {/* Rename Patterns Info */}
      <div className="patterns-info">
        <h3>📋 Rename Patterns</h3>
        <div className="pattern-examples">
          <div className="pattern-item">
            <span className="pattern-label">Case 1:</span>
            <div className="pattern-change">
              <span className="before">1PWF92_EK4Q2TFQNB_0000001.mp4</span>
              <span className="arrow">→</span>
              <span className="after">1PWF92_EK4Q2TFQNB_fc-0000001.mp4</span>
            </div>
            <small>Adds "_fc-" before sequence number</small>
          </div>
          <div className="pattern-item">
            <span className="pattern-label">Case 2:</span>
            <div className="pattern-change">
              <span className="before">1PWF92_EKMUVX5H0D_fc_0000006.mov</span>
              <span className="arrow">→</span>
              <span className="after">1PWF92_EKMUVX5H0D_fc-0000006.mov</span>
            </div>
            <small>Replaces "_fc_" with "_fc-"</small>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {isRenaming && progress.status !== 'idle' && (
        <div className="rename-progress-section">
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
          <p className="current-file-info">
            {progress.status === 'processing' && `📄 Current file: ${progress.currentFile}`}
          </p>
        </div>
      )}

      {/* Renamed Files List */}
      {renamedFiles.length > 0 && (
        <div className="renamed-files-section">
          <h3>✅ Renamed Files ({renamedFiles.length})</h3>
          <div className="files-list">
            {renamedFiles.map((file, index) => (
              <div key={index} className="file-item">
                <div className="rename-change">
                  <span className="old-name">📄 {file.oldName}</span>
                  <span className="arrow">→</span>
                  <span className="new-name">✅ {file.newName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error List */}
      {errors.length > 0 && (
        <div className="errors-section">
          <h3>⚠️ Errors ({errors.length})</h3>
          <div className="errors-list">
            {errors.map((error, index) => (
              <div key={index} className="error-item">
                <span className="error-icon">❌</span>
                <span className="error-file">{error.file}:</span>
                <span className="error-message">{error.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      {!isRenaming && renamedFiles.length === 0 && (
        <div className="info-section">
          <div className="info-card">
            <h4>ℹ️ How it works</h4>
            <ul>
              <li>Enter folder path containing video files</li>
              <li>Tool scans for files matching rename patterns</li>
              <li>Files are renamed according to standardized format</li>
              <li>Shows before/after for each renamed file</li>
              <li>Files already in correct format are skipped</li>
            </ul>
          </div>

          <div className="info-card">
            <h4>⚠️ Important Notes</h4>
            <ul>
              <li><strong>Backup:</strong> Make sure to backup files before renaming</li>
              <li><strong>Undo:</strong> Renaming is permanent (no undo)</li>
              <li><strong>Format:</strong> Only processes video files (mp4, mov, avi, etc.)</li>
              <li><strong>Safe:</strong> Skips files that don't match patterns</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileRenamer;

