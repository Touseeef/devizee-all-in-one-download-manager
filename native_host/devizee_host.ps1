$stdin = [System.Console]::OpenStandardInput()
$stdout = [System.Console]::OpenStandardOutput()

# Read 4-byte length
$lenBytes = New-Object byte[] 4
$bytesRead = $stdin.Read($lenBytes, 0, 4)
if ($bytesRead -lt 4) { exit 0 }

$length = [System.BitConverter]::ToInt32($lenBytes, 0)
if ($length -le 0 -or $length -gt 1048576) { exit 0 }

# Read JSON payload
$buffer = New-Object byte[] $length
$totalRead = 0
while ($totalRead -lt $length) {
    $read = $stdin.Read($buffer, $totalRead, $length - $totalRead)
    if ($read -le 0) { break }
    $totalRead += $read
}

$jsonText = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $totalRead)
$payload = $null
try {
    $payload = $jsonText | ConvertFrom-Json
} catch {
    exit 0
}

# Handle URL dispatch
if ($payload.url) {
    $url = $payload.url
    # 1. Attempt to launch or signal the Tauri binary
    $devizeeExe = Join-Path $PSScriptRoot "..\src-tauri\target\debug\devizee-all-in-one-download-manager.exe"
    $devizeeRelease = Join-Path $PSScriptRoot "..\src-tauri\target\release\devizee-all-in-one-download-manager.exe"

    if (Test-Path $devizeeExe) {
        Start-Process -FilePath $devizeeExe -ArgumentList @("--url", $url)
    } elseif (Test-Path $devizeeRelease) {
        Start-Process -FilePath $devizeeRelease -ArgumentList @("--url", $url)
    } else {
        # Fallback to protocol scheme
        $deepLink = "streamgrab://download?url=" + [System.Uri]::EscapeDataString($url)
        Start-Process $deepLink
    }
}

# Write response {"status":"ok"}
$responseJson = '{"status":"ok"}'
$respBytes = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
$respLenBytes = [System.BitConverter]::GetBytes([int]$respBytes.Length)

$stdout.Write($respLenBytes, 0, 4)
$stdout.Write($respBytes, 0, $respBytes.Length)
$stdout.Flush()
