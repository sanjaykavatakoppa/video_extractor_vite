// ============================================================================
// XML GENERATOR - Standalone JavaScript
// ============================================================================
// This file handles all the logic for generating XML files from video metadata
// ============================================================================

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    serverOnline: false,
    videoFolderPath: '',
    apiResponsesPath: '',
    excelPath: '',
    isGenerating: false,
    progress: {
        current: 0,
        total: 0,
        currentFile: '',
        status: 'idle'
    },
    generatedFiles: [],
    errors: []
};

// ============================================================================
// INITIALIZATION
// ============================================================================

// Check server status on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 XML Generator loaded');
    checkServerStatus();
    // Check server status every 30 seconds
    setInterval(checkServerStatus, 30000);
});

// ============================================================================
// SERVER STATUS
// ============================================================================

async function checkServerStatus() {
    try {
        const response = await fetch('http://localhost:3001/api/health');
        state.serverOnline = response.ok;
        updateServerStatusUI();
    } catch (error) {
        console.error('Server check failed:', error);
        state.serverOnline = false;
        updateServerStatusUI();
    }
}

function updateServerStatusUI() {
    const statusElement = document.getElementById('serverStatus');
    if (state.serverOnline) {
        statusElement.className = 'server-status online';
        statusElement.innerHTML = '<span class="status-indicator"></span><span>🟢 Server Online</span>';
    } else {
        statusElement.className = 'server-status offline';
        statusElement.innerHTML = '<span class="status-indicator"></span><span>🔴 Server Offline</span>';
    }
}

// ============================================================================
// FOLDER/FILE SELECTION
// ============================================================================

function selectVideoFolder() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.directory = true;
    
    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Extract the folder path from the first file
            const firstFile = files[0];
            const pathParts = firstFile.webkitRelativePath.split('/');
            const folderName = pathParts[0];
            
            // For folders within public/, prepend 'public/'
            state.videoFolderPath = 'public/' + folderName;
            
            document.getElementById('videoPath').textContent = state.videoFolderPath;
            console.log('📂 Video folder selected:', state.videoFolderPath);
        }
    };
    
    input.click();
}

function selectApiFolder() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.directory = true;
    
    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const firstFile = files[0];
            const pathParts = firstFile.webkitRelativePath.split('/');
            const folderName = pathParts[0];
            
            state.apiResponsesPath = 'public/' + folderName;
            
            document.getElementById('apiPath').textContent = state.apiResponsesPath;
            console.log('📁 API responses folder selected:', state.apiResponsesPath);
        }
    };
    
    input.click();
}

function selectExcelFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // For files within public/, prepend 'public/'
            state.excelPath = 'public/' + file.name;
            
            document.getElementById('excelPath').textContent = state.excelPath;
            console.log('📊 Excel file selected:', state.excelPath);
        }
    };
    
    input.click();
}

// ============================================================================
// XML GENERATION
// ============================================================================

async function generateXML() {
    // Validation
    if (!state.serverOnline) {
        alert('⚠️ Server is offline! Please start the server first.');
        return;
    }

    if (state.isGenerating) {
        alert('⚠️ Generation already in progress!');
        return;
    }

    // Use defaults if not selected
    const videoPath = state.videoFolderPath || 'public/Videos';
    const apiPath = state.apiResponsesPath || 'public/api-responses';
    const excelPath = state.excelPath || 'public/video.xlsx';

    console.log('🚀 Starting XML generation...');
    console.log('📂 Video folder:', videoPath);
    console.log('📁 API responses:', apiPath);
    console.log('📊 Excel file:', excelPath);

    // Reset state
    state.isGenerating = true;
    state.progress = { current: 0, total: 0, currentFile: '', status: 'starting' };
    state.generatedFiles = [];
    state.errors = [];

    // Update UI
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('generateBtn').textContent = '⏳ Generating...';
    document.getElementById('progressSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('errorsSection').classList.add('hidden');
    document.getElementById('successBanner').classList.add('hidden');

    try {
        const response = await fetch('http://localhost:3001/api/generate-xml', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                folderName: videoPath,
                apiResponsesFolder: apiPath,
                excelFile: excelPath
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    handleStreamingData(data);
                } catch (e) {
                    console.error('Error parsing JSON:', e, line);
                }
            }
        }

        // Generation complete
        console.log('✅ Generation complete!');
        showCompletionUI();

    } catch (error) {
        console.error('❌ Error generating XML:', error);
        alert(`Error: ${error.message}`);
        state.errors.push({
            file: 'System',
            error: error.message
        });
        updateErrorsUI();
    } finally {
        state.isGenerating = false;
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('generateBtn').textContent = '🚀 Generate XML Files';
    }
}

// ============================================================================
// STREAMING DATA HANDLER
// ============================================================================

function handleStreamingData(data) {
    console.log('📦 Received:', data.type, data);

    if (data.type === 'progress') {
        state.progress = {
            current: data.current,
            total: data.total,
            currentFile: data.file,
            status: 'processing'
        };
        updateProgressUI();

    } else if (data.type === 'success') {
        state.generatedFiles.push({
            video: data.videoFile,
            xml: data.xmlFile,
            title: data.title
        });
        updateResultsUI();

    } else if (data.type === 'error') {
        state.errors.push({
            file: data.file,
            error: data.error
        });
        updateErrorsUI();

    } else if (data.type === 'complete') {
        state.progress.status = 'complete';
        console.log('✅ All files processed');
    }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateProgressUI() {
    const { current, total, currentFile } = state.progress;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    document.getElementById('progressStatus').textContent = 
        state.progress.status === 'complete' ? '✅ Complete' : '⚙️ Processing';
    document.getElementById('progressCount').textContent = `${current} / ${total} files`;
    document.getElementById('progressBar').style.width = `${percentage}%`;
    document.getElementById('progressPercent').textContent = `${percentage}%`;
    document.getElementById('currentFile').textContent = `📄 ${currentFile || 'Processing...'}`;
}

function updateResultsUI() {
    const successList = document.getElementById('successList');
    const successCount = document.getElementById('successCount');
    
    successCount.textContent = state.generatedFiles.length;
    
    // Show the section
    document.getElementById('resultsSection').classList.remove('hidden');
    
    // Clear and rebuild list
    successList.innerHTML = '';
    state.generatedFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <strong>✅ ${index + 1}. ${item.video}</strong>
            <span>→ ${item.xml}</span><br>
            <span>Title: ${item.title}</span>
        `;
        successList.appendChild(div);
    });
}

function updateErrorsUI() {
    const errorList = document.getElementById('errorList');
    const errorCount = document.getElementById('errorCount');
    
    errorCount.textContent = state.errors.length;
    
    if (state.errors.length > 0) {
        // Show the section
        document.getElementById('errorsSection').classList.remove('hidden');
        
        // Clear and rebuild list
        errorList.innerHTML = '';
        state.errors.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'result-item error';
            div.innerHTML = `
                <strong>❌ ${index + 1}. ${item.file}</strong>
                <span>${item.error}</span>
            `;
            errorList.appendChild(div);
        });
    }
}

function showCompletionUI() {
    if (state.errors.length === 0 && state.generatedFiles.length > 0) {
        document.getElementById('successBanner').classList.remove('hidden');
    }
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

window.debugState = () => {
    console.log('🔍 Current State:', state);
};

window.resetState = () => {
    state.videoFolderPath = '';
    state.apiResponsesPath = '';
    state.excelPath = '';
    state.generatedFiles = [];
    state.errors = [];
    state.progress = { current: 0, total: 0, currentFile: '', status: 'idle' };
    
    document.getElementById('videoPath').textContent = 'No folder selected';
    document.getElementById('apiPath').textContent = 'No folder selected';
    document.getElementById('excelPath').textContent = 'No file selected';
    document.getElementById('progressSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('errorsSection').classList.add('hidden');
    document.getElementById('successBanner').classList.add('hidden');
    
    console.log('✅ State reset');
};

console.log('📄 XML Generator JS loaded successfully!');
console.log('💡 Debug commands:');
console.log('   - window.debugState() - Show current state');
console.log('   - window.resetState() - Reset all selections');

