param([string]$EngineRoot = 'C:\SoulmaruAI\얼마루', [int]$Port = 8013)
$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
$voicePython = Join-Path $EngineRoot 'runtime\voice-env\Scripts\python.exe'
$designPath = Join-Path $EngineRoot 'models\qwen3-tts\VoiceDesign'
$adapterPath = Join-Path $PSScriptRoot 'voice-local-server.py'
if (!(Test-Path -LiteralPath $voicePython) -or !(Test-Path -LiteralPath (Join-Path $designPath 'config.json'))) {
    throw 'The existing local voice environment and VoiceDesign model are required. This tool never downloads models.'
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Choose a free -Port; no existing engine will be stopped."
}
$logDir = Join-Path $gameRoot 'test-results\voice-build'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$env:PYTHONUTF8='1'; $env:PYTHONIOENCODING='utf-8'; $env:PYTHONUNBUFFERED='1'
$env:HF_HUB_OFFLINE='1'; $env:TRANSFORMERS_OFFLINE='1'; $env:CUDA_VISIBLE_DEVICES='-1'
$env:EOLMARU_TTS_THREADS='6'; $env:OMP_NUM_THREADS='6'; $env:MKL_NUM_THREADS='6'
$env:EOLMARU_TTS_PORT=[string]$Port
$env:EOLMARU_TTS_MODEL=Join-Path $EngineRoot 'models\qwen3-tts\CustomVoice'
$env:EOLMARU_TTS_DESIGN=$designPath
$env:MARU_VOICE_URL="http://127.0.0.1:$Port"
$process = Start-Process -FilePath $voicePython -ArgumentList @('-B', ('"' + $adapterPath + '"')) -WorkingDirectory $gameRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-errors.log')
$ownedListener = $null
try {
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        $candidate = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($candidate) {
            $info = Get-CimInstance Win32_Process -Filter "ProcessId = $($candidate.OwningProcess)"
            # The venv launcher may spawn another Python process. Verify the exact
            # project adapter before owning or later stopping the listening PID.
            if (!$info.CommandLine.Contains($adapterPath)) { throw 'The listening process is not the project voice adapter.' }
            $ownedListener = $candidate.OwningProcess
            break
        }
        if ($process.HasExited) { throw 'The local voice server exited; inspect test-results/voice-build/server-errors.log.' }
        Start-Sleep -Milliseconds 500
    }
    if (!$ownedListener) { throw 'The voice server did not start.' }
    Push-Location $gameRoot
    try { node tools/voice-expressive.mjs; if ($LASTEXITCODE -ne 0) { throw 'Voice generation failed; existing published coach files were retained.' } }
    finally { Pop-Location }
}
finally {
    if ($ownedListener) {
        $info = Get-CimInstance Win32_Process -Filter "ProcessId = $ownedListener" -ErrorAction SilentlyContinue
        if ($info -and $info.CommandLine.Contains($adapterPath)) { Stop-Process -Id $ownedListener -ErrorAction SilentlyContinue }
    }
    if (!$process.HasExited) { $process.Kill() }
}
