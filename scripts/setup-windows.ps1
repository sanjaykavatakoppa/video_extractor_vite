# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1

Write-Host "🚀 Windows environment setup starting..." -ForegroundColor Cyan

# Ensure script runs from project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location "$ScriptDir\.."

# Helper to run commands safely
function Run-Command($Command, $ErrorMessage) {
    try {
        Write-Host "→ $Command" -ForegroundColor Yellow
        Invoke-Expression $Command
    } catch {
        Write-Host "✖ $ErrorMessage" -ForegroundColor Red
        throw $_
    }
}

# 1. Install Python (if missing)
$pythonVersion = (& py -3 --version) 2>$null
if (-not $pythonVersion) {
    Write-Host "⚠ Python 3 not found. Installing via winget..." -ForegroundColor Yellow
    Run-Command "winget install -e --id Python.Python.3" "Failed to install Python. Please install from microsoft.com/python"
} else {
    Write-Host "✅ Python already installed: $pythonVersion" -ForegroundColor Green
}

# 2. Install required Python packages
Write-Host "📦 Installing Python packages (opencv-python, numpy, scenedetect)..." -ForegroundColor Cyan
Run-Command "py -3 -m pip install --user --upgrade pip" "Failed to upgrade pip"
Run-Command "py -3 -m pip install --user opencv-python numpy scenedetect" "Failed to install Python packages"

# 3. Ensure python3 shim works
$python3check = (& python3 --version) 2>$null
if (-not $python3check) {
    Write-Host "ℹ Creating python3 shim..." -ForegroundColor Cyan
    $shimPath = "$env:LOCALAPPDATA\Microsoft\WindowsApps\python3.cmd"
    "@echo off`r`npy -3 %*" | Out-File -FilePath $shimPath -Encoding ASCII
    Write-Host "✅ python3 shim created at $shimPath" -ForegroundColor Green
} else {
    Write-Host "✅ python3 command already available: $python3check" -ForegroundColor Green
}

# 4. Ensure ffmpeg/ffprobe available via npm packages
Write-Host "📦 Installing Node ffmpeg binaries (@ffmpeg-installer/ffmpeg, @ffprobe-installer/ffprobe)..." -ForegroundColor Cyan
Run-Command "npm install" "Failed to install npm dependencies"

Write-Host "🎉 Windows setup complete!" -ForegroundColor Green
Write-Host "You can now run npm run dev:all" -ForegroundColor Cyan

