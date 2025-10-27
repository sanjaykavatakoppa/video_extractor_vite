import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate XML files from video metadata WITHOUT ffprobe dependency
 * Uses metadata from JSON files and video filenames
 */

/**
 * Extract base filename from various video filename patterns
 */
function extractBaseFilename(videoFilename) {
  const nameWithoutExt = videoFilename.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
  const match = nameWithoutExt.match(/^(.+?)(?:_fc)?[-_]\d+$/);
  
  if (match) {
    return match[1];
  }
  
  const matchWithFc = nameWithoutExt.match(/^(.+?)_fc$/);
  if (matchWithFc) {
    return matchWithFc[1];
  }
  
  return nameWithoutExt;
}

/**
 * Get video metadata from JSON file (NO ffprobe needed!)
 */
function getVideoMetadataFromJson(baseFilename, apiResponsesFolder) {
  try {
    const jsonPath = path.join(apiResponsesFolder, `${baseFilename}.json`);
    
    if (!fs.existsSync(jsonPath)) {
      console.warn(`   ⚠️  JSON file not found: ${baseFilename}.json`);
      return null;
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
        // Extract number from "29.97 fps"
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
      fps: parseFloat(frameRate),
      resolution: frameSize,
      countryOrigin: countryOrigin
    };
  } catch (error) {
    console.error(`   ❌ Error reading JSON for ${baseFilename}:`, error.message);
    return null;
  }
}

/**
 * Get Excel data for a video using base filename
 */
function getExcelDataForVideo(baseFilename, excelFilePath) {
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

    console.warn(`   ⚠️  No Excel data found for: ${baseFilename}`);
    return null;
  } catch (error) {
    console.error(`   ❌ Error reading Excel file:`, error.message);
    return null;
  }
}

/**
 * Generate XML content (NO ffprobe required!)
 */
function generateXML(videoFileName, jsonMetadata, excelData) {
  const {
    fps = 30.00,
    resolution = '1920 x 1080',
    countryOrigin = ''
  } = jsonMetadata || {};

  const {
    teParentClip = '',
    title = '',
    description = ''
  } = excelData || {};

  // Use placeholder duration (can't get without ffprobe, but not critical)
  const duration = '0:00:00';

  let xml = '<?xml version="1.0"?>\n';
  xml += '<record>\n';
  xml += `  <TE_ParentClip>${teParentClip}</TE_ParentClip>\n`;
  xml += `  <Filename>${videoFileName}</Filename>\n`;
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

/**
 * Main function to process all videos in a folder
 */
async function processVideosInFolder(videosFolder, apiResponsesFolder, excelFilePath) {
  console.log(`\n🚀 Starting XML generation for folder: ${videosFolder}\n`);

  if (!fs.existsSync(videosFolder)) {
    console.error('❌ Videos folder not found:', videosFolder);
    return { successCount: 0, errorCount: 1, total: 0 };
  }

  // Get all video files
  const videoFiles = fs.readdirSync(videosFolder).filter(file => {
    return /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(file);
  });

  if (videoFiles.length === 0) {
    console.log('⚠️  No video files found in folder');
    return { successCount: 0, errorCount: 0, total: 0 };
  }

  console.log(`📹 Found ${videoFiles.length} video file(s)\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const videoFile of videoFiles) {
    try {
      console.log(`\n📹 Processing: ${videoFile}`);

      // Extract base filename
      const baseFilename = extractBaseFilename(videoFile);
      console.log(`   🔍 Base filename: ${baseFilename}`);

      // Get metadata from JSON (NO ffprobe!)
      console.log(`   📋 Reading JSON metadata...`);
      const jsonMetadata = getVideoMetadataFromJson(baseFilename, apiResponsesFolder);
      
      if (jsonMetadata) {
        console.log(`   ✅ Resolution: ${jsonMetadata.resolution}, FPS: ${jsonMetadata.fps}`);
      }

      // Get Excel data
      console.log(`   📄 Reading Excel data...`);
      const excelData = getExcelDataForVideo(baseFilename, excelFilePath);
      
      if (excelData) {
        console.log(`   ✅ Excel data found: ${excelData.title}`);
      }

      // Generate XML
      console.log(`   🔨 Generating XML...`);
      const xmlContent = generateXML(videoFile, jsonMetadata, excelData);

      // Save XML file
      const xmlFileName = videoFile.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '.xml');
      const xmlFilePath = path.join(videosFolder, xmlFileName);
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

  return { successCount, errorCount, total: videoFiles.length };
}

// CLI usage
if (process.argv.length >= 4) {
  const videosFolder = process.argv[2];
  const apiResponsesFolder = process.argv[3];
  const excelFilePath = process.argv[4] || path.join(__dirname, 'public/video.xlsx');
  
  processVideosInFolder(videosFolder, apiResponsesFolder, excelFilePath).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
} else {
  console.log('Usage: node generate-xml-no-ffprobe.js <videos_folder> <api_responses_folder> [excel_file]');
  console.log('Example: node generate-xml-no-ffprobe.js public/Videos public/api-responses public/video.xlsx');
}

// Export for use in server
export { processVideosInFolder, generateXML, extractBaseFilename, getVideoMetadataFromJson, getExcelDataForVideo };

