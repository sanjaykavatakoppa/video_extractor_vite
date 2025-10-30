#!/bin/bash

# Quality Comparison Script
# Compares manual clips with automated clips

echo "🔍 Quality Comparison Test"
echo "=========================="
echo ""

echo "📊 YOUR MANUAL CLIPS (Target Quality):"
echo "----------------------------------------"
for f in public/Check/*.mp4; do
    if [ -f "$f" ]; then
        filename=$(basename "$f")
        duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
        bitrate=$(ffprobe -v error -show_entries format=bit_rate -of default=noprint_wrappers=1:nokey=1 "$f" | awk '{printf "%.0f Mbps", $1/1000000}')
        size=$(ls -lh "$f" | awk '{print $5}')
        echo "  $filename"
        echo "    Duration: ${duration}s"
        echo "    Bitrate:  $bitrate"
        echo "    Size:     $size"
        echo ""
    fi
done

echo ""
echo "🤖 AUTOMATED CLIPS (Old - Bad Quality):"
echo "----------------------------------------"
for f in public/downloaded-videos/1PWF92_EKDC3LNBSN_fc_*.mp4; do
    if [ -f "$f" ]; then
        filename=$(basename "$f")
        duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
        bitrate=$(ffprobe -v error -show_entries format=bit_rate -of default=noprint_wrappers=1:nokey=1 "$f" | awk '{printf "%.0f Mbps", $1/1000000}')
        size=$(ls -lh "$f" | awk '{print $5}')
        echo "  $filename"
        echo "    Duration: ${duration}s"
        echo "    Bitrate:  $bitrate ❌ (TOO LOW!)"
        echo "    Size:     $size"
        echo ""
    fi
done

echo ""
echo "📋 QUALITY REQUIREMENTS:"
echo "------------------------"
echo "  ✅ Bitrate:   125-135 Mbps (your manual clips)"
echo "  ✅ Duration:  9-20 seconds"
echo "  ✅ Size:      150-300 MB per clip"
echo ""
echo "🔧 TO FIX: Use method='copy' or 'high-quality'"
echo ""
echo "Example API call:"
echo '  curl -X POST http://localhost:3001/api/smart-clip-video \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{
      "videoPath": "public/downloaded-videos/1PWF92_EKDC3LNBSN_fc.mov",
      "outputDir": "public/Videos-Fixed",
      "method": "copy"
    }'"'"
echo ""

