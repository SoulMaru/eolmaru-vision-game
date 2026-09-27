param([string]$RequestFile, [switch]$List)

# Portable, project-owned adapter for the installed Windows speech engine.
# F-drive generation uses the existing production script instead of this file.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$speaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    if ($List) {
        $available = @($speaker.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
            [ordered]@{ id = $_.VoiceInfo.Name; language = $_.VoiceInfo.Culture.Name }
        })
        ConvertTo-Json -InputObject $available -Compress
        return
    }
    $cue = Get-Content -LiteralPath $RequestFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $cue.text -or -not $cue.output -or -not $cue.voice) {
        throw 'The request must include text, output and voice.'
    }
    $speaker.SelectVoice([string]$cue.voice)
    $speaker.Rate = [Math]::Max(-10, [Math]::Min(10, [int]$cue.rate))
    $speaker.Volume = [Math]::Max(0, [Math]::Min(100, [int]$cue.volume))
    $speaker.SetOutputToWaveFile([string]$cue.output)
    $speaker.Speak([string]$cue.text)
    $speaker.SetOutputToNull()
}
finally {
    $speaker.Dispose()
}
