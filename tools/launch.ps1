$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$gameUrl = 'http://127.0.0.1:8765'
$alreadyRunning = $false
try {
    $response = Invoke-WebRequest -Uri $gameUrl -TimeoutSec 2 -UseBasicParsing
    if ($response.Content -match 'EOLMARU VISION') { $alreadyRunning = $true }
    else { throw 'Port 8765 is used by another application. Close it or use npm start with PORT.' }
} catch {
    if ($_.Exception.Message -like '*another application*') { throw }
}
if (-not $alreadyRunning) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $serverPath = Join-Path $PSScriptRoot 'server.mjs'
    Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $null = Invoke-WebRequest -Uri $gameUrl -TimeoutSec 1 -UseBasicParsing; break } catch { Start-Sleep -Milliseconds 150 }
    }
}
Start-Process $gameUrl
Write-Host '얼마루 비전게임을 열었습니다. 카메라는 게임에서 켜 주세요.'
