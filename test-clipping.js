#!/usr/bin/env node

/**
 * Test script for Video Clipping API
 * Tests the video clipping functionality with the user's video
 */

import https from 'https';
import http from 'http';

const API_BASE = 'http://localhost:3001';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

// Test 1: Analyze Video
async function testAnalyzeVideo() {
  logSection('TEST 1: Analyze Video');
  
  const videoPath = 'public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov';
  
  log(`📹 Video: ${videoPath}`, 'cyan');
  log('⏳ Analyzing...', 'yellow');
  
  try {
    const response = await fetch(`${API_BASE}/api/analyze-video-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Analysis successful!', 'green');
      log('\n📊 Video Information:', 'bright');
      log(`   File: ${data.analysis.fileName}`);
      log(`   Size: ${data.analysis.fileSize}`);
      log(`   Duration: ${data.analysis.duration}`);
      log(`   Bitrate: ${data.analysis.bitrate}`);
      
      if (data.analysis.video) {
        log(`   Resolution: ${data.analysis.video.resolution}`);
        log(`   FPS: ${data.analysis.video.fps.toFixed(2)}`);
        log(`   Video Codec: ${data.analysis.video.codec}`);
      }
      
      return data.analysis;
    } else {
      log(`❌ Analysis failed: ${data.error}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

// Test 2: Create a Single Test Clip
async function testSingleClip() {
  logSection('TEST 2: Create Single Test Clip');
  
  const videoPath = 'public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov';
  const outputDir = 'public/Videos-Test';
  
  log('✂️ Creating test clip: 0-10 seconds', 'cyan');
  log('⏳ Processing...', 'yellow');
  
  try {
    const response = await fetch(`${API_BASE}/api/clip-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoPath,
        clips: [
          { start: 0, end: 10, name: 'test_clip_01' }
        ],
        outputDir,
        method: 'copy'
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let results = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'info') {
            log(`ℹ️  ${data.message}`, 'blue');
          } else if (data.type === 'progress') {
            log(`⏳ Processing clip ${data.current}/${data.total}: ${data.outputFile}`, 'yellow');
          } else if (data.type === 'encoding') {
            log(`🎬 Encoding: ${data.percent}%`, 'cyan');
          } else if (data.type === 'success') {
            log(`✅ Clip ${data.clipNumber}: ${data.fileName} (${data.actualDuration}s, ${data.fileSize})`, 'green');
          } else if (data.type === 'error') {
            log(`❌ Error: ${data.message}`, 'red');
          } else if (data.type === 'complete') {
            results = data;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    if (results) {
      log('\n🎉 Test clip created successfully!', 'green');
      log(`   Output: ${results.outputDir}`);
      log(`   Success: ${results.successCount}, Errors: ${results.errorCount}`);
      return true;
    }
    
    return false;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// Test 3: Re-create All 6 Clips from Markers
async function testAllClipsFromMarkers() {
  logSection('TEST 3: Re-create All 6 Clips from Markers');
  
  const videoPath = 'public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov';
  const outputDir = 'public/Videos-Complete';
  
  // Clips from marker XML (all 6)
  const clips = [
    { start: 0.00, end: 17.87, name: '0000001' },
    { start: 17.87, end: 35.74, name: '0000002' },
    { start: 35.74, end: 53.61, name: '0000003' },
    { start: 53.61, end: 71.47, name: '0000004' },
    { start: 71.47, end: 89.34, name: '0000005' },
    { start: 89.34, end: 107.21, name: '0000006' }
  ];
  
  log('✂️ Creating all 6 clips from marker XML', 'cyan');
  log(`   Method: Accurate Encode (frame-accurate)`, 'cyan');
  log(`   Output: ${outputDir}`, 'cyan');
  log('⏳ Processing (this may take a few minutes)...', 'yellow');
  
  try {
    const response = await fetch(`${API_BASE}/api/clip-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoPath,
        clips,
        outputDir,
        method: 'encode' // Use accurate encoding
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let results = null;
    let lastProgress = -1;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'info') {
            log(`ℹ️  ${data.message}`, 'blue');
          } else if (data.type === 'progress') {
            log(`⏳ Processing clip ${data.current}/${data.total}: ${data.outputFile}`, 'yellow');
            log(`   Time range: ${data.clip.start}s → ${data.clip.end}s (${data.clip.duration}s)`, 'cyan');
          } else if (data.type === 'encoding') {
            if (data.percent % 10 === 0 && data.percent !== lastProgress) {
              log(`🎬 Encoding clip ${data.current}/${data.total}: ${data.percent}% - ${data.timemark}`, 'cyan');
              lastProgress = data.percent;
            }
          } else if (data.type === 'success') {
            const duration = parseFloat(data.actualDuration);
            const expected = 17.87;
            const diff = Math.abs(duration - expected);
            const accurate = diff < 0.1 ? '✅' : '⚠️';
            
            log(`${accurate} Clip ${data.clipNumber}: ${data.fileName}`, 'green');
            log(`   Duration: ${data.actualDuration}s (expected: ${expected}s, diff: ${diff.toFixed(2)}s)`, 'cyan');
            log(`   Size: ${data.fileSize}`, 'cyan');
          } else if (data.type === 'error') {
            log(`❌ Error: ${data.message}`, 'red');
          } else if (data.type === 'complete') {
            results = data;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    if (results) {
      log('\n🎉 All clips created successfully!', 'green');
      log(`   Output: ${results.outputDir}`);
      log(`   Success: ${results.successCount}, Errors: ${results.errorCount}`);
      
      if (results.results && results.results.length > 0) {
        log('\n📊 Results Summary:', 'bright');
        
        let totalRequestedDuration = 0;
        let totalActualDuration = 0;
        
        results.results.forEach(result => {
          const requested = parseFloat(result.requestedDuration);
          const actual = parseFloat(result.actualDuration);
          totalRequestedDuration += requested;
          totalActualDuration += actual;
          
          const diff = Math.abs(actual - requested);
          const status = diff < 0.1 ? '✅' : '⚠️';
          
          log(`   ${status} Clip ${result.clipNumber}: ${result.actualDuration}s / ${result.requestedDuration}s`);
        });
        
        log(`\n   Total Duration: ${totalActualDuration.toFixed(2)}s (expected: ${totalRequestedDuration.toFixed(2)}s)`);
        
        const totalDiff = Math.abs(totalActualDuration - 107.21);
        if (totalDiff < 1.0) {
          log(`   ✅ Total matches original video (${totalDiff.toFixed(2)}s difference)`, 'green');
        } else {
          log(`   ⚠️ Total differs from original video (${totalDiff.toFixed(2)}s difference)`, 'yellow');
        }
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n🧪 Video Clipping API Test Suite', 'bright');
  log('================================\n', 'bright');
  
  log('⚙️  Prerequisites:', 'yellow');
  log('   1. Server running on http://localhost:3001');
  log('   2. Video file exists: public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_fc.mov');
  log('   3. FFmpeg installed on system\n');
  
  // Wait for user confirmation
  log('Press Ctrl+C to cancel, or wait 3 seconds to continue...', 'cyan');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Test 1: Analyze Video
    const analysis = await testAnalyzeVideo();
    if (!analysis) {
      log('\n⚠️  Skipping remaining tests due to analysis failure', 'yellow');
      return;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Single Clip
    const singleClipSuccess = await testSingleClip();
    if (!singleClipSuccess) {
      log('\n⚠️  Single clip test failed, but continuing...', 'yellow');
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: All Clips from Markers
    const allClipsSuccess = await testAllClipsFromMarkers();
    
    // Final summary
    logSection('TEST SUMMARY');
    log(`Test 1 (Analyze): ${analysis ? '✅ PASSED' : '❌ FAILED'}`, analysis ? 'green' : 'red');
    log(`Test 2 (Single Clip): ${singleClipSuccess ? '✅ PASSED' : '❌ FAILED'}`, singleClipSuccess ? 'green' : 'red');
    log(`Test 3 (All Clips): ${allClipsSuccess ? '✅ PASSED' : '❌ FAILED'}`, allClipsSuccess ? 'green' : 'red');
    
    if (analysis && singleClipSuccess && allClipsSuccess) {
      log('\n🎉 All tests passed!', 'green');
    } else {
      log('\n⚠️  Some tests failed. Check the logs above for details.', 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

