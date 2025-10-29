import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line arguments
function getCommandLineArgs() {
  const args = process.argv.slice(2);
  const config = {
    videoFolder: null,
    apiFolder: null,
    excelFile: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video-folder' && args[i + 1]) {
      config.videoFolder = args[i + 1];
      i++;
    } else if (args[i] === '--api-folder' && args[i + 1]) {
      config.apiFolder = args[i + 1];
      i++;
    } else if (args[i] === '--excel-file' && args[i + 1]) {
      config.excelFile = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
📄 XML Generator from Videos
=============================

Usage:
  node generate-xml-from-videos.js [options]

Options:
  --video-folder <path>    Path to video files folder
  --api-folder <path>      Path to API responses folder
  --excel-file <path>      Path to Excel file (.xlsx)
  --help, -h               Show this help message

Examples:
  # Use all defaults (public/Videos, public/api-responses, public/video.xlsx)
  node generate-xml-from-videos.js

  # Specify custom paths
  node generate-xml-from-videos.js \\
    --video-folder /path/to/videos \\
    --api-folder /path/to/api-responses \\
    --excel-file /path/to/video.xlsx

  # Mix custom and defaults
  node generate-xml-from-videos.js --video-folder /custom/videos
`);
      process.exit(0);
    }
  }

  return config;
}

const cmdArgs = getCommandLineArgs();

// Use command-line arguments or fall back to defaults
const VIDEOS_FOLDER = cmdArgs.videoFolder 
  ? (path.isAbsolute(cmdArgs.videoFolder) ? cmdArgs.videoFolder : path.join(__dirname, cmdArgs.videoFolder))
  : path.join(__dirname, 'public', 'Videos');

const API_RESPONSES_FOLDER = cmdArgs.apiFolder
  ? (path.isAbsolute(cmdArgs.apiFolder) ? cmdArgs.apiFolder : path.join(__dirname, cmdArgs.apiFolder))
  : path.join(__dirname, 'public', 'api-responses');

const EXCEL_FILE = cmdArgs.excelFile
  ? (path.isAbsolute(cmdArgs.excelFile) ? cmdArgs.excelFile : path.join(__dirname, cmdArgs.excelFile))
  : path.join(__dirname, 'public', 'video.xlsx');

/**
 * Extract base filename from various video filename patterns
 * Examples:
 *   1PWF92_EL39N6KKU3_fc-0000002.mp4 → 1PWF92_EL39N6KKU3
 *   1PWF92_EL39N6KKU3-0000002.mp4    → 1PWF92_EL39N6KKU3
 *   1PWF92_EL39N6KKU3_0000002.mp4    → 1PWF92_EL39N6KKU3
 */
function extractBaseFilename(videoFilename) {
  // Remove extension
  const nameWithoutExt = videoFilename.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
  
  // Pattern: capture everything before _fc-, -, or _ followed by digits
  const match = nameWithoutExt.match(/^(.+?)(?:_fc)?[-_]\d+$/);
  
  if (match) {
    return match[1];
  }
  
  // Fallback: if no sequence number found, return as is
  return nameWithoutExt;
}

/**
 * Get video metadata using ffprobe
 */
function getVideoMetadata(videoFilePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFilePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        // Get filename
        const filename = path.basename(videoFilePath);

        // Get duration in seconds
        const durationSeconds = parseFloat(metadata.format.duration || videoStream.duration || 0);
        const duration = formatDuration(durationSeconds);

        // Get resolution
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const resolution = `${width} x ${height}`;

        // Get FPS
        let fps = 0;
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          fps = den ? (num / den).toFixed(2) : 0;
        }

        resolve({
          filename,
          duration,
          resolution,
          fps: parseFloat(fps)
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Format duration from seconds to HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) {
    return '0:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get Excel data for a video using base filename
 */
function getExcelDataForVideo(baseFilename) {
  try {
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Search for the base filename in "File Name" column
    const row = data.find(r => r['File Name'] === baseFilename);

    if (row) {
      return {
        teParentClip: row['File Name'] || '',
        title: row['TITLE'] || '',
        description: row['DESCRIPTION'] || ''
      };
    }

    console.warn(`⚠️  No Excel data found for: ${baseFilename}`);
    return null;
  } catch (error) {
    console.error(`❌ Error reading Excel file:`, error.message);
    return null;
  }
}

/**
 * Get JSON metadata for a video using base filename
 */
function getJsonMetadata(baseFilename) {
  try {
    const jsonPath = path.join(API_RESPONSES_FOLDER, `${baseFilename}.json`);
    
    if (!fs.existsSync(jsonPath)) {
      console.warn(`⚠️  JSON file not found: ${baseFilename}.json`);
      return { countryOrigin: '' };
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    // Extract CountryOfOrigin from the nested structure
    let countryOrigin = '';
    
    // Check if the structure uses 'list' array (new format)
    if (jsonData.list && jsonData.list[0] && jsonData.list[0].clipData) {
      const countryField = jsonData.list[0].clipData.find(
        f => f.name === 'Production.CountryOfOrigin'
      );
      if (countryField) {
        countryOrigin = countryField.value || '';
      }
    }
    // Fallback to old 'results' structure if needed
    else if (jsonData.results && jsonData.results[0] && jsonData.results[0].fields) {
      const countryField = jsonData.results[0].fields.find(
        f => f.name === 'Production.CountryOfOrigin'
      );
      if (countryField) {
        countryOrigin = countryField.value || '';
      }
    }

    return { countryOrigin };
  } catch (error) {
    console.error(`❌ Error reading JSON file for ${baseFilename}:`, error.message);
    return { countryOrigin: '' };
  }
}

/**
 * Generate XML content
 */
function generateXML(videoMetadata, excelData, jsonMetadata) {
  const {
    filename,
    duration,
    resolution,
    fps
  } = videoMetadata;

  const {
    teParentClip = '',
    title = '',
    description = ''
  } = excelData || {};

  const { countryOrigin = '' } = jsonMetadata;

  // Build XML with proper formatting (NO SPACES in empty tags)
  let xml = '<?xml version="1.0"?>\n';
  xml += '<record>\n';
  xml += `  <TE_ParentClip>${teParentClip}</TE_ParentClip>\n`;
  xml += `  <Filename>${filename}</Filename>\n`;
  xml += `  <Duration>${duration}</Duration>\n`;
  xml += `  <Resolution>${resolution}</Resolution>\n`;
  xml += `  <FPS>${fps}</FPS>\n`;
  xml += `  <Primary_Language></Primary_Language>\n`; // NO SPACE - empty tag
  xml += countryOrigin ? `  <CountryOrigin>${countryOrigin}</CountryOrigin>\n` : `  <CountryOrigin></CountryOrigin>\n`;
  xml += `  <CD_Category>Emerging Objects and Cinematic Storytelling</CD_Category>\n`;
  xml += `  <Production_TextRef>false</Production_TextRef>\n`;
  xml += `  <Title>${title}</Title>\n`;
  xml += `  <Description>${description}</Description>\n`;
  xml += '</record>';

  return xml;
}

/**
 * Main function to process all videos
 */
async function processAllVideos() {
  console.log('🚀 Starting XML generation...\n');
  console.log('📂 Video folder:        ', VIDEOS_FOLDER);
  console.log('📁 API responses folder:', API_RESPONSES_FOLDER);
  console.log('📊 Excel file:          ', EXCEL_FILE);
  console.log('');

  // Check if Videos folder exists
  if (!fs.existsSync(VIDEOS_FOLDER)) {
    console.error('❌ Videos folder not found:', VIDEOS_FOLDER);
    return;
  }

  // Check if API responses folder exists
  if (!fs.existsSync(API_RESPONSES_FOLDER)) {
    console.warn('⚠️  API responses folder not found:', API_RESPONSES_FOLDER);
    console.warn('⚠️  Continuing without API data...\n');
  }

  // Check if Excel file exists
  if (!fs.existsSync(EXCEL_FILE)) {
    console.warn('⚠️  Excel file not found:', EXCEL_FILE);
    console.warn('⚠️  Continuing without Excel data...\n');
  }

  // Get all video files
  const videoFiles = fs.readdirSync(VIDEOS_FOLDER).filter(file => {
    return /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(file);
  });

  if (videoFiles.length === 0) {
    console.log('⚠️  No video files found in Videos folder');
    return;
  }

  console.log(`📹 Found ${videoFiles.length} video file(s)\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const videoFile of videoFiles) {
    try {
      const videoFilePath = path.join(VIDEOS_FOLDER, videoFile);
      console.log(`\n📹 Processing: ${videoFile}`);

      // Step 1: Extract base filename
      const baseFilename = extractBaseFilename(videoFile);
      console.log(`   🔍 Base filename: ${baseFilename}`);

      // Step 2: Get video metadata
      console.log(`   📊 Extracting video metadata...`);
      const videoMetadata = await getVideoMetadata(videoFilePath);
      console.log(`   ✅ Duration: ${videoMetadata.duration}, Resolution: ${videoMetadata.resolution}, FPS: ${videoMetadata.fps}`);

      // Step 3: Get Excel data
      console.log(`   📄 Reading Excel data...`);
      const excelData = getExcelDataForVideo(baseFilename);
      if (excelData) {
        console.log(`   ✅ Excel data found: ${excelData.title}`);
      }

      // Step 4: Get JSON metadata
      console.log(`   📋 Reading JSON metadata...`);
      const jsonMetadata = getJsonMetadata(baseFilename);
      if (jsonMetadata.countryOrigin) {
        console.log(`   ✅ Country: ${jsonMetadata.countryOrigin}`);
      }

      // Step 5: Generate XML
      console.log(`   🔨 Generating XML...`);
      const xmlContent = generateXML(videoMetadata, excelData, jsonMetadata);

      // Step 6: Save XML file (same folder as video)
      const xmlFileName = videoFile.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '.xml');
      const xmlFilePath = path.join(VIDEOS_FOLDER, xmlFileName);
      fs.writeFileSync(xmlFilePath, xmlContent, 'utf-8');

      console.log(`   ✅ XML saved: ${xmlFileName}`);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Error processing ${videoFile}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully processed: ${successCount} file(s)`);
  console.log(`❌ Errors: ${errorCount} file(s)`);
  console.log('='.repeat(60));
}

// Run the script
processAllVideos().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

