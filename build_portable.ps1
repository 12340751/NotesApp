# Final Robust Portable Build Script
$projectName = "NotesApp"
$buildDir = "C:\$projectName-Build"
$tempDir = "C:\$projectName-Temp"
$desktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")

# Create directories
if (!(Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force }
if (Test-Path $buildDir) { Remove-Item -Path $buildDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $buildDir -Force

# Override environment variables to avoid Cyrillic and Symlink issues
$env:TEMP = $tempDir
$env:TMP = $tempDir
$env:ELECTRON_BUILDER_CACHE = "C:\eb_cache"
$env:CSC_SKIP_SIGNING = "true" # Bypass signing tools that cause symlink errors

Write-Host "--- 1. Copying project files to C:\ ---" -ForegroundColor Cyan
Copy-Item -Path ".\*" -Destination $buildDir -Recurse -Exclude "node_modules", "dist", ".git", "app.py"

Set-Location $buildDir

Write-Host "--- 2. Installing dependencies ---" -ForegroundColor Cyan
& npm install --no-package-lock

Write-Host "--- 3. Building Portable EXE ---" -ForegroundColor Cyan
# Specifically target only windows to avoid downloading mac/linux signing tools
& npx electron-builder build --win portable --x64

Write-Host "--- 4. Checking results ---" -ForegroundColor Cyan
if (Test-Path "$buildDir\dist") {
    $exeFile = Get-ChildItem -Path "$buildDir\dist\*.exe" | Where-Object { $_.Name -notlike "*blockmap*" } | Select-Object -First 1
    if ($exeFile) {
        Copy-Item -Path $exeFile.FullName -Destination "$desktopPath\NotesApp-Portable.exe" -Force
        Write-Host "!!! SUCCESS !!!" -ForegroundColor Green
        Write-Host "File 'NotesApp-Portable.exe' is now on your Desktop." -ForegroundColor Green
    } else {
        Write-Host "ERROR: Portable EXE not found. It seems the build failed." -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: Build failed completely." -ForegroundColor Red
}

Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
