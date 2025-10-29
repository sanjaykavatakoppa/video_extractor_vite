import express from 'express';
import cors from 'cors';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';
import { getVideoDurationInSeconds } from 'get-video-duration';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max per file
});

app.use(cors());
app.use(express.json());

// Configuration
const EXCEL_FILE_PATH = path.join(__dirname, 'public/video.xlsx');
const OUTPUT_DIR = path.join(__dirname, 'public/downloaded-videos');
const API_URL = 'https://crxextapi.pd.dmh.veritone.com/assets-api/v1/clip/byIds';
const API_KEY = 'a50214c1-9737-428d-8fc2-1e4b8688b429';
const FIELDS = 'Title,Description,TWK.SupplierID,Format.FrameSize,Format.FrameRate,Production.Language. Audio,Production.CountryOfOrigin';

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Function to make API call and get clip data
function fetchClipData(clipId) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}?ids=${clipId}&fields=${encodeURIComponent(FIELDS)}&api_key=${API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON for Clip ID ${clipId}: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`API request failed for Clip ID ${clipId}: ${error.message}`));
    });
  });
}

// Function to get the signed download URL
async function getDownloadableUrl(clipId) {
  const url = `https://crxextapi.pd.dmh.veritone.com/assets-api/v1/renditionUrl/select/${clipId}?scheme=https&context=browser&sizes=f&purposes=c&api_key=${API_KEY}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API returned status ${res.statusCode}`));
          return;
        }
        try {
          const result = JSON.parse(data);
          const downloadUrl = result.url;
          if (!downloadUrl || !downloadUrl.startsWith('http')) {
            reject(new Error('No valid URL found in response'));
            return;
          }
          resolve(downloadUrl);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Function to download file from URL with progress callback
function downloadFile(url, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        return downloadFile(redirectUrl, outputPath, onProgress).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(new Error(`Failed to download. Status: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || 0);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize > 0) {
          const percentage = Math.round((downloadedSize / totalSize) * 100);
          onProgress(downloadedSize, totalSize, percentage);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve({ downloadedSize, totalSize });
      });
      
      file.on('error', (error) => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(error);
      });
    }).on('error', (error) => {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(error);
    });
  });
}

// Function to get Supplier ID from JSON file
function getSupplierIdFromJson(fileName) {
  try {
    const API_RESPONSES_DIR = path.join(__dirname, 'public', 'api-responses');
    const jsonFilePath = path.join(API_RESPONSES_DIR, `${fileName}.json`);
    
    if (!fs.existsSync(jsonFilePath)) {
      console.log(`   ⚠️  JSON file not found: ${fileName}.json`);
      return null;
    }
    
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
    
    // Extract TWK.SupplierID from the JSON structure
    if (jsonData.list && jsonData.list[0] && jsonData.list[0].clipData) {
      const supplierField = jsonData.list[0].clipData.find(
        item => item.name === 'TWK.SupplierID'
      );
      
      if (supplierField && supplierField.value) {
        return supplierField.value;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`   ❌ Error reading JSON file for ${fileName}:`, error.message);
    return null;
  }
}

// Function to create/get supplier folder
function getSupplierFolder(supplierId) {
  const supplierFolder = path.join(OUTPUT_DIR, supplierId);
  
  if (!fs.existsSync(supplierFolder)) {
    fs.mkdirSync(supplierFolder, { recursive: true });
    console.log(`   ✨ Created new folder: ${supplierId}/`);
  } else {
    console.log(`   📂 Using existing folder: ${supplierId}/`);
  }
  
  return supplierFolder;
}

// Function to extract base filename from video filename
function extractBaseFileName(videoFileName) {
  // Remove extension first
  const nameWithoutExt = videoFileName.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
  
  // Match pattern: captures base name before any suffix
  // Examples:
  //   1PWF92_EL39N6KKU3_fc-0000002 → 1PWF92_EL39N6KKU3
  //   1PWF92_EL39N6KKU3_fc         → 1PWF92_EL39N6KKU3
  //   1PWF92_EL39N6KKU3-0000002    → 1PWF92_EL39N6KKU3
  //   1PWF92_EL39N6KKU3_0000002    → 1PWF92_EL39N6KKU3
  
  // First, try to match with sequence number
  const matchWithNumber = nameWithoutExt.match(/^(.+?)(?:_fc)?[-_]\d+$/);
  if (matchWithNumber) {
    return matchWithNumber[1];
  }
  
  // If no sequence number, check if it ends with _fc and remove it
  const matchWithFc = nameWithoutExt.match(/^(.+?)_fc$/);
  if (matchWithFc) {
    return matchWithFc[1];
  }
  
  // Fallback: return as is
  return nameWithoutExt;
}

// Helper function: Get video duration (NO FFmpeg required!)
async function getVideoDuration(videoPath) {
  try {
    // Use get-video-duration package (pure JavaScript, no FFmpeg needed!)
    const durationInSeconds = await getVideoDurationInSeconds(videoPath);
    
    if (!durationInSeconds || isNaN(durationInSeconds)) {
      return '0:00:00';
    }
    
    // Convert to HH:MM:SS format (no milliseconds)
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    
    const formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return formatted;
  } catch (error) {
    console.warn(`   ⚠️  Could not read video duration: ${error.message}`);
    return '0:00:00';
  }
}

// Function to update Excel file with download status
function updateExcelDownloadStatus(rowIndex, status = 'Downloaded') {
  try {
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Find or create "Download Status" column
    let downloadStatusCol = -1;
    
    // Check headers (row 0) for "Download Status" column
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v && cell.v.toString().includes('Download Status')) {
        downloadStatusCol = col;
        break;
      }
    }
    
    // If column doesn't exist, create it at the end
    if (downloadStatusCol === -1) {
      downloadStatusCol = range.e.c + 1;
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: downloadStatusCol });
      worksheet[headerCell] = { v: 'Download Status', t: 's' };
      range.e.c = downloadStatusCol;
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }
    
    // Update the status cell for this row
    const statusCell = XLSX.utils.encode_cell({ r: rowIndex, c: downloadStatusCol });
    worksheet[statusCell] = { v: status, t: 's' };
    
    // Write back to file
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    
    return true;
  } catch (error) {
    console.error('Error updating Excel:', error);
    return false;
  }
}

// API endpoint for downloading videos
app.post('/api/download-videos', async (req, res) => {
  const { startRow = 1, numberOfVideos = 1 } = req.body;
  
  // Set headers for streaming response
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Calculate slice indices (Excel rows are 1-indexed, array is 0-indexed)
    const startIndex = startRow - 1;
    const endIndex = Math.min(startIndex + numberOfVideos, data.length);
    const clipsToProcess = data.slice(startIndex, endIndex);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < clipsToProcess.length; i++) {
      const row = clipsToProcess[i];
      const clipId = row['Clip ID'] || row['ClipID'] || row['clipId'] || row['clip_id'];
      
      if (!clipId) {
        errorCount++;
        
        // Update Excel with error status
        const excelRowIndex = startIndex + i + 1;
        updateExcelDownloadStatus(excelRowIndex, 'Error: No Clip ID');
        
        res.write(JSON.stringify({
          type: 'error',
          file: `Row ${startIndex + i + 1}`,
          message: 'No Clip ID found'
        }) + '\n');
        continue;
      }
      
      try {
        // Get File Name from Excel row to look up JSON
        const excelFileName = row['File Name'] || row['FileName'] || row['file_name'];
        
        if (!excelFileName) {
          console.log(`   ⚠️  No File Name in Excel row, will use default folder`);
        } else {
          console.log(`   📋 Excel File Name: ${excelFileName}`);
        }
        
        // Get Supplier ID from JSON file using Excel File Name
        const supplierId = excelFileName ? getSupplierIdFromJson(excelFileName) : null;
        
        if (!supplierId) {
          console.log(`   ⚠️  No Supplier ID found, using default folder`);
        } else {
          console.log(`   📁 Found Supplier ID: ${supplierId}`);
        }
        
        // Get or create supplier folder BEFORE fetching video
        const targetFolder = supplierId ? getSupplierFolder(supplierId) : OUTPUT_DIR;
        
        // Now fetch clip metadata
        const apiData = await fetchClipData(clipId);
        
        if (!apiData.list || apiData.list.length === 0) {
          throw new Error('No clip data returned');
        }
        
        const clip = apiData.list[0];
        const renditions = clip.renditions || [];
        const compRendition = renditions.find(r => r.purpose === 'c');
        
        if (!compRendition) {
          throw new Error('No comp rendition found');
        }
        
        const outputFileName = compRendition.name;
        
        // Get signed download URL
        const downloadUrl = await getDownloadableUrl(clipId);
        
        // Download the file with real-time progress
        const outputPath = path.join(targetFolder, outputFileName);
        
        let lastProgressUpdate = 0;
        const progressCallback = (downloaded, total, percentage) => {
          // Send progress updates every 5% to avoid flooding
          if (percentage - lastProgressUpdate >= 5 || percentage === 100) {
            lastProgressUpdate = percentage;
            res.write(JSON.stringify({
              type: 'progress',
              current: i + 1,
              total: clipsToProcess.length,
              file: outputFileName,
              percentage: percentage,
              downloadedMB: (downloaded / 1024 / 1024).toFixed(2),
              totalMB: (total / 1024 / 1024).toFixed(2)
            }) + '\n');
          }
        };
        
        const { downloadedSize } = await downloadFile(downloadUrl, outputPath, progressCallback);
        
        successCount++;
        
        // Update Excel file with "Downloaded" status
        const excelRowIndex = startIndex + i + 1; // +1 because Excel rows are 1-indexed and includes header
        const updated = updateExcelDownloadStatus(excelRowIndex, 'Downloaded');
        
        res.write(JSON.stringify({
          type: 'success',
          file: {
            name: outputFileName,
            size: `${(downloadedSize / 1024 / 1024).toFixed(2)} MB`,
            clipId: clipId,
            supplierFolder: supplierId || 'default',
            excelUpdated: updated
          }
        }) + '\n');
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        errorCount++;
        
        // Update Excel with error status
        const excelRowIndex = startIndex + i + 1;
        updateExcelDownloadStatus(excelRowIndex, 'Error: ' + error.message.substring(0, 50));
        
        res.write(JSON.stringify({
          type: 'error',
          file: `Clip ID ${clipId}`,
          message: error.message
        }) + '\n');
      }
    }
    
    // Send final summary
    res.write(JSON.stringify({
      type: 'complete',
      successCount,
      errorCount,
      total: clipsToProcess.length
    }) + '\n');
    
    res.end();
    
  } catch (error) {
    res.write(JSON.stringify({
      type: 'error',
      file: 'System',
      message: error.message
    }) + '\n');
    res.end();
  }
});

// XML Generation endpoint
app.post('/api/generate-xml', async (req, res) => {
  try {
    const { folderName, apiResponsesFolder, excelFile } = req.body;
    
    if (!folderName) {
      return res.status(400).json({ error: 'Folder path is required' });
    }
    
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Handle both absolute and relative paths
    const VIDEOS_FOLDER = path.isAbsolute(folderName) 
      ? folderName 
      : path.join(__dirname, folderName);
    
    const API_RESPONSES_FOLDER = apiResponsesFolder && path.isAbsolute(apiResponsesFolder)
      ? apiResponsesFolder
      : path.join(__dirname, apiResponsesFolder || 'public/api-responses');
    
    const EXCEL_FILE = excelFile && path.isAbsolute(excelFile)
      ? excelFile
      : path.join(__dirname, excelFile || 'public/video.xlsx');
    
    // Check if folder exists
    if (!fs.existsSync(VIDEOS_FOLDER)) {
      res.write(JSON.stringify({
        type: 'error',
        file: 'System',
        error: `Folder not found: ${folderName}`
      }) + '\n');
      res.end();
      return;
    }
    
    // Get all video files
    const videoFiles = fs.readdirSync(VIDEOS_FOLDER).filter(file => {
      return /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(file);
    });
    
    if (videoFiles.length === 0) {
      res.write(JSON.stringify({
        type: 'error',
        file: 'System',
        error: 'No video files found in folder'
      }) + '\n');
      res.end();
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < videoFiles.length; i++) {
      const videoFile = videoFiles[i];
      
      try {
        const videoFilePath = path.join(VIDEOS_FOLDER, videoFile);
        
        // Send progress update
        res.write(JSON.stringify({
          type: 'progress',
          current: i + 1,
          total: videoFiles.length,
          file: videoFile
        }) + '\n');
        
        // Extract base filename
        const baseFilename = extractBaseFilename(videoFile);
        
        // Get video metadata from JSON (with duration from video file!)
        const videoMetadata = await getVideoMetadataFromJson(baseFilename, videoFile, API_RESPONSES_FOLDER, videoFilePath);
        
        // Get Excel data
        const excelData = getExcelDataForClip(baseFilename, EXCEL_FILE);
        
        // Generate XML
        const xmlContent = generateXMLContent(videoMetadata, excelData);
        
        // Save XML file
        const xmlFileName = videoFile.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '.xml');
        const xmlFilePath = path.join(VIDEOS_FOLDER, xmlFileName);
        fs.writeFileSync(xmlFilePath, xmlContent, 'utf-8');
        
        successCount++;
        
        res.write(JSON.stringify({
          type: 'success',
          videoFile: videoFile,
          xmlFile: xmlFileName,
          title: excelData?.title || '',
          saved: true
        }) + '\n');
        
      } catch (error) {
        errorCount++;
        res.write(JSON.stringify({
          type: 'error',
          file: videoFile,
          error: error.message
        }) + '\n');
      }
    }
    
    // Send completion
    res.write(JSON.stringify({
      type: 'complete',
      successCount,
      errorCount,
      total: videoFiles.length
    }) + '\n');
    
    res.end();
    
  } catch (error) {
    res.write(JSON.stringify({
      type: 'error',
      file: 'System',
      error: error.message
    }) + '\n');
    res.end();
  }
});

// Helper function: Extract base filename
function extractBaseFilename(videoFilename) {
  const nameWithoutExt = videoFilename.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
  const match = nameWithoutExt.match(/^(.+?)(?:_fc)?[-_]\d+$/);
  return match ? match[1] : nameWithoutExt;
}

// Helper function: Get video metadata from JSON (NO ffprobe needed!)
async function getVideoMetadataFromJson(baseFilename, videoFileName, apiResponsesFolder, videoPath = null) {
  try {
    const jsonPath = path.join(apiResponsesFolder, `${baseFilename}.json`);
    
    // Read duration from video file if path provided
    let duration = '0:00:00';
    if (videoPath && fs.existsSync(videoPath)) {
      duration = await getVideoDuration(videoPath);
    }
    
    if (!fs.existsSync(jsonPath)) {
      console.warn(`   ⚠️  JSON file not found: ${baseFilename}.json - using defaults`);
      return {
        filename: videoFileName,
        duration: duration,
        resolution: '1920 x 1080',
        fps: 30.00,
        countryOrigin: ''
      };
    }
    
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    let frameRate = '30.00';
    let frameSize = '1920 x 1080';
    let countryOrigin = '';
    
    if (jsonData.list && jsonData.list[0] && jsonData.list[0].clipData) {
      const clipData = jsonData.list[0].clipData;
      
      // Get FrameRate
      const fpsField = clipData.find(f => f.name === 'Format.FrameRate');
      if (fpsField && fpsField.value) {
        const fpsMatch = fpsField.value.match(/[\d.]+/);
        frameRate = fpsMatch ? fpsMatch[0] : '30.00';
      }
      
      // Get FrameSize (Resolution)
      const sizeField = clipData.find(f => f.name === 'Format.FrameSize');
      if (sizeField && sizeField.value) {
        frameSize = sizeField.value;
      }
      
      // Get CountryOfOrigin
      const countryField = clipData.find(f => f.name === 'Production.CountryOfOrigin');
      if (countryField && countryField.value) {
        countryOrigin = countryField.value;
      }
    }
    
    return {
      filename: videoFileName,
      duration: duration,
      resolution: frameSize,
      fps: parseFloat(frameRate),
      countryOrigin: countryOrigin
    };
  } catch (error) {
    console.error(`   ❌ Error reading JSON for ${baseFilename}:`, error.message);
    // Try to get duration even on error
    let duration = '0:00:00';
    if (videoPath && fs.existsSync(videoPath)) {
      duration = await getVideoDuration(videoPath);
    }
    return {
      filename: videoFileName,
      duration: duration,
      resolution: '1920 x 1080',
      fps: 30.00,
      countryOrigin: ''
    };
  }
}

// Helper function: Get Excel data
function getExcelDataForClip(baseFilename, excelFilePath = EXCEL_FILE_PATH) {
  try {
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const row = data.find(r => r['File Name'] === baseFilename);
    
    if (row) {
      return {
        teParentClip: row['File Name'] || '',
        title: row['TITLE'] || '',
        description: row['DESCRIPTION'] || ''
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function: Generate XML content (Updated - NO ffprobe!)
function generateXMLContent(videoMetadata, excelData) {
  const { filename, duration, resolution, fps, countryOrigin = '' } = videoMetadata;
  const { teParentClip = '', title = '', description = '' } = excelData || {};
  
  let xml = '<?xml version="1.0"?>\n';
  xml += '<record>\n';
  xml += `  <TE_ParentClip>${teParentClip}</TE_ParentClip>\n`;
  xml += `  <Filename>${filename}</Filename>\n`;
  xml += `  <Duration>${duration}</Duration>\n`;
  xml += `  <Resolution>${resolution}</Resolution>\n`;
  xml += `  <FPS>${fps}</FPS>\n`;
  xml += `  <Primary_Language></Primary_Language>\n`;
  xml += countryOrigin ? `  <CountryOrigin>${countryOrigin}</CountryOrigin>\n` : `  <CountryOrigin></CountryOrigin>\n`;
  xml += `  <CD_Category>Emerging Objects and Cinematic Storytelling</CD_Category>\n`;
  xml += `  <Production_TextRef>false</Production_TextRef>\n`;
  xml += `  <Title>${title}</Title>\n`;
  xml += `  <Description>${description}</Description>\n`;
  xml += '</record>';
  
  return xml;
}

// XML Generation with file upload (for Windows compatibility - NO ffprobe!)
app.post('/api/generate-xml-upload', upload.fields([
  { name: 'videoFiles', maxCount: 1000 },
  { name: 'apiResponseFiles', maxCount: 1000 },
  { name: 'excelFile', maxCount: 1 }
]), async (req, res) => {
  try {
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    const videoFiles = req.files['videoFiles'] || [];
    const apiResponseFiles = req.files['apiResponseFiles'] || [];
    const excelFile = req.files['excelFile'] ? req.files['excelFile'][0] : null;
    
    if (videoFiles.length === 0) {
      res.write(JSON.stringify({
        type: 'error',
        file: 'System',
        error: 'No video files uploaded'
      }) + '\n');
      res.end();
      return;
    }
    
    // Build JSON lookup map from uploaded files
    const jsonMap = {};
    apiResponseFiles.forEach(file => {
      const fileName = path.basename(file.originalname, path.extname(file.originalname));
      jsonMap[fileName] = JSON.parse(file.buffer.toString('utf-8'));
    });
    
    // Parse Excel if provided
    let excelData = [];
    if (excelFile) {
      const workbook = XLSX.read(excelFile.buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      excelData = XLSX.utils.sheet_to_json(worksheet);
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each video file
    for (let i = 0; i < videoFiles.length; i++) {
      const videoFile = videoFiles[i];
      const videoFileName = path.basename(videoFile.originalname);
      
      // Skip non-video files
      if (!/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(videoFileName)) {
        continue;
      }
      
      try {
        // Send progress
        res.write(JSON.stringify({
          type: 'progress',
          current: i + 1,
          total: videoFiles.length,
          file: videoFileName
        }) + '\n');
        
        // Extract base filename
        const baseFilename = extractBaseFilename(videoFileName);
        
        // Get metadata from uploaded JSON
        const jsonData = jsonMap[baseFilename];
        let fps = 30.00;
        let resolution = '1920 x 1080';
        let countryOrigin = '';
        
        if (jsonData && jsonData.list && jsonData.list[0] && jsonData.list[0].clipData) {
          const clipData = jsonData.list[0].clipData;
          
          const fpsField = clipData.find(f => f.name === 'Format.FrameRate');
          if (fpsField && fpsField.value) {
            const fpsMatch = fpsField.value.match(/[\d.]+/);
            fps = fpsMatch ? parseFloat(fpsMatch[0]) : 30.00;
          }
          
          const sizeField = clipData.find(f => f.name === 'Format.FrameSize');
          if (sizeField && sizeField.value) {
            resolution = sizeField.value;
          }
          
          const countryField = clipData.find(f => f.name === 'Production.CountryOfOrigin');
          if (countryField && countryField.value) {
            countryOrigin = countryField.value;
          }
        }
        
        // Get Excel data
        const excelRow = excelData.find(r => r['File Name'] === baseFilename);
        const teParentClip = excelRow ? (excelRow['File Name'] || '') : '';
        const title = excelRow ? (excelRow['TITLE'] || '') : '';
        const description = excelRow ? (excelRow['DESCRIPTION'] || '') : '';
        
        // Generate XML
        let xml = '<?xml version="1.0"?>\n';
        xml += '<record>\n';
        xml += `  <TE_ParentClip>${teParentClip}</TE_ParentClip>\n`;
        xml += `  <Filename>${videoFileName}</Filename>\n`;
        xml += `  <Duration>0:00:00</Duration>\n`;
        xml += `  <Resolution>${resolution}</Resolution>\n`;
        xml += `  <FPS>${fps}</FPS>\n`;
        xml += `  <Primary_Language></Primary_Language>\n`;
        xml += countryOrigin ? `  <CountryOrigin>${countryOrigin}</CountryOrigin>\n` : `  <CountryOrigin></CountryOrigin>\n`;
        xml += `  <CD_Category>Emerging Objects and Cinematic Storytelling</CD_Category>\n`;
        xml += `  <Production_TextRef>false</Production_TextRef>\n`;
        xml += `  <Title>${title}</Title>\n`;
        xml += `  <Description>${description}</Description>\n`;
        xml += '</record>';
        
        successCount++;
        
        res.write(JSON.stringify({
          type: 'success',
          videoFile: videoFileName,
          xmlFile: videoFileName.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '.xml'),
          title: title
        }) + '\n');
        
      } catch (error) {
        errorCount++;
        res.write(JSON.stringify({
          type: 'error',
          file: videoFileName,
          error: error.message
        }) + '\n');
      }
    }
    
    // Send completion
    res.write(JSON.stringify({
      type: 'complete',
      successCount,
      errorCount,
      total: videoFiles.length
    }) + '\n');
    
    res.end();
    
  } catch (error) {
    res.write(JSON.stringify({
      type: 'error',
      file: 'System',
      error: error.message
    }) + '\n');
    res.end();
  }
});

// XML Duration Checker endpoint
app.post('/api/check-xml-duration', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }
    
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Handle both absolute and relative paths
    const fullFolderPath = path.isAbsolute(folderPath)
      ? folderPath
      : path.join(__dirname, folderPath);
    
    // Check if folder exists
    if (!fs.existsSync(fullFolderPath)) {
      res.write(JSON.stringify({
        type: 'error',
        message: `Folder not found: ${folderPath}`
      }) + '\n');
      res.end();
      return;
    }
    
    // Get all XML files
    const xmlFiles = fs.readdirSync(fullFolderPath).filter(file => {
      return /\.xml$/i.test(file);
    });
    
    if (xmlFiles.length === 0) {
      res.write(JSON.stringify({
        type: 'error',
        message: 'No XML files found in folder'
      }) + '\n');
      res.end();
      return;
    }
    
    let issueCount = 0;
    let validCount = 0;
    
    for (let i = 0; i < xmlFiles.length; i++) {
      const xmlFile = xmlFiles[i];
      
      try {
        // Send progress update
        res.write(JSON.stringify({
          type: 'progress',
          current: i + 1,
          total: xmlFiles.length,
          file: xmlFile
        }) + '\n');
        
        // Read and parse XML file
        const xmlPath = path.join(fullFolderPath, xmlFile);
        const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
        
        // Extract duration using regex
        const durationMatch = xmlContent.match(/<Duration>(.*?)<\/Duration>/i);
        
        if (!durationMatch) {
          continue; // Skip files without duration tag
        }
        
        const durationStr = durationMatch[1].trim();
        
        // Convert duration to seconds
        // Format can be: H:MM:SS or HH:MM:SS
        const parts = durationStr.split(':');
        let totalSeconds = 0;
        
        if (parts.length === 3) {
          const hours = parseInt(parts[0]) || 0;
          const minutes = parseInt(parts[1]) || 0;
          const seconds = parseInt(parts[2]) || 0;
          totalSeconds = hours * 3600 + minutes * 60 + seconds;
        }
        
        // Check if duration is < 9 or > 20 seconds
        if (totalSeconds < 9 || totalSeconds > 20) {
          issueCount++;
          
          const reason = totalSeconds < 9 ? 'TOO SHORT' : 'TOO LONG';
          
          res.write(JSON.stringify({
            type: 'issue',
            filename: xmlFile,
            duration: durationStr,
            seconds: totalSeconds,
            reason: reason
          }) + '\n');
        } else {
          validCount++;
        }
        
      } catch (error) {
        console.error(`Error processing ${xmlFile}:`, error.message);
        // Continue to next file
      }
    }
    
    // Send completion summary
    res.write(JSON.stringify({
      type: 'complete',
      totalFiles: xmlFiles.length,
      issueFiles: issueCount,
      validFiles: validCount
    }) + '\n');
    
    res.end();
  } catch (error) {
    console.error('XML Check error:', error);
    res.write(JSON.stringify({
      type: 'error',
      message: error.message
    }) + '\n');
    res.end();
  }
});

// File Rename endpoint
app.post('/api/rename-files', async (req, res) => {
  try {
    const { folderPath, excelFile } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }
    
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Handle both absolute and relative paths
    const fullFolderPath = path.isAbsolute(folderPath)
      ? folderPath
      : path.join(__dirname, folderPath);
    
    // Check if folder exists
    if (!fs.existsSync(fullFolderPath)) {
      res.write(JSON.stringify({
        type: 'error',
        file: 'System',
        error: `Folder not found: ${folderPath}`
      }) + '\n');
      res.end();
      return;
    }
    
    // Get all video files
    const videoFiles = fs.readdirSync(fullFolderPath).filter(file => {
      return /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(file);
    });
    
    if (videoFiles.length === 0) {
      res.write(JSON.stringify({
        type: 'error',
        file: 'System',
        error: 'No video files found in folder'
      }) + '\n');
      res.end();
      return;
    }
    
    let renamedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < videoFiles.length; i++) {
      const oldFileName = videoFiles[i];
      
      try {
        // Send progress update
        res.write(JSON.stringify({
          type: 'progress',
          current: i + 1,
          total: videoFiles.length,
          file: oldFileName
        }) + '\n');
        
        // Determine new filename based on patterns
        let newFileName = oldFileName;
        
        // Extract extension
        const ext = path.extname(oldFileName);
        const nameWithoutExt = oldFileName.replace(ext, '');
        
        // Case 1: Pattern like "1PWF92_EK4Q2TFQNB_0000001" -> "1PWF92_EK4Q2TFQNB_fc-0000001"
        // (no "_fc" present, has underscore before sequence number)
        // Supports 6 or 7 digit sequence numbers, always outputs 7 digits
        const case1Pattern = /^(.+?)_(\d{6,7})$/;
        const case1Match = nameWithoutExt.match(case1Pattern);
        
        if (case1Match && !nameWithoutExt.includes('_fc')) {
          const baseName = case1Match[1];
          const sequenceNum = case1Match[2].padStart(7, '0'); // Pad to 7 digits
          newFileName = `${baseName}_fc-${sequenceNum}${ext}`;
        }
        
        // Case 2: Pattern like "1PWF92_EKMUVX5H0D_fc_0000006" -> "1PWF92_EKMUVX5H0D_fc-0000006"
        // (has "_fc_" that needs to be replaced with "_fc-")
        // Supports 6 or 7 digit sequence numbers, always outputs 7 digits
        const case2Pattern = /^(.+?)_fc_(\d{6,7})$/;
        const case2Match = nameWithoutExt.match(case2Pattern);
        
        if (case2Match) {
          const baseName = case2Match[1];
          const sequenceNum = case2Match[2].padStart(7, '0'); // Pad to 7 digits
          newFileName = `${baseName}_fc-${sequenceNum}${ext}`;
        }
        
        // Case 3: Fix existing files that already have "_fc-" but wrong digit count
        // Pattern like "1PWF92_EL697ZEN58_fc-000006" -> "1PWF92_EL697ZEN58_fc-0000006"
        const case3Pattern = /^(.+?)_fc-(\d{6,7})$/;
        const case3Match = nameWithoutExt.match(case3Pattern);
        
        if (case3Match) {
          const baseName = case3Match[1];
          const sequenceNum = case3Match[2].padStart(7, '0'); // Pad to 7 digits
          const standardizedName = `${baseName}_fc-${sequenceNum}${ext}`;
          
          // Only rename if the digit count changed
          if (standardizedName !== oldFileName) {
            newFileName = standardizedName;
          }
        }
        
        // Check if rename is needed
        if (newFileName === oldFileName) {
          skippedCount++;
          res.write(JSON.stringify({
            type: 'skipped',
            file: oldFileName,
            reason: 'Already in correct format or no pattern match'
          }) + '\n');
          continue;
        }
        
        // Perform rename
        const oldFilePath = path.join(fullFolderPath, oldFileName);
        const newFilePath = path.join(fullFolderPath, newFileName);
        
        // Check if target file already exists
        if (fs.existsSync(newFilePath)) {
          errorCount++;
          res.write(JSON.stringify({
            type: 'error',
            file: oldFileName,
            error: `Target file already exists: ${newFileName}`
          }) + '\n');
          continue;
        }
        
        // Rename the file
        fs.renameSync(oldFilePath, newFilePath);
        
        renamedCount++;
        res.write(JSON.stringify({
          type: 'success',
          oldName: oldFileName,
          newName: newFileName
        }) + '\n');
        
      } catch (error) {
        errorCount++;
        res.write(JSON.stringify({
          type: 'error',
          file: oldFileName,
          error: error.message
        }) + '\n');
      }
    }
    
    // Perform validation if Excel file is provided
    if (excelFile) {
      try {
        console.log('📊 Starting Excel validation...');
        
        const fullExcelPath = path.isAbsolute(excelFile)
          ? excelFile
          : path.join(__dirname, excelFile);
        
        if (fs.existsSync(fullExcelPath)) {
          // Read Excel file
          const workbook = XLSX.readFile(fullExcelPath);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet);
          
          // Find file name column
          const possibleFileNameColumns = ['File Name', 'FileName', 'file name', 'filename', 'name', 'Name'];
          let fileNameColumn = null;
          
          for (const col of possibleFileNameColumns) {
            if (data.length > 0 && data[0].hasOwnProperty(col)) {
              fileNameColumn = col;
              break;
            }
          }
          
          if (fileNameColumn) {
            console.log(`📋 Using Excel column: "${fileNameColumn}"`);
            
            // Get base names from Excel (strip sequence numbers)
            const excelFileNames = new Set();
            data.forEach(row => {
              if (row[fileNameColumn]) {
                const fileName = row[fileNameColumn].toString().trim();
                let baseName = fileName.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
                
                // Remove sequence number patterns
                baseName = baseName.replace(/_fc-\d{6,7}$/i, '');
                baseName = baseName.replace(/_fc_\d{6,7}$/i, '');
                baseName = baseName.replace(/_\d{6,7}$/i, '');
                
                excelFileNames.add(baseName);
              }
            });
            
            console.log(`📊 Found ${excelFileNames.size} unique base names in Excel`);
            
            // Get base names from video files (strip sequence numbers)
            const videoFileBaseNames = new Set();
            const videoFilesList = [];
            
            videoFiles.forEach(file => {
              let baseName = file.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
              
              // Remove sequence number patterns
              baseName = baseName.replace(/_fc-\d{6,7}$/i, '');
              baseName = baseName.replace(/_fc_\d{6,7}$/i, '');
              baseName = baseName.replace(/_\d{6,7}$/i, '');
              
              videoFileBaseNames.add(baseName);
              videoFilesList.push({ fullName: file, baseName: baseName });
            });
            
            console.log(`🎬 Found ${videoFileBaseNames.size} unique base names in videos`);
            
            // Match video files against Excel (not the other way around)
            const missingInExcel = []; // Videos that are NOT in Excel
            let matchCount = 0;
            
            videoFilesList.forEach(video => {
              if (excelFileNames.has(video.baseName)) {
                matchCount++;
              } else {
                // Only add unique base names to missingInExcel
                if (!missingInExcel.includes(video.baseName)) {
                  missingInExcel.push(video.baseName);
                }
              }
            });
            
            console.log(`✅ Videos in Excel: ${matchCount}`);
            console.log(`❌ Videos NOT in Excel: ${missingInExcel.length}`);
            
            // Send validation results
            res.write(JSON.stringify({
              type: 'validation',
              totalInExcel: excelFileNames.size,
              totalVideos: videoFiles.length,
              uniqueVideoBaseNames: videoFileBaseNames.size,
              matches: matchCount,
              missingInExcel: missingInExcel
            }) + '\n');
          }
        }
      } catch (error) {
        console.error('⚠️ Validation error (non-fatal):', error.message);
        // Don't fail the whole operation, just skip validation
      }
    }
    
    // Send completion summary
    res.write(JSON.stringify({
      type: 'complete',
      summary: {
        total: videoFiles.length,
        renamed: renamedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    }) + '\n');
    
    res.end();
  } catch (error) {
    console.error('Rename error:', error);
    res.write(JSON.stringify({
      type: 'error',
      file: 'System',
      error: error.message
    }) + '\n');
    res.end();
  }
});

// Motion Analysis endpoint
app.post('/api/analyze-motion', async (req, res) => {
  try {
    const { videoPath, supplierFolder } = req.body;
    
    if (!videoPath) {
      return res.status(400).json({ error: 'Video path is required' });
    }
    
    // Construct full path
    const fullVideoPath = path.join(__dirname, 'public', 'downloaded-videos', supplierFolder || '', videoPath);
    
    // Check if file exists
    if (!fs.existsSync(fullVideoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }
    
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Spawn Python process
    const pythonPath = 'python3';
    const scriptPath = path.join(__dirname, 'analyze_motion.py');
    const python = spawn(pythonPath, [scriptPath, fullVideoPath]);
    
    // Handle stdout (progress updates and results)
    python.stdout.on('data', (data) => {
      const output = data.toString();
      // Each line is a JSON object
      res.write(output);
    });
    
    // Handle stderr (errors)
    python.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
      res.write(JSON.stringify({
        type: 'error',
        message: data.toString()
      }) + '\n');
    });
    
    // Handle process completion
    python.on('close', (code) => {
      if (code !== 0) {
        res.write(JSON.stringify({
          type: 'error',
          message: `Analysis process exited with code ${code}`
        }) + '\n');
      }
      res.end();
    });
    
    // Handle process errors
    python.on('error', (error) => {
      res.write(JSON.stringify({
        type: 'error',
        message: `Failed to start analysis: ${error.message}`
      }) + '\n');
      res.end();
    });
    
  } catch (error) {
    res.write(JSON.stringify({
      type: 'error',
      message: error.message
    }) + '\n');
    res.end();
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Video downloader API is running' });
});

// File Validation endpoint - Compare Excel file names with actual video files
app.post('/api/validate-files', async (req, res) => {
  try {
    const { folderPath, excelFile } = req.body;
    
    if (!folderPath || !excelFile) {
      return res.status(400).json({ error: 'Folder path and Excel file are required' });
    }
    
    console.log('🔍 Starting file validation...');
    console.log('📁 Folder:', folderPath);
    console.log('📊 Excel:', excelFile);
    
    // Resolve paths
    const fullFolderPath = path.isAbsolute(folderPath)
      ? folderPath
      : path.join(__dirname, folderPath);
    
    const fullExcelPath = path.isAbsolute(excelFile)
      ? excelFile
      : path.join(__dirname, excelFile);
    
    // Check if folder exists
    if (!fs.existsSync(fullFolderPath)) {
      return res.status(404).json({ error: `Folder not found: ${folderPath}` });
    }
    
    // Check if Excel file exists
    if (!fs.existsSync(fullExcelPath)) {
      return res.status(404).json({ error: `Excel file not found: ${excelFile}` });
    }
    
    // Read Excel file
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(fullExcelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Extract file names from Excel (assuming there's a "File Name" column)
    // Try different possible column names
    const possibleFileNameColumns = ['File Name', 'FileName', 'file name', 'filename', 'name', 'Name'];
    let fileNameColumn = null;
    
    for (const col of possibleFileNameColumns) {
      if (data.length > 0 && data[0].hasOwnProperty(col)) {
        fileNameColumn = col;
        break;
      }
    }
    
    if (!fileNameColumn) {
      return res.status(400).json({ 
        error: 'Could not find file name column in Excel. Expected columns: File Name, FileName, file name, filename, name, or Name',
        availableColumns: data.length > 0 ? Object.keys(data[0]) : []
      });
    }
    
    console.log(`📋 Using column: "${fileNameColumn}"`);
    
    // Get file names from Excel (base names without extension and sequence number)
    const excelFileNames = new Set();
    data.forEach(row => {
      if (row[fileNameColumn]) {
        // Remove extension and store base name
        const fileName = row[fileNameColumn].toString().trim();
        let baseName = fileName.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
        
        // Remove sequence number patterns (same as video files)
        baseName = baseName.replace(/_fc-\d{6,7}$/i, '');  // Remove _fc-XXXXXXX
        baseName = baseName.replace(/_fc_\d{6,7}$/i, '');  // Remove _fc_XXXXXXX
        baseName = baseName.replace(/_\d{6,7}$/i, '');     // Remove _XXXXXXX
        
        excelFileNames.add(baseName);
        console.log(`   📊 ${fileName} -> ${baseName}`);
      }
    });
    
    console.log(`📊 Found ${excelFileNames.size} file names in Excel`);
    
    // Get actual video files in folder
    const videoFiles = fs.readdirSync(fullFolderPath).filter(file => {
      return /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(file);
    });
    
    console.log(`🎬 Found ${videoFiles.length} video files in folder`);
    
    // Get base names of video files (without extension and sequence number)
    // Example: 1PWF92_EKR6EH6G4K_fc-0000066.mp4 -> 1PWF92_EKR6EH6G4K
    const videoFileBaseNames = new Set();
    videoFiles.forEach(file => {
      // Remove extension
      let baseName = file.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
      
      // Remove sequence number patterns:
      // Pattern 1: _fc-XXXXXXX (7 digits)
      // Pattern 2: _fc-XXXXXX (6 digits)
      // Pattern 3: _fc_XXXXXXX (7 digits)
      // Pattern 4: _fc_XXXXXX (6 digits)
      // Pattern 5: _XXXXXXX (7 digits, no fc)
      // Pattern 6: _XXXXXX (6 digits, no fc)
      baseName = baseName.replace(/_fc-\d{6,7}$/i, '');  // Remove _fc-XXXXXXX
      baseName = baseName.replace(/_fc_\d{6,7}$/i, '');  // Remove _fc_XXXXXXX
      baseName = baseName.replace(/_\d{6,7}$/i, '');     // Remove _XXXXXXX
      
      videoFileBaseNames.add(baseName);
      console.log(`   📹 ${file} -> ${baseName}`);
    });
    
    // Find mismatches
    const missingVideos = []; // In Excel but not in folder
    const extraVideos = [];   // In folder but not in Excel
    let matches = 0;
    
    // Check which Excel entries don't have corresponding videos
    excelFileNames.forEach(excelFile => {
      if (videoFileBaseNames.has(excelFile)) {
        matches++;
      } else {
        missingVideos.push(excelFile);
      }
    });
    
    // Check which videos don't have corresponding Excel entries
    videoFileBaseNames.forEach(videoFile => {
      if (!excelFileNames.has(videoFile)) {
        extraVideos.push(videoFile);
      }
    });
    
    console.log(`✅ Matches: ${matches}`);
    console.log(`❌ Missing videos: ${missingVideos.length}`);
    console.log(`⚠️ Extra videos: ${extraVideos.length}`);
    
    // Return results
    res.json({
      totalInExcel: excelFileNames.size,
      totalVideos: videoFileBaseNames.size,
      matches: matches,
      missingVideos: missingVideos,
      extraVideos: extraVideos,
      fileNameColumn: fileNameColumn
    });
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    res.status(500).json({ 
      error: 'Validation failed', 
      message: error.message,
      stack: error.stack
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Video Downloader API Server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to receive download requests\n`);
});

