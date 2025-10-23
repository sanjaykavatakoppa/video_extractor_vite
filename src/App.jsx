import React, { useState } from 'react';
import FolderUploader from './components/FolderUploader';
import VideoUploader from './components/VideoUploader';
import BatchProcessing from './components/BatchProcessing';
import { processVideoBatch, createZipFile, downloadZip } from './utils/videoUtils';
import './App.css';

const Logo = () => (
  <div className="logo">
    <img 
      src="/ClickCrawl-Trans-scaled.png" 
      alt="Video Metadata Extractor" 
      className="logo-image" 
    />
  </div>
);

function App() {
  const [processingMode, setProcessingMode] = useState('single'); // 'single' or 'batch'
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });
  const [batchResults, setBatchResults] = useState([]);
  const [batchErrors, setBatchErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFolderSelect = async (files) => {
    setLoading(true);
    setBatchResults([]);
    setBatchErrors([]);
    
    const progressCallback = (current, total, currentFile, status) => {
      setBatchProgress({
        current,
        total,
        currentFile,
        status
      });
    };

    try {
      const { results, errors } = await processVideoBatch(files, progressCallback);
      setBatchResults(results);
      setBatchErrors(errors);
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      setLoading(false);
      setBatchProgress(prev => ({ ...prev, status: 'completed' }));
    }
  };

  const handleDownloadZip = async () => {
    if (batchResults.length === 0) return;
    
    try {
      const zipContent = await createZipFile(batchResults);
      downloadZip(zipContent, `video_metadata_${new Date().getTime()}.zip`);
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      alert('Error creating ZIP file. Please try again.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <Logo />
          <div className="header-text">
            <h1>Video Metadata Extractor</h1>
            <p>Extract metadata from videos and generate XML reports</p>
          </div>
        </div>
      </header>
      
      <main className="App-main">
        {/* Mode Selector */}
        <div className="mode-selector">
          <button 
            className={`mode-btn ${processingMode === 'single' ? 'active' : ''}`}
            onClick={() => setProcessingMode('single')}
          >
            📄 Single File
          </button>
          <button 
            className={`mode-btn ${processingMode === 'batch' ? 'active' : ''}`}
            onClick={() => setProcessingMode('batch')}
          >
            📁 Batch Folder
          </button>
        </div>

        {processingMode === 'single' ? (
          <VideoUploader />
        ) : (
          <>
            <FolderUploader 
              onFolderSelect={handleFolderSelect}
              loading={loading}
            />
            
            <BatchProcessing 
              progress={batchProgress}
              results={batchResults}
              errors={batchErrors}
              onDownload={handleDownloadZip}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;