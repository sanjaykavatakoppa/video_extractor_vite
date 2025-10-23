import React, { useRef } from 'react';
import './VideoUploader.css';

const VideoUploader = ({ onVideoUpload, loading }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        onVideoUpload(file);
      } else {
        alert('Please select a valid video file');
      }
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onVideoUpload(file);
    } else {
      alert('Please drop a valid video file');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div className="video-uploader">
      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Processing video metadata...</p>
            <p className="processing-note">Calculating frame rate and properties</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">🎬</div>
            <h3>Upload Video File</h3>
            <p>Click or drag and drop a video file here</p>
            <p className="supported-formats">Supported: MP4, WebM, OGG, MOV, AVI</p>
            <p className="feature-info">Extract metadata and generate XML report</p>
          </>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="video/*"
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default VideoUploader;