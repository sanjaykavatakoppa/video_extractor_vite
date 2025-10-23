import React from 'react';
import './VideoTableView.css';

const VideoTableView = ({ videos, onVideoSelect, selectedVideo }) => {
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

  const getQualityBadge = (width) => {
    if (width >= 3840) return { label: '4K', class: 'quality-4k' };
    if (width >= 1920) return { label: 'Full HD', class: 'quality-full-hd' };
    if (width >= 1280) return { label: 'HD', class: 'quality-hd' };
    return { label: 'SD', class: 'quality-sd' };
  };

  if (!videos || videos.length === 0) {
    return (
      <div className="video-table-empty">
        <div className="empty-icon">📁</div>
        <h3>No Videos Processed</h3>
        <p>Upload videos to see them listed here</p>
      </div>
    );
  }

  return (
    <div className="video-table-container">
      <div className="table-header">
        <h3>Video Library ({videos.length} files)</h3>
        <div className="table-actions">
          <span className="table-info">
            Click on any video to view detailed information
          </span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="video-table">
          <thead>
            <tr>
              <th className="col-file">File Name</th>
              <th className="col-duration">Duration</th>
              <th className="col-resolution">Resolution</th>
              <th className="col-fps">FPS</th>
              <th className="col-size">Size</th>
              <th className="col-language">Language</th>
              <th className="col-country">Country</th>
              <th className="col-category">Category</th>
              <th className="col-quality">Quality</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video, index) => {
              const quality = getQualityBadge(video.resolution.width);
              const isSelected = selectedVideo && selectedVideo.name === video.name;
              
              return (
                <tr 
                  key={`${video.name}-${index}`}
                  className={`table-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => onVideoSelect(video)}
                >
                  <td className="col-file">
                    <div className="file-info">
                      <span className="file-icon">🎬</span>
                      <div className="file-details">
                        <div className="file-name" title={video.name}>
                          {video.name}
                        </div>
                        <div className="file-type">
                          {video.type.split('/')[1]?.toUpperCase() || 'VIDEO'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="col-duration">
                    <span className="duration-value">
                      {formatDuration(video.duration)}
                    </span>
                  </td>
                  <td className="col-resolution">
                    <span className="resolution-value">
                      {video.resolution.width} × {video.resolution.height}
                    </span>
                  </td>
                  <td className="col-fps">
                    <span className="fps-badge">
                      {video.frameRate} FPS
                    </span>
                  </td>
                  <td className="col-size">
                    <span className="file-size">
                      {formatFileSize(video.size)}
                    </span>
                  </td>
                  <td className="col-language">
                    <span className="language-tag">
                      {video.primaryLanguage}
                    </span>
                  </td>
                  <td className="col-country">
                    <span className="country-tag">
                      {video.countryOrigin}
                    </span>
                  </td>
                  <td className="col-category">
                    <span className="category-tag" title={video.cdCategory}>
                      {video.cdCategory.split(' ')[0]}
                    </span>
                  </td>
                  <td className="col-quality">
                    <span className={`quality-badge ${quality.class}`}>
                      {quality.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="table-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{videos.length}</span>
            <span className="stat-label">Total Videos</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {videos.reduce((total, video) => total + video.size, 0) > 1024 * 1024 * 1024 
                ? `${(videos.reduce((total, video) => total + video.size, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                : `${(videos.reduce((total, video) => total + video.size, 0) / (1024 * 1024)).toFixed(2)} MB`}
            </span>
            <span className="stat-label">Total Size</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {formatDuration(videos.reduce((total, video) => total + video.duration, 0))}
            </span>
            <span className="stat-label">Total Duration</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {[...new Set(videos.map(video => video.primaryLanguage))].length}
            </span>
            <span className="stat-label">Languages</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTableView;