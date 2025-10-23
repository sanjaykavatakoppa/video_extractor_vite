export const calculateFrameRate = (video) => {
    return new Promise((resolve) => {
      // Method 1: Try to get FPS from video properties first
      if (video.duration > 0) {
        // Estimate FPS based on video duration and decoded frames
        const estimatedFPS = video.webkitDecodedFrameCount / video.duration || 
                            video.mozDecodedFrames / video.duration;
        
        if (estimatedFPS && estimatedFPS > 1 && estimatedFPS < 120) {
          resolve(Math.round(estimatedFPS));
          return;
        }
      }
  
      // Method 2: Use a more reliable frame counting approach
      let frameCount = 0;
      let startTime = null;
      let animationId = null;
      
      const countFrames = (now) => {
        if (!startTime) {
          startTime = now;
        }
        
        frameCount++;
        
        // Calculate for 2 seconds maximum
        if (now - startTime < 2000) {
          animationId = requestAnimationFrame(countFrames);
        } else {
          const durationInSeconds = (now - startTime) / 1000;
          const calculatedFPS = frameCount / durationInSeconds;
          
          // Validate FPS result
          if (calculatedFPS > 0.5 && calculatedFPS < 120) {
            resolve(Math.round(calculatedFPS));
          } else {
            // Method 3: Fallback to common FPS based on resolution
            resolve(estimateFrameRateFromResolution(video));
          }
          
          cancelAnimationFrame(animationId);
        }
      };
  
      animationId = requestAnimationFrame(countFrames);
  
      // Safety timeout
      setTimeout(() => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        resolve(estimateFrameRateFromResolution(video));
      }, 3000);
    });
  };
  
  export const estimateFrameRateFromResolution = (video) => {
    const width = video.videoWidth;
    
    // Common FPS values based on resolution and typical use cases
    if (width >= 3840) {
      return 24; // 4K videos often use 24fps (cinematic)
    } else if (width >= 2560) {
      return 30; // 2K commonly uses 30fps
    } else if (width >= 1920) {
      return 30; // Full HD commonly uses 30fps
    } else if (width >= 1280) {
      return 30; // HD ready typically 30fps
    } else {
      return 25; // SD and lower often 25fps (PAL) or 30fps (NTSC)
    }
  };
  
  export const getDetailedVideoInfo = async (file, userInputs = {}) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true; // Mute to allow autoplay
      video.playsInline = true;
  
      let frameRateCalculated = false;
  
      video.onloadedmetadata = async function() {
        try {
          // Play the video briefly to get frame data
          video.currentTime = 0.1; // Start slightly ahead of 0
          
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Autoplay failed, but we can still proceed
              console.log('Autoplay prevented, continuing with FPS calculation...');
            });
          }
  
          const frameRate = await calculateFrameRate(video);
          frameRateCalculated = true;
  
          const info = {
            name: file.name,
            filename: file.name,
            duration: video.duration,
            durationFormatted: formatDuration(video.duration),
            resolution: {
              width: video.videoWidth,
              height: video.videoHeight
            },
            frameRate: frameRate,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            primaryLanguage: userInputs.primaryLanguage || '',
            countryOrigin: userInputs.countryOrigin || '',
            cdCategory: userInputs.cdCategory || '',
            productionTextRef: userInputs.productionTextRef || false,
            title: userInputs.title || '',
            description: userInputs.description || ''
          };
          
          // Clean up
          video.pause();
          video.currentTime = 0;
          URL.revokeObjectURL(video.src);
          resolve(info);
        } catch (error) {
          reject(error);
        }
      };
  
      video.onerror = function() {
        if (!frameRateCalculated) {
          URL.revokeObjectURL(video.src);
          reject(new Error('Error loading video metadata'));
        }
      };
  
      // Set up error handling for play
      video.addEventListener('canplay', function() {
        // Video is ready to play
      });
  
      video.src = URL.createObjectURL(file);
    });
  };
  
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  export const generateXML = (videoInfo) => {
    const parentClip = videoInfo.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  <record>
    <TE_ParentClip>${parentClip}</TE_ParentClip>
    <Filename>${videoInfo.filename}</Filename>
    <Duration>${videoInfo.durationFormatted}</Duration>
    <Resolution>${videoInfo.resolution.width} x ${videoInfo.resolution.height}</Resolution>
    <FPS>${videoInfo.frameRate}</FPS>
    <Primary_Language>${videoInfo.primaryLanguage}</Primary_Language>
    <CountryOrigin>${videoInfo.countryOrigin}</CountryOrigin>
    <CD_Category>${videoInfo.cdCategory}</CD_Category>
    <Production_TextRef>${videoInfo.productionTextRef ? 'true' : 'false'}</Production_TextRef>
    <Title>${videoInfo.title}</Title>
    <Description>${videoInfo.description}</Description>
  </record>`;
  
    return xmlContent;
  };
  
  export const downloadXML = (xmlContent, filename) => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace(/\.[^/.]+$/, "") + '_metadata.xml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };