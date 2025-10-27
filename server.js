import express from 'express';
import cors from 'cors';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

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
        // Fetch clip metadata
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
        
        // Get signed download URL
        const downloadUrl = await getDownloadableUrl(clipId);
        
        // Download the file with real-time progress
        const outputFileName = compRendition.name;
        const outputPath = path.join(OUTPUT_DIR, outputFileName);
        
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Video downloader API is running' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Video Downloader API Server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to receive download requests\n`);
});

