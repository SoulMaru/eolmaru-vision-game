param([string]$DesktopPath = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + [IO.Path]::PathSeparator + $env:PSModulePath
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot 'launch.ps1'
$iconPath = Join-Path $projectRoot 'public\assets\eolmaru-vision.ico'
foreach ($required in @($DesktopPath, $launcherPath, $iconPath)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "경로를 찾지 못했습니다: $required" }
}
$shortcutPath = Join-Path $DesktopPath '얼마루 비전.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if ((Test-Path -LiteralPath $shortcutPath) -and $shortcut.Arguments -notlike ('*' + $launcherPath + '*')) {
    throw '같은 이름의 다른 바로가기가 있습니다. 기존 바로가기를 보존하고 설치를 중단했습니다.'
}
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcherPath + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = $iconPath + ',0'
$shortcut.Description = '얼마루 비전 — 이 프로젝트 폴더의 최신 게임을 실행합니다.'
$shortcut.WindowStyle = 7
$shortcut.Save()
[pscustomobject]@{ Shortcut = $shortcutPath; Launcher = $launcherPath; Icon = $iconPath }
