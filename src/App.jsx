import React, { useState } from 'react';
import VideoUploader from './components/VideoUploader';
import VideoInfo from './components/VideoInfo';
import XMLDownload from './components/XMLDownload';
import { getDetailedVideoInfo } from './utils/videoUtils';
import './App.css';

// Logo component
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
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userInputs, setUserInputs] = useState({
    primaryLanguage: '',
    countryOrigin: '',
    cdCategory: '',
    productionTextRef: false,
    title: '',
    description: ''
  });

  const handleVideoUpload = async (file) => {
    setLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      const info = await getDetailedVideoInfo(file, userInputs);
      setVideoInfo(info);
    } catch (err) {
      setError(err.message || 'Error processing video file');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setUserInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <Logo />
          <div className="header-text">
            <h1>Video Metadata Extractor</h1>
            <p>Upload a video to extract metadata and generate XML report</p>
          </div>
        </div>
      </header>
      
      <main className="App-main">
        <VideoUploader 
          onVideoUpload={handleVideoUpload} 
          loading={loading}
        />
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {videoInfo && (
          <>
            <VideoInfo 
              videoInfo={videoInfo} 
              userInputs={userInputs}
              onInputChange={handleInputChange}
            />
            <XMLDownload 
              videoInfo={videoInfo}
              userInputs={userInputs}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;