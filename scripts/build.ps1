param(
    [switch]$Clean,
    [switch]$AabOnly,
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
    Write-Host "  ./scripts/build.ps1           -> build, reusing what is already compiled"
    Write-Host "  ./scripts/build.ps1 -Clean    -> wipe everything first, then build"
    Write-Host "  ./scripts/build.ps1 -Clean -AabOnly -> full clean + AAB only"
    Write-Host "  ./scripts/build.ps1 -Help     -> show this help"
    Write-Host ""
    Write-Host "Either way it first clears what a debug session leaves behind:" -ForegroundColor Yellow
    Write-Host "  Metro, watchman, emulators, adb and any running Gradle daemon."
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
# TOOLCHAIN CHECK (fail in a second, not in twenty minutes)
# -----------------------------
# AGP 9 / Gradle 9 reject JDK 8 outright, and JDK 25 - which is what JetBrains
# ships inside the IDE - is too new for them. Both failures surface deep inside
# a native build as something that reads like a compiler problem, so check here
# where the answer is one line long.
$javaExe = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { "java" }
try
{
    $javaVersionLine = (& $javaExe -version 2>&1 | Select-Object -First 1) -as [string]
}
catch
{
    throw "Could not run java. Set JAVA_HOME to a JDK 17 installation."
}
# `-match` rather than `-notmatch`: only the former reliably populates $Matches.
if ($javaVersionLine -match '"(\d+)')
{
    $javaMajor = [int]$Matches[1]
}
else
{
    throw "Could not read the Java version from: $javaVersionLine"
}
if ($javaMajor -lt 17 -or $javaMajor -gt 21)
{
    throw "This build needs JDK 17 (17-21 tolerated), found JDK $javaMajor. Set JAVA_HOME, e.g. `$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17...'"
}
Write-Host "Using JDK $javaMajor" -ForegroundColor DarkGray

Write-Host "Applying package patches..." -ForegroundColor Cyan

# `yarn postinstall` only runs patch-package, and yarn is not necessarily on
# PATH. Worse, when a command does not exist PowerShell raises its own error
# WITHOUT setting $LASTEXITCODE, so the old guard read a stale value from the
# previous command: it let the failure through on one run and aborted a
# perfectly healthy build on the next. Invoking the binary by path keeps
# $LASTEXITCODE meaningful.
$patchPackage = Join-Path $projectRoot "node_modules\.bin\patch-package.cmd"
if (-not (Test-Path $patchPackage))
{
    throw "patch-package not found at $patchPackage - install dependencies first (npm install or yarn install)"
}

& $patchPackage
if ($LASTEXITCODE -ne 0) { throw "patch-package failed (exit $LASTEXITCODE)" }

# -----------------------------
# Enter android safely
# -----------------------------
# Wrapped in try/finally from here on: a build that throws used to leave the
# shell sitting in android\, so the next command in the same window ran from
# the wrong directory.
$pushed = $false
if ((Split-Path -Leaf (Get-Location)) -ne "android")
{
    Push-Location android
    $pushed = $true
}

try
{
    # -----------------------------
    # CLEAR DEBUG LEFTOVERS
    # -----------------------------
    # Everything a debug session leaves running and that a release build trips
    # over: Metro serving a stale bundle, watchman holding file handles, an
    # emulator pinning native libraries, adb keeping a device attached.
    function Stop-Leftover([string[]] $names, [string] $what)
    {
        $found = Get-Process -Name $names -ErrorAction SilentlyContinue
        if (-not $found) { return }
        Write-Host "  $what ($($found.Count))" -ForegroundColor DarkGray
        $found | Stop-Process -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Clearing debug leftovers..." -ForegroundColor Cyan
    Stop-Leftover @('node', 'watchman') 'Metro / watchman'
    Stop-Leftover @('emulator', 'qemu-system-x86_64', 'qemu-system-i386') 'emulators'
    # adb is stopped and deliberately NOT restarted. A release build never
    # talks to a device, and the server used to be started right here - where
    # it inherited this script's stdout handle and held the pipe open for
    # whatever ran the script, which is why the old version had to kill it
    # again at the end.
    Stop-Leftover @('adb') 'adb'

    # Gradle daemons are stopped through Gradle, never killed. This line used
    # to be `Get-Process java | Stop-Process -Force`, which took down every JVM
    # on the machine - Android Studio, any unrelated Java program, and daemons
    # mid-shutdown, leaving a stale entry in the daemon registry. `--stop` uses
    # Gradle's own protocol, so what is left behind is consistent.
    Write-Host "  Gradle daemons" -ForegroundColor DarkGray
    .\gradlew.bat --stop | Out-Null

    # -----------------------------
    # OPTIONAL CLEAN
    # -----------------------------
    # Only when asked. The old script always deleted these and always ran
    # `gradlew clean`, so `-Clean` changed nothing and an incremental build was
    # impossible - every run paid for a full native rebuild, including a rerun
    # after an interrupted build.
    if ($Clean)
    {
        Write-Host "Cleaning previous builds..." -ForegroundColor Yellow

        # The barcode scanner patch stages CMake under android\build\short-cxx,
        # so that has to go before Gradle's own clean, or the per-module native
        # trees are reconfigured with stale prefab paths.
        Remove-Item -Recurse -Force .\app\.cxx, .\app\build, .\build -ErrorAction SilentlyContinue

        # Clean BEFORE codegen so codegen-generated files don't race the
        # per-module clean tasks (Windows DefaultDeleter otherwise errors with
        # "New files were found").
        .\gradlew.bat clean :app:externalNativeBuildCleanRelease --no-configuration-cache --stacktrace
        if ($LASTEXITCODE -ne 0) { throw "Gradle clean failed (exit $LASTEXITCODE)" }
    }
    else
    {
        Write-Host "Incremental build - pass -Clean to wipe first." -ForegroundColor DarkGray
    }

    # -----------------------------
    # CODEGEN
    # -----------------------------
    .\gradlew.bat :app:generateCodegenArtifactsFromSchema
    if ($LASTEXITCODE -ne 0) { throw "Codegen failed (exit $LASTEXITCODE)" }

    # -----------------------------
    # BUILD
    # -----------------------------
    Write-Host "Running Android release build..." -ForegroundColor Cyan
    $architectures = "armeabi-v7a,arm64-v8a,x86,x86_64"
    if ($AabOnly)
    {
        .\gradlew.bat bundleRelease -P"reactNativeArchitectures=$architectures" --no-configuration-cache --stacktrace
    }
    else
    {
        .\gradlew.bat assembleRelease bundleRelease -P"reactNativeArchitectures=$architectures" --no-configuration-cache --stacktrace
    }
    if ($LASTEXITCODE -ne 0) { throw "Release build failed (exit $LASTEXITCODE)" }

    # -----------------------------
    # VERIFY
    # -----------------------------
    $verifyScript = Join-Path $projectRoot "scripts\verify-android-native-libs.ps1"
    if ($AabOnly)
    {
        $releaseArtifacts = @(".\app\build\outputs\bundle\release\app-release.aab")
    }
    else
    {
        $releaseArtifacts = @(
            ".\app\build\outputs\apk\release\app-release.apk",
            ".\app\build\outputs\bundle\release\app-release.aab"
        )
    }

    foreach ($artifact in $releaseArtifacts)
    {
        if (-not (Test-Path $artifact))
        {
            throw "Expected release artifact not found: $artifact"
        }

        Write-Host "Verifying native libraries in $artifact..." -ForegroundColor Cyan
        powershell -NoProfile -ExecutionPolicy Bypass -File $verifyScript -ArtifactPath $artifact
        if ($LASTEXITCODE -ne 0)
        {
            throw "Native library verification failed for $artifact"
        }
    }
}
finally
{
    if ($pushed)
    {
        Pop-Location
    }
}

Write-Host "== BUILD FINISHED ==" -ForegroundColor Green
