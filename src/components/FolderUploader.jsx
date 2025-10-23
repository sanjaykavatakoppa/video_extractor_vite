import React, { useRef } from 'react';
import './FolderUploader.css';

const FolderUploader = ({ onFolderSelect, loading }) => {
  const fileInputRef = useRef(null);

  const handleFolderSelect = (event) => {
    const files = Array.from(event.target.files);
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (videoFiles.length > 0) {
      onFolderSelect(videoFiles);
    } else {
      alert('No video files found in the selected folder.');
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const items = event.dataTransfer.items;
    const files = [];
    
    // Handle folder drop
    const processEntries = (entries) => {
      const promises = Array.from(entries).map(entry => {
        return new Promise((resolve) => {
          if (entry.isFile) {
            entry.file(file => {
              if (file.type.startsWith('video/')) {
                files.push(file);
              }
              resolve();
            });
          } else if (entry.isDirectory) {
            const reader = entry.createReader();
            reader.readEntries(entries => {
              processEntries(entries).then(resolve);
            });
          }
        });
      });
      
      return Promise.all(promises);
    };

    processEntries(items).then(() => {
      if (files.length > 0) {
        onFolderSelect(files);
      } else {
        alert('No video files found in the dropped folder.');
      }
    });
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div className="folder-uploader">
      <div
        className="folder-upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Processing folder contents...</p>
          </div>
        ) : (
          <>
            <div className="folder-icon">📁</div>
            <h3>Select Video Folder</h3>
            <p>Click to select a folder or drag and drop a folder here</p>
            <p className="supported-formats">Supported: MP4, WebM, OGG, MOV, AVI</p>
            <p className="feature-info">Process all videos in the folder and download XML files as ZIP</p>
          </>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFolderSelect}
        accept="video/*"
        style={{ display: 'none' }}
        webkitdirectory="true"
        directory="true"
        multiple
      />
    </div>
  );
};

export default FolderUploader;