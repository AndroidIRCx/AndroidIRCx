param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [string[]]$Architectures = @(
        "armeabi-v7a",
        "arm64-v8a",
        "x86",
        "x86_64"
    ),

    [string[]]$Libraries = @(
        "libreactnative.so",
        "libhermesvm.so",
        "libc++_shared.so",
        "libfbjni.so",
        "libjsi.so"
    )
)

$resolvedArtifact = Resolve-Path -LiteralPath $ArtifactPath -ErrorAction Stop

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedArtifact.Path)
try {
    $entryNames = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::Ordinal
    )

    foreach ($entry in $zip.Entries) {
        [void]$entryNames.Add($entry.FullName)
    }

    $missing = New-Object System.Collections.Generic.List[string]

    foreach ($abi in $Architectures) {
        foreach ($library in $Libraries) {
            $apkEntry = "lib/$abi/$library"
            $aabEntry = "base/lib/$abi/$library"

            if (-not ($entryNames.Contains($apkEntry) -or $entryNames.Contains($aabEntry))) {
                $missing.Add("$abi/$library")
            }
        }
    }

    if ($missing.Count -gt 0) {
        Write-Error "Missing native libraries in $($resolvedArtifact.Path): $($missing -join ', ')"
        exit 1
    }

    Write-Output "Native library check passed for $($resolvedArtifact.Path)"
} finally {
    $zip.Dispose()
}
