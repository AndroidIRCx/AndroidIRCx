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

# Remove local android artifacts. The barcode scanner patch moves CMake staging
# under android/build/short-cxx, so clear it before Gradle clean can reconfigure
# stale native build trees with old prefab paths.
Remove-Item -Recurse -Force .\app\build, .\app\.cxx, .\build\short-cxx -ErrorAction SilentlyContinue

# Clean BEFORE codegen so codegen-generated files don't race the per-module clean
# tasks (Windows DefaultDeleter errors with "New files were found" otherwise).
.\gradlew.bat clean :app:externalNativeBuildCleanRelease --no-configuration-cache --stacktrace
if ($LASTEXITCODE -ne 0) { throw "Gradle clean failed (exit $LASTEXITCODE)" }

# Codegen
.\gradlew.bat :app:generateCodegenArtifactsFromSchema
if ($LASTEXITCODE -ne 0) { throw "Codegen failed (exit $LASTEXITCODE)" }

# Build
.\gradlew.bat assembleRelease bundleRelease -P"reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" --no-configuration-cache --stacktrace
if ($LASTEXITCODE -ne 0) { throw "Release build failed (exit $LASTEXITCODE)" }

$verifyScript = Join-Path $projectRoot "scripts\verify-android-native-libs.ps1"
$releaseArtifacts = @(
    ".\app\build\outputs\apk\release\app-release.apk",
    ".\app\build\outputs\bundle\release\app-release.aab"
)

foreach ($artifact in $releaseArtifacts)
{
    if (Test-Path $artifact)
    {
        Write-Host "Verifying native libraries in $artifact..." -ForegroundColor Cyan
        powershell -NoProfile -ExecutionPolicy Bypass -File $verifyScript -ArtifactPath $artifact
        if ($LASTEXITCODE -ne 0)
        {
            throw "Native library verification failed for $artifact"
        }
    }
}

# Return only if we pushed
if ($pushed)
{
    Pop-Location
}

Write-Host "== BUILD FINISHED ==" -ForegroundColor Green
