import React, { useState } from 'react';
import FolderUploader from './components/FolderUploader';
import VideoUploader from './components/VideoUploader';
import VideoInfo from './components/VideoInfo';
import VideoTableView from './components/VideoTableView';
import BatchProcessing from './components/BatchProcessing';
import XMLDownload from './components/XMLDownload';
import VideoDownloader from './components/VideoDownloader';
import XmlGenerator from './components/XmlGenerator';
import MotionAnalyzer from './components/MotionAnalyzer';
import FileRenamer from './components/FileRenamer';
import XmlDurationChecker from './components/XmlDurationChecker';
import VideoDurationChecker from './components/VideoDurationChecker';
import ExcelUpdater from './components/ExcelUpdater';
import VideoClipper from './components/VideoClipper';
import { processVideoBatch, createZipFile, downloadZip, getVideoInfo } from './utils/videoUtils';
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
  const [processingMode, setProcessingMode] = useState('single');
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });
  const [batchResults, setBatchResults] = useState([]);
  const [batchErrors, setBatchErrors] = useState([]);
  const [singleVideoInfo, setSingleVideoInfo] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [userInputs, setUserInputs] = useState({});
  const [loading, setLoading] = useState(false);

  // Handle single file upload
  const handleSingleVideoUpload = async (file) => {
    setLoading(true);
    try {
      const info = await getVideoInfo(file);
      setSingleVideoInfo(info);
      setSelectedVideo(info);
    } catch (error) {
      console.error('Error processing single video:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle folder upload
  const handleFolderSelect = async (files) => {
    setLoading(true);
    setBatchResults([]);
    setBatchErrors([]);
    setSingleVideoInfo(null);
    setSelectedVideo(null);
    
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
      setBatchResults(results.map(r => r.videoInfo));
      setBatchErrors(errors);
      
      // Auto-select first video if available
      if (results.length > 0) {
        setSelectedVideo(results[0].videoInfo);
      }
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
      const resultsWithXml = batchResults.map(videoInfo => ({
        videoInfo,
        xmlContent: generateXML(videoInfo),
        filename: videoInfo.name.replace(/\.[^/.]+$/, "") + '.xml'
      }));
      
      const zipContent = await createZipFile(resultsWithXml);
      downloadZip(zipContent, `video_${new Date().getTime()}.zip`);
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      alert('Error creating ZIP file. Please try again.');
    }
  };

  const handleInputChange = (field, value) => {
    setUserInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  // Get current videos based on mode
  const getCurrentVideos = () => {
    if (processingMode === 'single' && singleVideoInfo) {
      return [singleVideoInfo];
    } else if (processingMode === 'batch') {
      return batchResults;
    }
    return [];
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
            📄 Single video Details
          </button>
          <button 
            className={`mode-btn ${processingMode === 'batch' ? 'active' : ''}`}
            onClick={() => setProcessingMode('batch')}
          >
            📁 Select Videos Containing Folder
          </button>
          <button 
            className={`mode-btn ${processingMode === 'download' ? 'active' : ''}`}
            onClick={() => setProcessingMode('download')}
          >
            ⬇️ Download from Excel
          </button>
          <button 
            className={`mode-btn ${processingMode === 'xmlgenerate' ? 'active' : ''}`}
            onClick={() => setProcessingMode('xmlgenerate')}
          >
            📄 Generate XML
          </button>
          <button 
            className={`mode-btn ${processingMode === 'motion' ? 'active' : ''}`}
            onClick={() => setProcessingMode('motion')}
          >
            🎬 Analyze Motion
          </button>
          <button 
            className={`mode-btn ${processingMode === 'rename' ? 'active' : ''}`}
            onClick={() => setProcessingMode('rename')}
          >
            ✏️ Rename Files
          </button>
          <button 
            className={`mode-btn ${processingMode === 'xmlcheck' ? 'active' : ''}`}
            onClick={() => setProcessingMode('xmlcheck')}
          >
            📊 Check XML Duration
          </button>
          <button 
            className={`mode-btn ${processingMode === 'videocheck' ? 'active' : ''}`}
            onClick={() => setProcessingMode('videocheck')}
          >
            🎬 Check Video Duration
          </button>
          <button 
            className={`mode-btn ${processingMode === 'excelupdate' ? 'active' : ''}`}
            onClick={() => setProcessingMode('excelupdate')}
          >
            📊 Update Excel Status
          </button>
          <button 
            className={`mode-btn ${processingMode === 'clipper' ? 'active' : ''}`}
            onClick={() => setProcessingMode('clipper')}
          >
            ✂️ Video Clipper
          </button>
        </div>

        {processingMode === 'clipper' ? (
          <VideoClipper />
        ) : processingMode === 'xmlcheck' ? (
          <XmlDurationChecker />
        ) : processingMode === 'videocheck' ? (
          <VideoDurationChecker />
        ) : processingMode === 'excelupdate' ? (
          <ExcelUpdater />
        ) : processingMode === 'rename' ? (
          <FileRenamer />
        ) : processingMode === 'motion' ? (
          <MotionAnalyzer />
        ) : processingMode === 'xmlgenerate' ? (
          <XmlGenerator />
        ) : processingMode === 'download' ? (
          <VideoDownloader />
        ) : processingMode === 'single' ? (
          <>
            <VideoUploader 
              onVideoUpload={handleSingleVideoUpload}
              loading={loading}
            />
            
            {singleVideoInfo && (
              <div className="content-layout">
                <div className="detail-section">
                <VideoTableView 
                  videos={[singleVideoInfo]}
                  onVideoSelect={handleVideoSelect}
                  selectedVideo={selectedVideo}
                />
                  <VideoInfo 
                    videoInfo={singleVideoInfo}
                    userInputs={userInputs}
                    onInputChange={handleInputChange}
                  />
                  <XMLDownload 
                    videoInfo={singleVideoInfo}
                    userInputs={userInputs}
                  />
                </div>
                
             
              </div>
            )}
          </>
        ) : (
          <>
            <FolderUploader 
              onFolderSelect={handleFolderSelect}
              loading={loading}
            />
            
            <BatchProcessing 
              progress={batchProgress}
              results={batchResults.map(videoInfo => ({ videoInfo }))}
              errors={batchErrors}
              onDownload={handleDownloadZip}
            />

            {batchResults.length > 0 && (
              <div className="content-layout">
                 <VideoTableView 
                  videos={batchResults}
                  onVideoSelect={handleVideoSelect}
                  selectedVideo={selectedVideo}
                />
                <div className="detail-section">
                  {selectedVideo && (
                    <>
                      <VideoInfo 
                        videoInfo={selectedVideo}
                        userInputs={userInputs}
                        onInputChange={handleInputChange}
                      />
                      <XMLDownload 
                        videoInfo={selectedVideo}
                        userInputs={userInputs}
                      />
                    </>
                  )}
                </div>
                
               
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Helper function to generate XML (moved from utils for simplicity)
const generateXML = (videoInfo) => {
  const parentClip = videoInfo.name
  .replace(/\.[^/.]+$/, "") // Remove file extension
  .replace(/[^a-zA-Z]/g, '') // Remove all non-letter characters
  .toUpperCase(); // Convert to uppercase
  
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<record>
  <TE_ParentClip>${parentClip}</TE_ParentClip>
  <Filename>${videoInfo.filename}</Filename>
  <Duration>${videoInfo.durationFormatted}</Duration>
  <Resolution>${videoInfo.resolution.width} x ${videoInfo.resolution.height}</Resolution>
  <FPS>${videoInfo.frameRate}</FPS>
  <Primary_Language>${videoInfo.primaryLanguage || ''}</Primary_Language>
  <CountryOrigin>${videoInfo.countryOrigin || ''}</CountryOrigin>
  <CD_Category>${videoInfo.cdCategory || ''}</CD_Category>
  <Production_TextRef> </Production_TextRef>
  <Title>${videoInfo.title || ''}</Title>
  <Description>${videoInfo.description || ''}</Description>
</record>`;

  return xmlContent;
};

export default App; 