import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './S3Uploader.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const DEFAULT_PREFIX = import.meta.env.VITE_AWS_S3_PREFIX || '';

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, exponent);
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const shouldIgnoreFile = (file) => {
  const name = file?.name || '';
  return name === '.DS_Store' || name.startsWith('._');
};

const createFileRecord = (file, index, baseRoot) => {
  const relativePath = file.webkitRelativePath || file.relativePath || file.name;
  const parts = relativePath.split(/[/\\]+/).filter(Boolean);
  const rootFolder = baseRoot || (parts.length > 1 ? parts[0] : '');
  const relativeWithoutRoot = parts.length > 1 ? parts.slice(1).join('/') : parts.join('/');

  return {
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    size: file.size,
    displayPath: relativePath,
    relativePath: relativeWithoutRoot || file.name,
    rootFolder,
    progress: 0,
    status: 'pending',
    error: null,
    url: null,
    durationMs: null,
  };
};

const S3Uploader = () => {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [rootFolder, setRootFolder] = useState('');
  const [includeRootFolder, setIncludeRootFolder] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const totalBytes = useMemo(() => files.reduce((acc, file) => acc + file.size, 0), [files]);
  const completedCount = useMemo(
    () => files.filter((file) => file.status === 'success').length,
    [files]
  );

  const handleFilesSelected = (selectedFiles) => {
    const rawFiles = Array.from(selectedFiles || []);
    if (rawFiles.length === 0) return;

    const filteredFiles = rawFiles.filter((file) => !shouldIgnoreFile(file));

    if (filteredFiles.length === 0) {
      setFiles([]);
      setRootFolder('');
      setOverallProgress(0);
      setStatusMessage('No valid files found (hidden system files were ignored).');
      setIncludeRootFolder(false);
      return;
    }
    if (filteredFiles.length !== rawFiles.length) {
      const skipped = rawFiles.length - filteredFiles.length;
      setStatusMessage(`Skipped ${skipped} hidden file${skipped > 1 ? 's' : ''}.`);
    } else {
      setStatusMessage('');
    }

    const firstPath = filteredFiles[0].webkitRelativePath || filteredFiles[0].relativePath || filteredFiles[0].name;
    const firstParts = firstPath.split(/[/\\]+/).filter(Boolean);
    const detectedRoot = firstParts.length > 1 ? firstParts[0] : '';

    const records = filteredFiles.map((file, index) => createFileRecord(file, index, detectedRoot));

    setFiles(records);
    setRootFolder(detectedRoot);
    setOverallProgress(0);
    setIncludeRootFolder(false);
  };

  const handleFolderChange = (event) => {
    handleFilesSelected(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const items = event.dataTransfer.items;
    if (!items) return;

    const entries = Array.from(items)
      .map((item) => item.webkitGetAsEntry && item.webkitGetAsEntry())
      .filter(Boolean);

    const walkDirectory = (entry) => new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file) => resolve([file]));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries(async (dirEntries) => {
          const promises = dirEntries.map((dirEntry) => walkDirectory(dirEntry));
          const nested = await Promise.all(promises);
          resolve(nested.flat());
        });
      } else {
        resolve([]);
      }
    });

    Promise.all(entries.map((entry) => walkDirectory(entry))).then((results) => {
      const filesFromDrop = results.flat();
      if (filesFromDrop.length > 0) {
        handleFilesSelected(filesFromDrop);
      }
    });
  };

  const updateFileRecord = (id, updates) => {
    setFiles((prev) => {
      const next = prev.map((file) => (file.id === id ? { ...file, ...updates } : file));
      const totalProgress = next.reduce((acc, file) => acc + file.progress, 0);
      if (next.length > 0) {
        setOverallProgress(Math.round(totalProgress / next.length));
      }
      return next;
    });
  };

  const uploadFilesSequentially = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setStatusMessage('Starting upload...');
    let failureCount = 0;

    for (let index = 0; index < files.length; index += 1) {
      const fileRecord = files[index];

      if (fileRecord.status === 'success') {
        continue;
      }

      updateFileRecord(fileRecord.id, { status: 'uploading', progress: 0, error: null });
      setStatusMessage(`Uploading ${index + 1} of ${files.length}: ${fileRecord.displayPath}`);

      const formData = new FormData();
      formData.append('file', fileRecord.file);
      formData.append('relativePath', fileRecord.relativePath);
      formData.append('rootFolder', rootFolder);
      formData.append('includeRoot', includeRootFolder ? 'true' : 'false');
      formData.append('prefix', prefix);

      try {
        const response = await axios.post(`${API_BASE_URL}/api/s3/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (event) => {
            if (!event.total) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            updateFileRecord(fileRecord.id, { progress: percent });
          },
          timeout: 0,
        });

        updateFileRecord(fileRecord.id, {
          status: 'success',
          progress: 100,
          url: response.data?.url || null,
          durationMs: response.data?.durationMs || null,
        });
      } catch (error) {
        console.error('Upload failed', error);
        const message =
          error.response?.data?.error || error.message || 'Unexpected error during upload';
        updateFileRecord(fileRecord.id, {
          status: 'error',
          error: message,
        });
        failureCount += 1;
      }
    }

    setIsUploading(false);
    if (failureCount === 0) {
      setOverallProgress(100);
      setStatusMessage('All files uploaded successfully.');
    } else {
      setStatusMessage(`Completed with ${failureCount} failed upload${failureCount > 1 ? 's' : ''}.`);
    }
  };

  const resetSelection = () => {
    setFiles([]);
    setRootFolder('');
    setOverallProgress(0);
    setStatusMessage('');
    setIncludeRootFolder(false);
  };

  return (
    <div className="s3-uploader">
      <div className="s3-uploader__header">
        <h2>Folder Upload to S3</h2>
        <p className="s3-uploader__subtitle">
          Select a folder and upload its contents to your configured S3 bucket. Progress is tracked for
          each file.
        </p>
      </div>

      <div
        className={`s3-uploader__dropzone ${isUploading ? 's3-uploader__dropzone--disabled' : ''}`}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDrop={isUploading ? undefined : handleDrop}
        onDragOver={(event) => event.preventDefault()}
        role="presentation"
      >
        <input
          ref={fileInputRef}
          type="file"
          webkitdirectory="true"
          directory="true"
          multiple
          onChange={handleFolderChange}
          style={{ display: 'none' }}
        />
        <div className="s3-uploader__dropzone-content">
          <div className="s3-uploader__icon">📁</div>
          <h3>{isUploading ? 'Uploading...' : 'Select or Drop a Folder'}</h3>
          <p>Click to browse or drag a folder here. Nested folders will be preserved.</p>
          {rootFolder && (
            <p className="s3-uploader__selected-folder">Selected root: {rootFolder}</p>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="s3-uploader__controls">
          <div className="s3-uploader__control-group">
            <label htmlFor="s3-prefix">S3 Prefix</label>
            <input
              id="s3-prefix"
              type="text"
              value={prefix}
              disabled={isUploading}
              placeholder="Optional prefix inside the bucket (e.g. clients/acme)"
              onChange={(event) => setPrefix(event.target.value)}
            />
          </div>
          <div className="s3-uploader__summary">
            <span>{files.length} files</span>
            <span>•</span>
            <span>{formatBytes(totalBytes)}</span>
            {completedCount > 0 && (
              <>
                <span>•</span>
                <span>
                  {completedCount} / {files.length} uploaded
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="s3-uploader__progress">
          <div className="s3-uploader__progress-bar">
            <div className="s3-uploader__progress-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="s3-uploader__progress-label">Overall progress: {overallProgress}%</div>
        </div>
      )}

      {statusMessage && <div className="s3-uploader__status">{statusMessage}</div>}

      {files.length > 0 && (
        <div className="s3-uploader__actions">
          <label className="s3-uploader__toggle">
            <input
              type="checkbox"
              checked={includeRootFolder}
              disabled={isUploading}
              onChange={(event) => setIncludeRootFolder(event.target.checked)}
            />
            <span>Include top-level folder in S3 path ({rootFolder || 'none detected'})</span>
          </label>
          <button type="button" onClick={uploadFilesSequentially} disabled={isUploading}>
            {isUploading ? 'Uploading…' : 'Start Upload'}
          </button>
          <button type="button" onClick={resetSelection} disabled={isUploading}>
            Clear Selection
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="s3-uploader__file-list">
          {files.map((file) => (
            <div key={file.id} className={`s3-uploader__file ${file.status}`}>
              <div className="s3-uploader__file-header">
                <div>
                  <div className="s3-uploader__file-name">{file.displayPath}</div>
                  <div className="s3-uploader__file-meta">{formatBytes(file.size)}</div>
                </div>
                <div className="s3-uploader__file-status">
                  {file.status === 'pending' && 'Pending'}
                  {file.status === 'uploading' && `${file.progress}%`}
                  {file.status === 'success' && 'Completed'}
                  {file.status === 'error' && 'Error'}
                </div>
              </div>
              <div className="s3-uploader__file-progress-bar">
                <div
                  className={`s3-uploader__file-progress-fill status-${file.status}`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
              {file.status === 'success' && file.url && (
                <div className="s3-uploader__file-link">
                  <a href={file.url} target="_blank" rel="noreferrer">
                    View uploaded file
                  </a>
                  {file.durationMs && (
                    <span className="s3-uploader__file-duration">
                      • {(file.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}
              {file.status === 'error' && file.error && (
                <div className="s3-uploader__file-error">{file.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default S3Uploader;

