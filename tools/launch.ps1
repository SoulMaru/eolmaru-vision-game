param([switch]$NoBrowser, [ValidateRange(1024,65535)][int]$Port = 8765)
$ErrorActionPreference = 'Stop'
# A launcher started by another PowerShell version or Node must use its own built-in modules.
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + [IO.Path]::PathSeparator + $env:PSModulePath
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$serverPath = Join-Path $PSScriptRoot 'server.mjs'
$gameUrl = "http://127.0.0.1:$Port"
$expectedHash = (Get-FileHash -LiteralPath $serverPath -Algorithm SHA256).Hash.ToLowerInvariant()
function Read-Identity {
    try { Invoke-RestMethod -Uri "$gameUrl/__eolmaru" -TimeoutSec 2 } catch { $null }
}
function Same-Root($identity) {
    $identity -and $identity.appId -eq 'eolmaru-vision' -and $identity.root -eq $projectRoot
}
try {
    $identity = Read-Identity
    $reused = (Same-Root $identity) -and $identity.serverHash -eq $expectedHash
    $restarted = $false
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener -and -not $reused) {
        # Prove this checkout owns the existing server before stopping even an older launcher.
        $nonce = [Guid]::NewGuid().ToString('N')
        $proofName = "launch-proof-$nonce.json"
        $proofPath = Join-Path $projectRoot "public\$proofName"
        $proven = $false
        try {
            [IO.File]::WriteAllText($proofPath, ('{"nonce":"' + $nonce + '"}'), (New-Object Text.UTF8Encoding($false)))
            $proof = Invoke-RestMethod -Uri "$gameUrl/$proofName" -TimeoutSec 2
            $proven = $proof.nonce -eq $nonce
        } catch { $proven = $false }
        finally { if (Test-Path -LiteralPath $proofPath) { Remove-Item -LiteralPath $proofPath } }
        if (-not $proven) { throw "포트 $Port 를 다른 프로그램 또는 다른 게임 폴더가 사용하고 있습니다. 해당 프로그램을 닫고 다시 실행해 주세요." }
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if ($owner.Name -ne 'node.exe' -or $owner.CommandLine -notmatch 'tools[\\/]server\.mjs') {
            throw '실행 중인 서버의 소유를 확인하지 못했습니다. 서버를 직접 종료한 뒤 다시 실행해 주세요.'
        }
        Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
        $restarted = $true
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Milliseconds 100
        }
    }
    if (-not $reused) {
        $nodePath = (Get-Command node -ErrorAction Stop).Source
        $previousPort = $env:PORT
        try {
            $env:PORT = [string]$Port
            Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
        } finally { $env:PORT = $previousPort }
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $identity = Read-Identity
        if ((Same-Root $identity) -and $identity.serverHash -eq $expectedHash) { $ready = $true; break }
        Start-Sleep -Milliseconds 150
    }
    if (-not $ready) { throw '최신 게임 서버를 실행하지 못했습니다. Node.js 설치와 포트 사용 상태를 확인해 주세요.' }
    $version = (Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
    $freshUrl = "$gameUrl/?version=$version&launch=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    if (-not $NoBrowser) { Start-Process $freshUrl }
    [pscustomobject]@{ Url = $freshUrl; Root = $projectRoot; Version = $version; Reused = $reused; Restarted = $restarted }
} catch {
    if (-not $NoBrowser) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '얼마루 비전 실행 안내') | Out-Null
    }
    throw
}
