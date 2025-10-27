import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Configuration
const EXCEL_FILE_PATH = './public/video.xlsx';
const OUTPUT_DIR = './public/api-responses';
const API_URL = 'https://crxextapi.pd.dmh.veritone.com/assets-api/v1/clip/byIds';
const API_KEY = 'a50214c1-9737-428d-8fc2-1e4b8688b429';
const FIELDS = 'Title,Description,TWK.SupplierID,Format.FrameSize,Format.FrameRate,Production.Language. Audio,Production.CountryOfOrigin';

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

// Function to make API call
function fetchClipData(clipId) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}?ids=${clipId}&fields=${encodeURIComponent(FIELDS)}&api_key=${API_KEY}`;
    
    console.log(`Fetching data for Clip ID: ${clipId}`);
    
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

// Function to sanitize filename
function sanitizeFilename(filename) {
  // Remove or replace invalid characters
  return filename.replace(/[<>:"/\\|?*]/g, '_').trim();
}

// Main function
async function processExcelFile() {
  try {
    console.log('Reading Excel file...');
    
    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${data.length} rows in Excel file`);
    
    if (data.length === 0) {
      console.log('No data found in Excel file');
      return;
    }
    
    // Display column names for verification
    console.log('Column names found:', Object.keys(data[0]));
    
    // Process each row
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const clipId = row['Clip ID'] || row['ClipID'] || row['clipId'] || row['clip_id'];
      const fileName = row['File Name'] || row['FileName'] || row['fileName'] || row['file_name'];
      
      if (!clipId) {
        console.log(`Row ${i + 1}: Skipping - No Clip ID found`);
        errorCount++;
        errors.push({ row: i + 1, error: 'No Clip ID found' });
        continue;
      }
      
      if (!fileName) {
        console.log(`Row ${i + 1}: Skipping - No File Name found`);
        errorCount++;
        errors.push({ row: i + 1, clipId, error: 'No File Name found' });
        continue;
      }
      
      try {
        // Fetch data from API
        const apiData = await fetchClipData(clipId);
        
        // Create filename (remove extension if present, add .json)
        const baseFileName = fileName.replace(/\.[^/.]+$/, '');
        const sanitizedFileName = sanitizeFilename(baseFileName);
        const jsonFileName = `${sanitizedFileName}.json`;
        const outputPath = path.join(OUTPUT_DIR, jsonFileName);
        
        // Save JSON data
        fs.writeFileSync(outputPath, JSON.stringify(apiData, null, 2));
        
        console.log(`✓ Row ${i + 1}: Saved ${jsonFileName}`);
        successCount++;
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`✗ Row ${i + 1}: Error processing Clip ID ${clipId}: ${error.message}`);
        errorCount++;
        errors.push({ row: i + 1, clipId, fileName, error: error.message });
      }
    }
    
    // Summary
    console.log('\n=== Processing Complete ===');
    console.log(`Total rows: ${data.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  Row ${err.row}: ${err.error}${err.clipId ? ` (Clip ID: ${err.clipId})` : ''}`);
      });
      
      // Save error log
      const errorLogPath = path.join(OUTPUT_DIR, 'error-log.json');
      fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
      console.log(`\nError log saved to: ${errorLogPath}`);
    }
    
    console.log(`\nJSON files saved in: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
processExcelFile();

