import React from 'react';
import './VideoInfo.css';

const VideoInfo = ({ videoInfo, userInputs, onInputChange }) => {
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAspectRatio = (width, height) => {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width/divisor}:${height/divisor}`;
  };

  const categories = [
    'Emerging Objects and Cinematic Storytelling',
    'Nature and Wildlife',
    'Sports and Action',
    'People and Lifestyle',
    'Technology and Science',
    'Arts and Culture',
    'Other'
  ];

  const languages = [
    'English', 'Spanish', 'French', 'German', 'Chinese', 
    'Japanese', 'Korean', 'Hindi', 'Arabic', 'Russian', 'Other'
  ];

  const countries = [
    'Australia', 'United States', 'United Kingdom', 'Canada',
    'Germany', 'France', 'Japan', 'China', 'India', 'Other'
  ];

  return (
    <div className="video-info">
      <h2>Video Information</h2>
      
      <div className="info-grid">
        <div className="info-card">
          <h3>Basic Information</h3>
          <div className="info-item">
            <strong>File Name:</strong>
            <span>{videoInfo.name}</span>
          </div>
          <div className="info-item">
            <strong>File Type:</strong>
            <span>{videoInfo.type}</span>
          </div>
          <div className="info-item">
            <strong>File Size:</strong>
            <span>{formatFileSize(videoInfo.size)}</span>
          </div>
          <div className="info-item">
            <strong>Duration:</strong>
            <span>{formatDuration(videoInfo.duration)}</span>
          </div>
        </div>

        <div className="info-card">
          <h3>Video Properties</h3>
          <div className="info-item">
            <strong>Resolution:</strong>
            <span>{videoInfo.resolution.width} × {videoInfo.resolution.height}</span>
          </div>
          <div className="info-item">
            <strong>Aspect Ratio:</strong>
            <span>{getAspectRatio(videoInfo.resolution.width, videoInfo.resolution.height)}</span>
          </div>
          <div className="info-item highlight">
            <strong>Frame Rate:</strong>
            <span className="fps-value">{videoInfo.frameRate} FPS</span>
          </div>
        </div>

        <div className="info-card">
          <h3>Metadata Inputs</h3>
          <div className="input-group">
            <label>Primary Language:</label>
            <select 
              value={userInputs.primaryLanguage} 
              onChange={(e) => onInputChange('primaryLanguage', e.target.value)}
            >
              <option value="">Select Language</option>
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Country Origin:</label>
            <select 
              value={userInputs.countryOrigin} 
              onChange={(e) => onInputChange('countryOrigin', e.target.value)}
            >
              <option value="">Select Country</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>CD Category:</label>
            <select 
              value={userInputs.cdCategory} 
              onChange={(e) => onInputChange('cdCategory', e.target.value)}
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="input-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                checked={userInputs.productionTextRef} 
                onChange={(e) => onInputChange('productionTextRef', e.target.checked)}
              />
              Production Text Reference (on-screen text)
            </label>
          </div>
        </div>

        <div className="info-card">
          <h3>Content Information</h3>
          <div className="input-group">
            <label>Title:</label>
            <input 
              type="text" 
              value={userInputs.title} 
              onChange={(e) => onInputChange('title', e.target.value)}
              placeholder="Enter video title"
            />
          </div>
          <div className="input-group">
            <label>Description:</label>
            <textarea 
              value={userInputs.description} 
              onChange={(e) => onInputChange('description', e.target.value)}
              placeholder="Enter video description"
              rows="3"
            />
          </div>
        </div>
      </div>

      <div className="quality-badges">
        <div className="resolution-badge">
          {videoInfo.resolution.width > 1920 ? '4K' : 
           videoInfo.resolution.width > 1280 ? 'Full HD' : 
           videoInfo.resolution.width > 720 ? 'HD' : 'SD'}
        </div>
        <div className="fps-badge">
          {videoInfo.frameRate} FPS
        </div>
      </div>
    </div>
  );
};

export default VideoInfo;