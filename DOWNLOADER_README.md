# Video Downloader from Excel

Download videos from the API using Clip IDs from Excel file.

## 🚀 Quick Start

### Method 1: Using the HTML UI (Easiest)

1. Open `public/downloader.html` in your browser
2. Enter the starting row number and number of videos
3. Copy the generated command
4. Run it in terminal

### Method 2: Direct Command Line

```bash
# Download 1 video from row 1
node download-videos.js --start 1 --count 1

# Download 5 videos starting from row 10
node download-videos.js --start 10 --count 5

# Download 3 videos starting from row 50
node download-videos.js --start 50 --count 3
```

## 📋 Command Line Arguments

- `--start` or `-s`: Starting row number in Excel (1-based index)
- `--count` or `-c`: Number of videos to download

## 📂 Output Location

Downloaded videos are saved to: `public/downloaded-videos/`

## 📝 File Naming

Videos are downloaded with their comp rendition names:
- Format: `{ClipName}_fc.mov`
- Example: `1PWF92_EK4Q2TFQNB_fc.mov`

## ⚙️ How It Works

1. **Reads Excel**: Opens `public/video.xlsx`
2. **Extracts Clip IDs**: From the "Clip ID" column
3. **Fetches Metadata**: Calls API to get clip information
4. **Gets Download URL**: Uses renditionUrl/select API to get signed URL
5. **Downloads**: Downloads the comp rendition (full size, compressed)

## 📊 Example Scenarios

**Download first video:**
```bash
node download-videos.js --start 1 --count 1
```

**Download videos 10-14 (5 videos):**
```bash
node download-videos.js --start 10 --count 5
```

**Download single video from row 100:**
```bash
node download-videos.js --start 100 --count 1
```

## 💡 Tips

- Start with small counts (1-5) to test
- Check available disk space before downloading many videos
- Comp files are typically 100-600 MB each
- Script includes 500ms delay between downloads to avoid API rate limits

## 🔧 Troubleshooting

**"No space left on device":**
- Free up disk space
- Download fewer videos at a time

**"No Clip ID found":**
- Check Excel file has "Clip ID" column
- Verify row numbers are correct

**API errors:**
- Check internet connection
- Verify API key is valid
- Some clips might not have comp renditions available

## 📦 Dependencies

Make sure you have installed:
```bash
npm install xlsx
```

