import { useState, useEffect } from 'react';
import './XmlDurationChecker.css';

function XmlDurationChecker() {
  const [folderPath, setFolderPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });
  const [results, setResults] = useState({
    totalFiles: 0,
    issueFiles: [],
    validFiles: 0
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
      if (folderName !== 'Videos' && folderName !== 'xml-files' && !folderName.startsWith('test')) {
        alert('⚠️ WARNING: You selected a folder from outside the project!\n\n' +
              'The Browse button only works for folders inside video_extractor_vite/public/\n\n' +
              'For external folders:\n' +
              '1. Clear the path field\n' +
              '2. Type the FULL path manually\n' +
              '3. Example: /Users/sanjayak/Dropbox/xml-files\n\n' +
              'Click OK to clear and try again.');
        setFolderPath('');
        setSelectedFiles([]);
      }
    }
  };

  const handleCheck = async () => {
    const finalPath = folderPath || 'public/Videos';
    
    setIsChecking(true);
    setProgress({ current: 0, total: 0, currentFile: '', status: 'starting' });
    setResults({ totalFiles: 0, issueFiles: [], validFiles: 0 });

    try {
      const response = await fetch('http://localhost:3001/api/check-xml-duration', {
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
            } else if (data.type === 'issue') {
              setResults(prev => ({
                ...prev,
                issueFiles: [...prev.issueFiles, {
                  filename: data.filename,
                  duration: data.duration,
                  seconds: data.seconds,
                  reason: data.reason
                }]
              }));
            } else if (data.type === 'complete') {
              setResults(prev => ({
                ...prev,
                totalFiles: data.totalFiles,
                validFiles: data.validFiles
              }));
              setProgress(prev => ({ ...prev, status: 'complete' }));
            } else if (data.type === 'error') {
              console.error('Error:', data.message);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error checking XML files:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsChecking(false);
    }
  };

  const downloadReport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let reportContent = 'XML Files Duration Report\n';
    reportContent += '='.repeat(50) + '\n';
    reportContent += `Generated: ${new Date().toLocaleString()}\n`;
    reportContent += `Folder: ${folderPath || 'public/Videos'}\n`;
    reportContent += '='.repeat(50) + '\n\n';
    
    reportContent += `Total files checked: ${results.totalFiles}\n`;
    reportContent += `Files with issues: ${results.issueFiles.length}\n`;
    reportContent += `Valid files: ${results.validFiles}\n\n`;
    
    reportContent += 'Files with duration < 9 seconds or > 20 seconds:\n';
    reportContent += '-'.repeat(50) + '\n\n';
    
    if (results.issueFiles.length === 0) {
      reportContent += 'No issues found! All files have valid durations.\n';
    } else {
      results.issueFiles.forEach((file, index) => {
        reportContent += `${index + 1}. ${file.filename}\n`;
        reportContent += `   Duration: ${file.duration} (${file.seconds} seconds)\n`;
        reportContent += `   Issue: ${file.reason}\n\n`;
      });
    }
    
    reportContent += '='.repeat(50) + '\n';
    reportContent += 'End of Report\n';

    // Create blob and download
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xml-duration-report-${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const progressPercentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="xml-checker-container">
      <div className="xml-checker-header">
        <h2>📊 XML Duration Checker</h2>
        <p className="xml-checker-subtitle">Check XML files for duration issues (&lt; 9s or &gt; 20s)</p>
      </div>

      <div className={`server-status ${serverOnline ? 'online' : 'offline'}`}>
        <span className="status-indicator"></span>
        {serverOnline ? 'Server Online' : 'Server Offline'}
      </div>

      {/* Input Section */}
      <div className="checker-input-section">
        <div className="input-group">
          <label>
            📁 XML Folder *
            <span className="label-hint">(Type path or browse public/)</span>
          </label>
          <div className="folder-selector">
            <input
              type="text"
              className="folder-path-input"
              placeholder="Enter folder path (e.g., /Users/name/Dropbox/xml-files)"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              disabled={isChecking}
            />
            <button
              type="button"
              className="select-folder-btn"
              onClick={() => document.getElementById('xmlFolderInput').click()}
              disabled={isChecking}
              title="Browse public/ directory only"
            >
              📂 Browse
            </button>
            <input
              id="xmlFolderInput"
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              disabled={isChecking}
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
                    disabled={isChecking}
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
          onClick={handleCheck}
          disabled={isChecking || !serverOnline}
          className={`check-button ${isChecking ? 'checking' : ''}`}
        >
          {isChecking ? (
            <>
              <span className="spinner"></span>
              Checking Files...
            </>
          ) : (
            <>
              <span className="button-icon">🔍</span>
              Check Duration
            </>
          )}
        </button>
      </div>

      {/* Duration Criteria Info */}
      <div className="criteria-info">
        <h3>📋 Validation Criteria</h3>
        <div className="criteria-items">
          <div className="criteria-item valid">
            <span className="criteria-icon">✅</span>
            <span className="criteria-text">Valid: 9 seconds ≤ duration ≤ 20 seconds</span>
          </div>
          <div className="criteria-item invalid">
            <span className="criteria-icon">❌</span>
            <span className="criteria-text">Invalid: duration &lt; 9 seconds OR duration &gt; 20 seconds</span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {isChecking && progress.status !== 'idle' && (
        <div className="checker-progress-section">
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
              <div className="stat-item issue">
                <span className="stat-label">Files with Issues:</span>
                <span className="stat-value">{results.issueFiles.length}</span>
              </div>
              <div className="stat-item valid">
                <span className="stat-label">Valid Files:</span>
                <span className="stat-value">{results.validFiles}</span>
              </div>
            </div>
            
            {results.issueFiles.length > 0 && (
              <button onClick={downloadReport} className="download-report-btn">
                📥 Download Report
              </button>
            )}
          </div>

          {results.issueFiles.length > 0 ? (
            <div className="issue-files-section">
              <h3>⚠️ Files with Duration Issues ({results.issueFiles.length})</h3>
              <div className="issue-files-list">
                {results.issueFiles.map((file, index) => (
                  <div key={index} className="issue-file-item">
                    <div className="issue-file-header">
                      <span className="issue-number">{index + 1}</span>
                      <span className="issue-filename">📄 {file.filename}</span>
                    </div>
                    <div className="issue-file-details">
                      <span className="detail-item">
                        <strong>Duration:</strong> {file.duration} ({file.seconds}s)
                      </span>
                      <span className={`issue-badge ${file.reason.includes('short') ? 'short' : 'long'}`}>
                        {file.reason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-issues-section">
              <div className="success-icon">✅</div>
              <h3>All Clear!</h3>
              <p>No duration issues found. All files have valid durations (9-20 seconds).</p>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      {!isChecking && results.totalFiles === 0 && (
        <div className="info-section">
          <div className="info-card">
            <h4>ℹ️ How it works</h4>
            <ul>
              <li>Select folder containing XML files</li>
              <li>Tool scans all XML files in the folder</li>
              <li>Extracts &lt;Duration&gt; field from each XML</li>
              <li>Checks if duration is &lt; 9 seconds or &gt; 20 seconds</li>
              <li>Shows list of problematic files</li>
              <li>Download text report with all issues</li>
            </ul>
          </div>

          <div className="info-card">
            <h4>📋 Report Contents</h4>
            <ul>
              <li><strong>Summary:</strong> Total files, issues count, valid count</li>
              <li><strong>File List:</strong> Each file with duration issue</li>
              <li><strong>Duration:</strong> Shows actual duration and seconds</li>
              <li><strong>Issue Type:</strong> Too short or too long</li>
              <li><strong>Format:</strong> Plain text (.txt) file</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default XmlDurationChecker;

