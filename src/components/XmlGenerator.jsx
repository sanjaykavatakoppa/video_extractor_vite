import { useState, useEffect } from 'react';
import './XmlGenerator.css';

function XmlGenerator() {
  const [folderName, setFolderName] = useState('Videos');
  const [isGenerating, setIsGenerating] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });
  const [generatedFiles, setGeneratedFiles] = useState([]);
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

  const handleGenerateXml = async () => {
    if (!folderName.trim()) {
      alert('Please enter a folder name');
      return;
    }

    setIsGenerating(true);
    setProgress({ current: 0, total: 0, currentFile: '', status: 'starting' });
    setGeneratedFiles([]);
    setErrors([]);

    try {
      const response = await fetch('http://localhost:3001/api/generate-xml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderName })
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
              setGeneratedFiles(prev => [...prev, {
                video: data.videoFile,
                xml: data.xmlFile,
                title: data.title
              }]);
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
      console.error('Error generating XML:', error);
      setErrors([{ file: 'System', error: error.message }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const progressPercentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="xml-generator-container">
      <div className="xml-generator-header">
        <h2>📄 XML Generator</h2>
        <p className="xml-generator-subtitle">Generate XML files from video metadata</p>
      </div>

      {/* Server Status */}
      <div className={`server-status ${serverOnline ? 'online' : 'offline'}`}>
        <span className="status-indicator"></span>
        {serverOnline ? 'Server Online' : 'Server Offline'}
      </div>

      {/* Input Section */}
      <div className="xml-input-section">
        <div className="input-group">
          <label htmlFor="folderName">
            📁 Folder Name
            <span className="label-hint">(relative to public/ directory)</span>
          </label>
          <div className="input-with-prefix">
            <span className="input-prefix">public/</span>
            <input
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Videos"
              disabled={isGenerating}
              className="folder-input"
            />
          </div>
          <small className="input-help">
            Enter the folder name containing video files (e.g., "Videos" or "downloaded-videos/31638097")
          </small>
        </div>

        <button
          onClick={handleGenerateXml}
          disabled={isGenerating || !serverOnline || !folderName.trim()}
          className={`generate-button ${isGenerating ? 'generating' : ''}`}
        >
          {isGenerating ? (
            <>
              <span className="spinner"></span>
              Generating XML...
            </>
          ) : (
            <>
              <span className="button-icon">⚡</span>
              Generate XML Files
            </>
          )}
        </button>
      </div>

      {/* Progress Section */}
      {isGenerating && progress.status !== 'idle' && (
        <div className="xml-progress-section">
          <div className="progress-header">
            <span className="progress-label">
              {progress.status === 'complete' ? '✅ Complete' : '⚙️ Processing'}
            </span>
            <span className="progress-count">
              {progress.current} / {progress.total} files
            </span>
          </div>

          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill"
              style={{ width: `${progressPercentage}%` }}
            >
              <span className="progress-percentage">{progressPercentage}%</span>
            </div>
          </div>

          {progress.currentFile && (
            <div className="current-file-info">
              <span className="file-icon">📹</span>
              <span className="file-name">{progress.currentFile}</span>
            </div>
          )}
        </div>
      )}

      {/* Generated Files List */}
      {generatedFiles.length > 0 && (
        <div className="generated-files-section">
          <h3>✅ Generated XML Files ({generatedFiles.length})</h3>
          <div className="files-list">
            {generatedFiles.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-item-header">
                  <span className="file-icon">📄</span>
                  <span className="xml-filename">{file.xml}</span>
                </div>
                <div className="file-item-details">
                  <span className="detail-label">Video:</span>
                  <span className="detail-value">{file.video}</span>
                </div>
                {file.title && (
                  <div className="file-item-details">
                    <span className="detail-label">Title:</span>
                    <span className="detail-value">{file.title}</span>
                  </div>
                )}
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
                <span className="error-file">{error.file}</span>
                <span className="error-message">{error.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      {!isGenerating && generatedFiles.length === 0 && (
        <div className="info-section">
          <div className="info-card">
            <h4>ℹ️ How it works</h4>
            <ul>
              <li>Enter the folder name containing video files</li>
              <li>Click "Generate XML Files" to start</li>
              <li>XML files will be created in the same folder</li>
              <li>Each XML includes metadata from video, Excel, and JSON sources</li>
            </ul>
          </div>

          <div className="info-card">
            <h4>📋 Data Sources</h4>
            <ul>
              <li><strong>Video File:</strong> Duration, Resolution, FPS</li>
              <li><strong>Excel:</strong> Title, Description, TE_ParentClip</li>
              <li><strong>JSON:</strong> CountryOrigin</li>
              <li><strong>Fixed:</strong> CD_Category, Production_TextRef</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default XmlGenerator;

