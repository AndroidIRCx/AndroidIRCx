param(
  [string]$ImageName = "androidircx-release",
  [string]$ContainerName = "androidircx-local",
  [string]$SecretsDir = "secrets",
  [string]$ArtifactsDir = "artifacts",
  [switch]$SkipImageBuild
)

$ErrorActionPreference = "Stop"

function Read-KeyValueFile {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $map
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()
    if ($key) {
      $map[$key] = $value
    }
  }

  return $map
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedSecretsDir = Resolve-Path (Join-Path $projectRoot $SecretsDir)
$resolvedArtifactsDir = Join-Path $projectRoot $ArtifactsDir

Write-Host "Project root: $projectRoot"
Write-Host "Secrets dir:  $resolvedSecretsDir"
Write-Host "Artifacts:    $resolvedArtifactsDir"

$gradleProps = Read-KeyValueFile -Path (Join-Path $resolvedSecretsDir "gradle.properties")

$storeFile = $gradleProps["MYAPP_UPLOAD_STORE_FILE"]
if (-not $storeFile) {
  $storeFile = "my-upload-key.keystore"
}

$keystorePath = Join-Path $resolvedSecretsDir $storeFile
if (-not (Test-Path -LiteralPath $keystorePath)) {
  throw "Keystore not found: $keystorePath"
}

$googleServicesPath = Join-Path $resolvedSecretsDir "google-services.json"
if (-not (Test-Path -LiteralPath $googleServicesPath)) {
  throw "Missing file: $googleServicesPath"
}

$playServicePath = Join-Path $resolvedSecretsDir "play-service-account.json"
if (-not (Test-Path -LiteralPath $playServicePath)) {
  $candidate = Get-ChildItem -LiteralPath $resolvedSecretsDir -File -Filter "*.json" |
    Where-Object { $_.Name -ne "google-services.json" -and $_.Length -gt 0 } |
    Sort-Object Length |
    Select-Object -First 1
  if ($candidate) {
    $playServicePath = $candidate.FullName
  }
}

$env:ANDROID_KEYSTORE_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystorePath))
$env:ANDROID_KEYSTORE_PASSWORD = $gradleProps["MYAPP_UPLOAD_STORE_PASSWORD"]
$env:ANDROID_KEY_ALIAS = $gradleProps["MYAPP_UPLOAD_KEY_ALIAS"]
$env:ANDROID_KEY_PASSWORD = $gradleProps["MYAPP_UPLOAD_KEY_PASSWORD"]
$env:GOOGLE_SERVICES_JSON = Get-Content -LiteralPath $googleServicesPath -Raw

if (Test-Path -LiteralPath $playServicePath) {
  $env:PLAY_SERVICE_ACCOUNT_JSON = Get-Content -LiteralPath $playServicePath -Raw
}

Push-Location $projectRoot
try {
  if (-not $SkipImageBuild) {
    Write-Host "Building Docker image: $ImageName"
    docker build -t $ImageName .
    if ($LASTEXITCODE -ne 0) {
      throw "docker build failed"
    }
  }

  $existing = docker ps -a --filter "name=^$ContainerName$" --format "{{.Names}}"
  if ($existing -eq $ContainerName) {
    docker rm -f $ContainerName | Out-Null
  }

  Write-Host "Creating container: $ContainerName"
  docker create --name $ContainerName `
    -e ANDROID_KEYSTORE_BASE64 `
    -e ANDROID_KEYSTORE_PASSWORD `
    -e ANDROID_KEY_ALIAS `
    -e ANDROID_KEY_PASSWORD `
    -e GOOGLE_SERVICES_JSON `
    -e PLAY_SERVICE_ACCOUNT_JSON `
    $ImageName | Out-Null

  Write-Host "Starting Android release build in Docker..."
  docker start -a $ContainerName
  if ($LASTEXITCODE -ne 0) {
    throw "docker run failed"
  }

  New-Item -ItemType Directory -Force -Path $resolvedArtifactsDir | Out-Null
  Write-Host "Copying artifacts..."
  docker cp "${ContainerName}:/app/android/app/build/outputs" (Join-Path $resolvedArtifactsDir "outputs")
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy build outputs"
  }

  Write-Host ""
  Write-Host "Build complete."
  Write-Host "Artifacts: $(Join-Path $resolvedArtifactsDir "outputs")"
}
finally {
  docker rm -f $ContainerName | Out-Null
  Pop-Location
}
