import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Configuration
const EXCEL_FILE_PATH = './public/video.xlsx';
const OUTPUT_DIR = './public/downloaded-videos';
const API_URL = 'https://crxextapi.pd.dmh.veritone.com/assets-api/v1/clip/byIds';
const API_KEY = 'a50214c1-9737-428d-8fc2-1e4b8688b429';
const FIELDS = 'Title,Description,TWK.SupplierID,Format.FrameSize,Format.FrameRate,Production.Language. Audio,Production.CountryOfOrigin';

// Get command line arguments
const args = process.argv.slice(2);
let START_ROW = 1;
let MAX_CLIPS_TO_PROCESS = 1;

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start' || args[i] === '-s') {
    START_ROW = parseInt(args[i + 1]) || 1;
    i++;
  } else if (args[i] === '--count' || args[i] === '-c') {
    MAX_CLIPS_TO_PROCESS = parseInt(args[i + 1]) || 1;
    i++;
  }
}

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}\n`);
}

// Function to make API call and get clip data
function fetchClipData(clipId) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}?ids=${clipId}&fields=${encodeURIComponent(FIELDS)}&api_key=${API_KEY}`;
    
    console.log(`\n📡 Fetching metadata for Clip ID: ${clipId}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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

// Function to extract download URLs from API response
function extractDownloadUrls(apiResponse) {
  if (!apiResponse.list || apiResponse.list.length === 0) {
    return null;
  }
  
  const clip = apiResponse.list[0];
  const renditions = clip.renditions || [];
  
  // Find different types of renditions
  const masterRendition = renditions.find(r => r.purpose === 'm'); // Master file
  const compRendition = renditions.find(r => r.purpose === 'c'); // Compressed/comp file
  const previewRendition = renditions.find(r => r.purpose === 'p'); // Preview
  const thumbnailRendition = renditions.find(r => r.purpose === 't'); // Thumbnail
  
  return {
    clipName: clip.name,
    master: masterRendition,
    comp: compRendition,
    preview: previewRendition,
    thumbnail: thumbnailRendition,
    allRenditions: renditions
  };
}

// Function to get the signed download URL using the renditionUrl/select API
async function getDownloadableUrl(clipId) {
  console.log(`   🔐 Fetching signed download URL...`);
  
  // Use the correct API endpoint: /renditionUrl/select/{clipid}
  const url = `https://crxextapi.pd.dmh.veritone.com/assets-api/v1/renditionUrl/select/${clipId}?scheme=https&context=browser&sizes=f&purposes=c&api_key=${API_KEY}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API returned status ${res.statusCode}: ${data}`));
          return;
        }
        
        try {
          const result = JSON.parse(data);
          
          // Extract the 'url' field (not 'internalUri')
          const downloadUrl = result.url;
          
          if (!downloadUrl || !downloadUrl.startsWith('http')) {
            reject(new Error(`No valid URL found in response. Got: ${JSON.stringify(result).substring(0, 200)}`));
            return;
          }
          
          console.log(`   ✅ Successfully retrieved signed URL!`);
          resolve(downloadUrl);
          
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}. Data: ${data.substring(0, 200)}`));
        }
      });
      
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Function to download file from URL
function downloadFile(url, outputPath, fileName) {
  return new Promise((resolve, reject) => {
    console.log(`   📥 Downloading: ${fileName}`);
    console.log(`   URL: ${url.substring(0, 80)}...`);
    
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`   ↪️  Redirecting to: ${redirectUrl.substring(0, 80)}...`);
        return downloadFile(redirectUrl, outputPath, fileName)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        fs.unlinkSync(outputPath);
        reject(new Error(`Failed to download. Status: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || 0);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r   Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`\n   ✅ Downloaded successfully: ${fileName}`);
        resolve(outputPath);
      });
      
    }).on('error', (error) => {
      fs.unlinkSync(outputPath);
      reject(error);
    });
  });
}

// Main function
async function processClips() {
  try {
    console.log('📖 Reading Excel file...\n');
    
    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${data.length} rows in Excel file`);
    console.log(`Starting from row ${START_ROW}, downloading ${MAX_CLIPS_TO_PROCESS} video(s)...\n`);
    
    const startIndex = START_ROW - 1; // Convert to 0-based index
    const endIndex = Math.min(startIndex + MAX_CLIPS_TO_PROCESS, data.length);
    const clipsToProcess = data.slice(startIndex, endIndex);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < clipsToProcess.length; i++) {
      const row = clipsToProcess[i];
      const clipId = row['Clip ID'] || row['ClipID'] || row['clipId'] || row['clip_id'];
      const fileName = row['File Name'] || row['FileName'] || row['fileName'] || row['file_name'];
      
      const currentRow = startIndex + i + 1;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Processing ${i + 1}/${clipsToProcess.length} (Row ${currentRow}): Clip ID ${clipId}`);
      console.log(`${'='.repeat(80)}`);
      
      if (!clipId) {
        console.log('❌ No Clip ID found, skipping...');
        errorCount++;
        continue;
      }
      
      try {
        // Step 1: Fetch clip metadata
        const apiData = await fetchClipData(clipId);
        
        // Step 2: Extract URLs
        const urls = extractDownloadUrls(apiData);
        
        if (!urls) {
          console.log('❌ No renditions found for this clip');
          errorCount++;
          continue;
        }
        
        console.log(`\n📦 Found ${urls.allRenditions.length} renditions for clip: ${urls.clipName}`);
        
        // Display available renditions
        console.log('\nAvailable renditions:');
        urls.allRenditions.forEach((r, idx) => {
          const size = (r.filesize / 1024 / 1024).toFixed(2);
          console.log(`   ${idx + 1}. ${r.name} (${r.format}, ${size} MB) - Purpose: ${r.purpose}`);
        });
        
        // Try to download the comp file first (has proper naming like 1PWF92_xxx_fc.mov)
        let renditionToDownload = urls.comp || urls.master;
        
        if (!renditionToDownload) {
          console.log('\n⚠️  No master or comp rendition found, skipping download');
          errorCount++;
          continue;
        }
        
        console.log(`\n🎯 Selected rendition: ${renditionToDownload.name}`);
        console.log(`   Rendition ID: ${renditionToDownload.id}`);
        console.log(`   Format: ${renditionToDownload.format}`);
        console.log(`   Size: ${(renditionToDownload.filesize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   URI: ${renditionToDownload.uri}`);
        
        // Step 3: Get the signed download URL using renditionUrl/select API
        try {
          const downloadUrl = await getDownloadableUrl(clipId);
          
          // Step 4: Download the file - use original filename from rendition
          const outputFileName = renditionToDownload.name;  // Keep original filename
          const outputPath = path.join(OUTPUT_DIR, outputFileName);
          
          await downloadFile(downloadUrl, outputPath, outputFileName);
          
          successCount++;
          
        } catch (urlError) {
          console.log(`\n❌ Could not get download URL: ${urlError.message}`);
          errorCount++;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`\n❌ Error processing Clip ID ${clipId}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 PROCESSING SUMMARY');
    console.log(`${'='.repeat(80)}`);
    console.log(`Total clips processed: ${clipsToProcess.length}`);
    console.log(`Successful downloads: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`\nFiles saved in: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
processClips();

