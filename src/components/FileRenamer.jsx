import { useState, useEffect } from 'react';
import './FileRenamer.css';

function FileRenamer() {
  const [folderPath, setFolderPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [excelFile, setExcelFile] = useState(null);
  const [excelPath, setExcelPath] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });
  const [renamedFiles, setRenamedFiles] = useState([]);
  const [skippedFiles, setSkippedFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
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
          console.log('📂 Suggested paths loaded:', data.paths);
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
      
      // Get the relative path from webkitRelativePath
      const fullPath = firstFile.webkitRelativePath || firstFile.name;
      const pathParts = fullPath.split('/');
      const folderName = pathParts[0]; // Just the folder name
      
      // For browse selection, use public/ prefix (browsers only allow public/ access)
      // User can type absolute paths manually in the text input
      const finalPath = 'public/' + folderName;
      setFolderPath(finalPath);
      console.log('📁 Folder selected via browse:', finalPath, `(${files.length} files)`);
      
      // Warn user if they selected from outside project
      if (folderName !== 'Videos' && folderName !== 'rename' && !folderName.startsWith('test')) {
        alert('⚠️ WARNING: You selected a folder from outside the project!\n\n' +
              'The Browse button only works for folders inside video_extractor_vite/public/\n\n' +
              'For Dropbox or other external folders:\n' +
              '1. Clear the path field\n' +
              '2. Type the FULL path manually\n' +
              '3. Example: /Users/sanjayak/Dropbox/Amc_recorded_video\n\n' +
              'Click OK to clear and try again.');
        setFolderPath('');
        setSelectedFiles([]);
      }
    }
  };

  const handleExcelSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcelFile(file);
      setExcelPath('public/' + file.name);
      console.log('📊 Excel file selected:', file.name);
    }
  };

  const handleRename = async () => {
    const finalPath = folderPath.trim() || 'public/Videos';
    
    if (!finalPath) {
      alert('⚠️ Please enter or select a folder path');
      return;
    }
    
    console.log('🔄 Starting rename + validation process...');
    console.log('📁 Folder path:', finalPath);
    if (excelPath) {
      console.log('📊 Excel file:', excelPath);
    }
    
    if (!serverOnline) {
      alert('⚠️ Server is offline! Please start the server first.');
      console.error('❌ Server is offline');
      return;
    }

    setIsRenaming(true);
    setProgress({ current: 0, total: 0, currentFile: '', status: 'starting' });
    setRenamedFiles([]);
    setSkippedFiles([]);
    setErrors([]);
    setSummary(null);
    setValidationResults(null);

    try {
      const requestBody = { 
        folderPath: finalPath,  // Can be absolute or relative path
        excelFile: excelPath || null  // Include Excel file if selected
      };
      
      console.log('📡 Sending request to:', 'http://localhost:3001/api/rename-files');
      console.log('📦 Request body:', requestBody);
      
      const response = await fetch('http://localhost:3001/api/rename-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      console.log('✅ Response received, starting to read stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let hasData = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ Stream complete');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        hasData = true;

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            console.log('📦 Received data:', data.type, data);

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
              setSkippedFiles(prev => [...prev, {
                file: data.file,
                reason: data.reason || 'Already in correct format'
              }]);
            } else if (data.type === 'error') {
              setErrors(prev => [...prev, {
                file: data.file,
                error: data.error
              }]);
            } else if (data.type === 'complete') {
              setProgress(prev => ({ ...prev, status: 'complete' }));
              if (data.summary) {
                setSummary(data.summary);
              }
            } else if (data.type === 'validation') {
              // Validation results from Excel comparison
              console.log('📊 Validation data received:', data);
              setValidationResults({
                totalInExcel: data.totalInExcel,
                totalVideos: data.totalVideos,
                matches: data.matches,
                missingInExcel: data.missingInExcel || [],
                extraVideos: data.extraVideos || []
              });
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error renaming files:', error);
      setErrors([{ file: 'System', error: error.message }]);
      alert(`Error: ${error.message}\n\nCheck the browser console for details.`);
    } finally {
      setIsRenaming(false);
      console.log('🏁 Rename process finished');
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
            <span className="label-hint">(Type path manually for network drives)</span>
          </label>
          <div className="folder-selector">
            <input
              type="text"
              className="folder-path-input"
              placeholder="Type full path here (e.g., /Users/name/Dropbox/Videos)"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              disabled={isRenaming}
            />
            <button
              type="button"
              className="select-folder-btn"
              onClick={() => document.getElementById('folderInput').click()}
              disabled={isRenaming}
              title="Browse public/ directory only"
            >
              📂 Browse
            </button>
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
          </div>
          {selectedFiles.length > 0 && (
            <div className="file-count-info">
              <span className="file-count-badge">📄 {selectedFiles.length} files selected</span>
            </div>
          )}
          <small className="input-help">
            ⚠️ For Dropbox, network drives, or folders outside this project:
            <br />
            <strong>Type the full path manually</strong> (e.g., /Users/sanjayak/Dropbox/Amc_recorded_video)
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
                    disabled={isRenaming}
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

        <div className="input-group">
          <label>
            📊 Excel File (Optional)
            <span className="label-hint">(For file validation)</span>
          </label>
          <div className="folder-selector">
            <input
              id="excelInput"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelSelect}
              disabled={isRenaming}
              style={{ display: 'none' }}
            />
            <label htmlFor="excelInput" className="select-folder-btn">
              📄 Select Excel File
            </label>
            {excelPath ? (
              <div className="selected-folder-info">
                <span className="folder-icon">✅</span>
                <span className="folder-path">{excelPath}</span>
              </div>
            ) : (
              <div className="default-folder-info">
                <span className="folder-icon">ℹ️</span>
                <span className="folder-path">No Excel file selected</span>
              </div>
            )}
          </div>
          <small className="input-help">
            Select Excel file to check which video files are NOT in Excel (validation happens during rename)
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
              Processing...
            </>
          ) : (
            <>
              <span className="button-icon">✏️</span>
              {excelPath ? 'Rename & Validate Files' : 'Rename Files'}
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

      {/* Validation Results */}
      {validationResults && (
        <div className="validation-results-section">
          <h3>🔍 Validation Results</h3>
          
          <div className="validation-summary">
            <div className="validation-stat">
              <span className="stat-label">Excel Entries:</span>
              <span className="stat-value">{validationResults.totalInExcel || 0}</span>
            </div>
            <div className="validation-stat">
              <span className="stat-label">Video Files:</span>
              <span className="stat-value">{validationResults.totalVideos || 0}</span>
            </div>
            <div className="validation-stat">
              <span className="stat-label">Videos in Excel:</span>
              <span className="stat-value success">{validationResults.matches || 0}</span>
            </div>
            <div className="validation-stat">
              <span className="stat-label">Not in Excel:</span>
              <span className="stat-value error">{validationResults.missingInExcel?.length || 0}</span>
            </div>
          </div>

          {/* Videos NOT in Excel */}
          {validationResults.missingInExcel && validationResults.missingInExcel.length > 0 && (
            <div className="validation-issues">
              <h4>❌ Videos NOT in Excel ({validationResults.missingInExcel.length})</h4>
              <p className="issue-description">These video files are NOT listed in Excel:</p>
              <div className="issues-list">
                {validationResults.missingInExcel.map((file, index) => (
                  <div key={index} className="issue-item missing">
                    <span className="issue-icon">🎬</span>
                    <span className="issue-filename">{file}</span>
                    <span className="issue-tag">Not in Excel</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Good */}
          {(!validationResults.missingInExcel || validationResults.missingInExcel.length === 0) && (
            <div className="validation-success">
              <div className="success-icon">✅</div>
              <h4>Perfect Match!</h4>
              <p>All video files are listed in Excel.</p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="summary-section">
          <h3>📊 Summary</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{summary.total || 0}</span>
            </div>
            <div className="stat-item success">
              <span className="stat-label">Renamed:</span>
              <span className="stat-value">{summary.renamed || 0}</span>
            </div>
            <div className="stat-item skipped">
              <span className="stat-label">Skipped:</span>
              <span className="stat-value">{summary.skipped || 0}</span>
            </div>
            <div className="stat-item error">
              <span className="stat-label">Errors:</span>
              <span className="stat-value">{summary.errors || 0}</span>
            </div>
          </div>
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

      {/* Skipped Files List */}
      {skippedFiles.length > 0 && (
        <div className="skipped-files-section">
          <h3>⏭️ Skipped Files ({skippedFiles.length})</h3>
          <div className="files-list">
            {skippedFiles.map((file, index) => (
              <div key={index} className="file-item skipped">
                <div className="file-info">
                  <span className="file-name">📄 {file.file}</span>
                  <span className="skip-reason">({file.reason})</span>
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

