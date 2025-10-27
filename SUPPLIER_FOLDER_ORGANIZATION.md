# 📁 Supplier Folder Organization - Video Downloads

## 🎯 Overview

Videos are now automatically organized into folders based on their **Supplier ID** during download. Each video is placed in a folder named after its `TWK.SupplierID` value from the JSON metadata.

---

## 🔄 How It Works

### **Download Process Flow**

```
1. User requests video download
   ↓
2. System fetches video metadata (compRendition.name)
   ↓
3. Extract base filename from video name
   Example: 1PWF92_EK4Q2TFQNB_0000001.mp4 → 1PWF92_EK4Q2TFQNB
   ↓
4. Look up corresponding JSON file
   Location: public/api-responses/1PWF92_EK4Q2TFQNB.json
   ↓
5. Extract TWK.SupplierID from JSON
   Example: "31638097"
   ↓
6. Check if supplier folder exists
   ├─ Exists? → Use existing folder
   └─ Not exists? → Create new folder
   ↓
7. Download video into supplier folder
   Path: public/downloaded-videos/31638097/video.mp4
```

---

## 📂 Folder Structure

```
public/
└── downloaded-videos/
    ├── 31638097/                          ← Supplier ID folder
    │   ├── 1PWF92_EK4Q2TFQNB_0000001.mp4
    │   ├── 1PWF92_EK4Q2TFQNB_0000002.mp4
    │   └── 1PWF92_EK4Q2TFQNB_0000003.mp4
    ├── 31638098/                          ← Another Supplier ID
    │   ├── 2ABC12_XYZ123_0000001.mp4
    │   └── 2ABC12_XYZ123_0000002.mp4
    └── default/                            ← Fallback (if no Supplier ID found)
        └── unknown_video.mp4
```

---

## 🛠️ Technical Implementation

### **1. Extract Base Filename**

```javascript
function extractBaseFileName(videoFileName) {
  // Remove extension
  const nameWithoutExt = videoFileName.replace(/\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i, '');
  
  // Extract base name (handles multiple patterns)
  // 1PWF92_EK4Q2TFQNB_fc-0000002 → 1PWF92_EK4Q2TFQNB
  // 1PWF92_EK4Q2TFQNB-0000002    → 1PWF92_EK4Q2TFQNB
  // 1PWF92_EK4Q2TFQNB_0000002    → 1PWF92_EK4Q2TFQNB
  const match = nameWithoutExt.match(/^(.+?)(?:_fc)?[-_]\d+$/);
  
  return match ? match[1] : nameWithoutExt;
}
```

### **2. Get Supplier ID from JSON**

```javascript
function getSupplierIdFromJson(fileName) {
  const jsonPath = path.join(__dirname, 'public', 'api-responses', `${fileName}.json`);
  
  if (!fs.existsSync(jsonPath)) {
    return null; // JSON file not found
  }
  
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  // Navigate JSON structure: list[0].clipData[] → find TWK.SupplierID
  if (jsonData.list && jsonData.list[0] && jsonData.list[0].clipData) {
    const supplierField = jsonData.list[0].clipData.find(
      item => item.name === 'TWK.SupplierID'
    );
    
    if (supplierField && supplierField.value) {
      return supplierField.value; // Return: "31638097"
    }
  }
  
  return null;
}
```

### **3. Create/Get Supplier Folder**

```javascript
function getSupplierFolder(supplierId) {
  const supplierFolder = path.join(OUTPUT_DIR, supplierId);
  
  if (!fs.existsSync(supplierFolder)) {
    fs.mkdirSync(supplierFolder, { recursive: true });
    console.log(`✨ Created new folder: ${supplierId}/`);
  } else {
    console.log(`📂 Using existing folder: ${supplierId}/`);
  }
  
  return supplierFolder;
}
```

### **4. Updated Download Endpoint**

```javascript
// In /api/download-videos endpoint:

// 1. Extract base filename
const outputFileName = compRendition.name;
const baseFileName = extractBaseFileName(outputFileName);

// 2. Get Supplier ID from JSON
const supplierId = getSupplierIdFromJson(baseFileName);

// 3. Get or create supplier folder
const targetFolder = supplierId 
  ? getSupplierFolder(supplierId) 
  : OUTPUT_DIR; // Fallback to default

// 4. Download to supplier folder
const outputPath = path.join(targetFolder, outputFileName);
await downloadFile(downloadUrl, outputPath, progressCallback);
```

---

## 📊 JSON Structure Example

**File:** `public/api-responses/1PWF92_EK4Q2TFQNB.json`

```json
{
  "list": [
    {
      "id": 61891797,
      "name": "1PWF92_EK4Q2TFQNB",
      "clipData": [
        {
          "id": 3045841114,
          "name": "Description",
          "value": "DJI_0218.MP4"
        },
        {
          "id": 3045841116,
          "name": "Title",
          "value": "Sorano, Italy"
        },
        {
          "id": 3045846761,
          "name": "TWK.SupplierID",        ← This value
          "value": "31638097"               ← Used for folder name
        },
        {
          "id": 3045849220,
          "name": "Production.CountryOfOrigin",
          "value": "Italy"
        }
      ]
    }
  ]
}
```

---

## ✅ Features

### **Automatic Organization**
- ✅ Videos automatically sorted by Supplier ID
- ✅ No manual folder management needed
- ✅ Clean, organized structure

### **Smart Folder Creation**
- ✅ Checks if folder exists before creating
- ✅ Creates folders only when needed
- ✅ Reuses existing folders

### **Fallback Handling**
- ✅ Uses default folder if JSON not found
- ✅ Uses default folder if Supplier ID missing
- ✅ Continues download even on errors

### **Console Logging**
- ✅ Shows base filename extraction
- ✅ Shows Supplier ID lookup
- ✅ Shows folder creation/reuse
- ✅ Clear progress indicators

---

## 🎯 Example Scenarios

### **Scenario 1: Normal Download**
```
Input: 1PWF92_EK4Q2TFQNB_0000001.mp4
  ↓
Base filename: 1PWF92_EK4Q2TFQNB
  ↓
JSON: public/api-responses/1PWF92_EK4Q2TFQNB.json
  ↓
Supplier ID: 31638097
  ↓
Output: public/downloaded-videos/31638097/1PWF92_EK4Q2TFQNB_0000001.mp4
```

### **Scenario 2: JSON Not Found**
```
Input: 4NMF6D_7SB3GRN3UQ_0000001.mp4
  ↓
Base filename: 4NMF6D_7SB3GRN3UQ
  ↓
JSON: ⚠️ Not found
  ↓
Supplier ID: null (fallback to default)
  ↓
Output: public/downloaded-videos/4NMF6D_7SB3GRN3UQ_0000001.mp4
```

### **Scenario 3: Multiple Videos, Same Supplier**
```
Video 1: 1PWF92_EK4Q2TFQNB_0000001.mp4 → Supplier: 31638097
  ↓ Creates folder: 31638097/

Video 2: 1PWF92_EK4Q2TFQNB_0000002.mp4 → Supplier: 31638097
  ↓ Uses existing folder: 31638097/

Video 3: 1PWF92_EK4Q2TFQNB_0000003.mp4 → Supplier: 31638097
  ↓ Uses existing folder: 31638097/

Result:
  downloaded-videos/
    └── 31638097/
        ├── 1PWF92_EK4Q2TFQNB_0000001.mp4
        ├── 1PWF92_EK4Q2TFQNB_0000002.mp4
        └── 1PWF92_EK4Q2TFQNB_0000003.mp4
```

---

## 🔍 Console Output Example

```bash
📹 Processing: Row 1
   🔍 Base filename: 1PWF92_EK4Q2TFQNB
   📁 Found Supplier ID: 31638097
   ✨ Created new folder: 31638097/
   ⬇️  Downloading: 1PWF92_EK4Q2TFQNB_0000001.mp4
   ✅ Downloaded: 171.23 MB

📹 Processing: Row 2
   🔍 Base filename: 1PWF92_EK4Q2TFQNB
   📁 Found Supplier ID: 31638097
   📂 Using existing folder: 31638097/
   ⬇️  Downloading: 1PWF92_EK4Q2TFQNB_0000002.mp4
   ✅ Downloaded: 163.45 MB
```

---

## 🎨 Frontend Updates

The `VideoDownloader` component now displays the supplier folder:

```jsx
<div className="file-item">
  <div className="file-name">{file.name}</div>
  <div className="item-folder">📁 Folder: {file.supplierFolder}</div>
  {file.excelUpdated && <span className="excel-badge">✅ Excel</span>}
</div>
```

---

## 📝 Benefits

| Benefit | Description |
|---------|-------------|
| **Organization** | Videos grouped by supplier, easy to find |
| **Scalability** | Handles hundreds of suppliers automatically |
| **Maintainability** | Clear structure, easy to manage |
| **Flexibility** | Fallback to default folder if needed |
| **Traceability** | Supplier ID visible in file path |

---

## 🚀 Usage

### **Download Videos**

1. **Open the app:**
   ```
   http://localhost:3000
   ```

2. **Click mode:**
   ```
   ⬇️ Download from Excel
   ```

3. **Enter details:**
   - Start Row: 1
   - Number of Videos: 10

4. **Click download:**
   ```
   ⬇️ Download Videos
   ```

5. **Check folder structure:**
   ```bash
   ls -la public/downloaded-videos/
   
   drwxr-xr-x  31638097/
   drwxr-xr-x  31638098/
   drwxr-xr-x  31638099/
   ```

---

## ✨ Complete!

Videos are now automatically organized by **Supplier ID** during download! 🎉

**Key Files Updated:**
- ✅ `server.js` - Added helper functions and updated download endpoint
- ✅ Supplier folder organization fully implemented
- ✅ Console logging for transparency
- ✅ Frontend displays supplier folder

**No user action required** - everything happens automatically! 🚀

