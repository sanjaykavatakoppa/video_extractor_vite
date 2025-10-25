import JSZip from 'jszip';

export const calculateFrameRate = (video) => {
  return new Promise((resolve) => {
    if (video.duration > 0) {
      const estimatedFPS = video.webkitDecodedFrameCount / video.duration || 
                          video.mozDecodedFrames / video.duration;
      
      if (estimatedFPS && estimatedFPS > 1 && estimatedFPS < 120) {
        resolve(Math.round(estimatedFPS));
        return;
      }
    }
    resolve(estimateFrameRateFromResolution(video));
  });
};

export const estimateFrameRateFromResolution = (video) => {
  const width = video.videoWidth;
  if (width >= 3840) return 24;
  else if (width >= 2560) return 30;
  else if (width >= 1920) return 30;
  else if (width >= 1280) return 30;
  else return 25;
};

export const detectLanguageFromFilename = (filename) => {
  const name = filename.toLowerCase();
  const languagePatterns = {
    'english': ['eng', 'en', 'english', 'us', 'uk', 'american', 'british'],
    'spanish': ['spa', 'es', 'spanish', 'español', 'mexican'],
    'french': ['fre', 'fr', 'french', 'français'],
    'german': ['ger', 'de', 'german', 'deutsch'],
    'chinese': ['chi', 'zh', 'chinese', 'mandarin'],
    'japanese': ['jpn', 'ja', 'japanese'],
    'korean': ['kor', 'ko', 'korean'],
    'hindi': ['hin', 'hi', 'hindi'],
    'arabic': ['ara', 'ar', 'arabic'],
    'russian': ['rus', 'ru', 'russian']
  };

  for (const [language, patterns] of Object.entries(languagePatterns)) {
    if (patterns.some(pattern => name.includes(pattern))) {
      return language.charAt(0).toUpperCase() + language.slice(1);
    }
  }
  return ' ';
};

export const detectCountryFromVideoProperties = (video, filename) => {
  const name = filename.toLowerCase();
  const frameRate = video.frameRate || estimateFrameRateFromResolution(video);
  
  const countryPatterns = {
    'United States': ['us', 'usa', 'american', 'na'],
    'United Kingdom': ['uk', 'british', 'england', 'gb'],
    'Australia': ['au', 'australia', 'aussie'],
    'Canada': ['ca', 'canada', 'canadian'],
    'Germany': ['de', 'germany', 'german'],
    'France': ['fr', 'france', 'french'],
    'Japan': ['jp', 'japan', 'japanese'],
    'China': ['cn', 'china', 'chinese'],
    'India': ['in', 'india', 'indian'],
    'South Korea': ['kr', 'korea', 'korean']
  };

  for (const [country, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(pattern => name.includes(pattern))) {
      return country;
    }
  }

  if (Math.abs(frameRate - 25) < 1) {
    return 'PAL Region (Europe/Australia/Asia)';
  } else if (Math.abs(frameRate - 30) < 1 || Math.abs(frameRate - 29.97) < 1) {
    return 'NTSC Region (North America/Japan)';
  }

  return ' ';
};

export const detectCategoryFromVideo = (video, filename) => {
  const name = filename.toLowerCase();
  const duration = video.duration;
  const width = video.videoWidth;
  
  const categoryPatterns = {
    'Emerging Objects and Cinematic Storytelling': ['cinematic', 'story', 'narrative', 'film', 'movie'],
    'Nature and Wildlife': ['nature', 'wildlife', 'animal', 'wild', 'landscape'],
    'Sports and Action': ['sport', 'action', 'athlete', 'game', 'competition'],
    'People and Lifestyle': ['people', 'lifestyle', 'human', 'portrait', 'family'],
    'Technology and Science': ['tech', 'technology', 'science', 'innovation', 'digital'],
    'Arts and Culture': ['art', 'culture', 'creative', 'design', 'music']
  };

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(pattern => name.includes(pattern))) {
      return ' ';
    }
  }


  return ' ';
};

export const detectOnScreenText = async (video) => {
  return new Promise((resolve) => {
    const hasText = video.duration > 10;
    resolve(hasText);
  });
};

export const getVideoInfo = async (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async function() {
      try {
        const frameRate = await calculateFrameRate(video);
        const autoDetectedLanguage = detectLanguageFromFilename(file.name);
        const autoDetectedCountry = detectCountryFromVideoProperties(video, file.name);
        const autoDetectedCategory = detectCategoryFromVideo(video, file.name);
        const hasOnScreenText = await detectOnScreenText(video);

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
          primaryLanguage: autoDetectedLanguage,
          countryOrigin: autoDetectedCountry,
          cdCategory: autoDetectedCategory,
          productionTextRef: hasOnScreenText,
          title: ' ',
          description: ' ',
          autoDetected: {
            language: autoDetectedLanguage,
            country: autoDetectedCountry,
            category: autoDetectedCategory,
            hasText: hasOnScreenText
          }
        };
        
        URL.revokeObjectURL(video.src);
        resolve(info);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = function() {
      URL.revokeObjectURL(video.src);
      reject(new Error(`Error processing ${file.name}`));
    };

    video.src = URL.createObjectURL(file);
  });
};

export const generateXML = (videoInfo) => {
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
  <Primary_Language>${videoInfo.primaryLanguage}</Primary_Language>
  <CountryOrigin>${videoInfo.countryOrigin}</CountryOrigin>
  <CD_Category>${videoInfo.cdCategory || ''}</CD_Category>
  <Production_TextRef>' '</Production_TextRef>
  <Title>${videoInfo.title || ''}</Title>
  <Description>${videoInfo.description || ''}</Description>
</record>`;

  return xmlContent;
};

export const downloadXML = (xmlContent, filename) => {
  const blob = new Blob([xmlContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.[^/.]+$/, "") + '.xml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// NEW: Batch processing functions
export const processVideoBatch = async (files, onProgress) => {
  const results = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      onProgress?.(i + 1, files.length, file.name, 'processing');
      const videoInfo = await getVideoInfo(file);
      const xmlContent = generateXML(videoInfo);
      
      results.push({
        file: file,
        videoInfo: videoInfo,
        xmlContent: xmlContent,
        filename: file.name.replace(/\.[^/.]+$/, "") + '.xml'
      });
      
      onProgress?.(i + 1, files.length, file.name, 'success');
    } catch (error) {
      errors.push({
        file: file,
        error: error.message
      });
      onProgress?.(i + 1, files.length, file.name, 'error');
    }
  }

  return { results, errors };
};

export const createZipFile = async (results) => {
  const zip = new JSZip();
  
  // Add all XML files to zip
  results.forEach(result => {
    zip.file(result.filename, result.xmlContent);
  });
  
  // Create a summary file
  const summary = {
    totalVideos: results.length,
    processedAt: new Date().toISOString(),
    videos: results.map(r => ({
      filename: r.videoInfo.filename,
      duration: r.videoInfo.durationFormatted,
      resolution: `${r.videoInfo.resolution.width}x${r.videoInfo.resolution.height}`,
      frameRate: r.videoInfo.frameRate
    }))
  };
  
  zip.file('processing_summary.json', JSON.stringify(summary, null, 2));
  
  // Generate zip file
  const zipContent = await zip.generateAsync({ type: 'blob' });
  return zipContent;
};

export const downloadZip = (zipContent, zipName = 'video_metadata_batch.zip') => {
  const url = URL.createObjectURL(zipContent);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};