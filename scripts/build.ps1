param(
    [switch]$Clean,
    [switch]$Help
)

# -----------------------------
# HELP
# -----------------------------
if ($Help)
{
    Write-Host ""
    Write-Host "React Native Android build script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  ./scripts/build.ps1           -> normal build"
    Write-Host "  ./scripts/build.ps1 -Clean    -> full clean + build"
    Write-Host "  ./scripts/build.ps1 -Help     -> show this help"
    Write-Host ""
    return
}

Write-Host "== React Native Android build ==" -ForegroundColor Cyan

# -----------------------------
# Go to project root (always)
# -----------------------------
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

# -----------------------------
# OPTIONAL CLEAN (root only)
# -----------------------------
if ($Clean)
{
    Write-Host "Cleaning previous Android builds..." -ForegroundColor Yellow

    Remove-Item -Recurse -Force android\app\.cxx -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force android\build -ErrorAction SilentlyContinue
}

# -----------------------------
# Enter android safely
# -----------------------------
$pushed = $false
if ((Split-Path -Leaf (Get-Location)) -ne "android")
{
    Push-Location android
    $pushed = $true
}

Write-Host "Running full Android release build..." -ForegroundColor Cyan

# Kill processes
Get-Process node, watchman -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process emulator, qemu-system-x86_64, qemu-system-i386 -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process adb -ErrorAction SilentlyContinue | Stop-Process -Force

adb kill-server | Out-Null
Start-Sleep 2
adb start-server | Out-Null

# Remove local android artifacts
Remove-Item -Recurse -Force .\app\build, .\app\.cxx -ErrorAction SilentlyContinue

# Codegen
.\gradlew.bat :app:generateCodegenArtifactsFromSchema

# IMPORTANT — ONE LINE gradlew
.\gradlew.bat clean :app:externalNativeBuildCleanRelease assembleRelease bundleRelease -P"reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" --no-configuration-cache --stacktrace

# Return only if we pushed
if ($pushed)
{
    Pop-Location
}

Write-Host "== BUILD FINISHED ==" -ForegroundColor Green
