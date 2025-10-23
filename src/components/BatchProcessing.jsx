import React from 'react';
import './BatchProcessing.css';

const BatchProcessing = ({ progress, results, errors, onDownload }) => {
  const { current, total, currentFile, status } = progress;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '📁';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return '#f59e0b';
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (total === 0) return null;

  return (
    <div className="batch-processing">
      <h3>Batch Processing</h3>
      
      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Processing {current} of {total} videos</span>
          <span className="progress-percentage">
            {Math.round((current / total) * 100)}%
          </span>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ 
              width: `${(current / total) * 100}%`,
              backgroundColor: getStatusColor(status)
            }}
          ></div>
        </div>
        
        {currentFile && (
          <div className="current-file">
            {getStatusIcon(status)} Currently processing: {currentFile}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {(results.length > 0 || errors.length > 0) && (
        <div className="results-summary">
          <div className="summary-cards">
            <div className="summary-card success">
              <div className="summary-number">{results.length}</div>
              <div className="summary-label">Successful</div>
            </div>
            <div className="summary-card error">
              <div className="summary-number">{errors.length}</div>
              <div className="summary-label">Errors</div>
            </div>
            <div className="summary-card total">
              <div className="summary-number">{total}</div>
              <div className="summary-label">Total</div>
            </div>
          </div>

          {/* Download Button */}
          {results.length > 0 && (
            <button onClick={onDownload} className="download-zip-btn">
              📥 Download All XML Files as ZIP ({results.length} files)
            </button>
          )}

          {/* Error List */}
          {errors.length > 0 && (
            <div className="errors-section">
              <h4>Errors ({errors.length}):</h4>
              <div className="errors-list">
                {errors.map((error, index) => (
                  <div key={index} className="error-item">
                    <span className="error-icon">❌</span>
                    <span className="error-filename">{error.file.name}</span>
                    <span className="error-message">{error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success List */}
          {results.length > 0 && (
            <div className="success-section">
              <h4>Processed Successfully ({results.length}):</h4>
              <div className="success-list">
                {results.map((result, index) => (
                  <div key={index} className="success-item">
                    <span className="success-icon">✅</span>
                    <span className="success-filename">{result.videoInfo.filename}</span>
                    <span className="success-details">
                      {result.videoInfo.resolution.width}x{result.videoInfo.resolution.height} • 
                      {result.videoInfo.frameRate}FPS • 
                      {result.videoInfo.durationFormatted}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchProcessing;