param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
foreach ($tool in @('python', 'node', 'npm', 'dotnet')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool bulunamadi. README kurulum adimlarini kontrol et." }
}
if (-not ((dotnet --list-sdks) -match '^10\.')) { throw '.NET 10 SDK gerekli.' }
foreach ($port in @(9280, 9281)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "$port portu kullanimda. Mevcut TraceLens penceresini kontrol et." }
}
if (-not $SkipInstall) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci basarisiz.' }
    & dotnet build api -c Release
    if ($LASTEXITCODE -ne 0) { throw 'API derlemesi basarisiz.' }
}
$runtime = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$env:ASPNETCORE_URLS = 'http://127.0.0.1:9281'
$env:DataPath = Join-Path $runtime 'local'
$env:PythonPath = (Get-Command python).Source
$apiProcess = Start-Process -FilePath (Get-Command dotnet).Source -ArgumentList 'api/bin/Release/net10.0/TraceLens.Api.dll' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'api.log') -RedirectStandardError (Join-Path $runtime 'api-error.log')
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:9281/health' -TimeoutSec 1; $ready = $true; break } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'API baslamadi; .runtime/api-error.log dosyasini kontrol et.' }
    Write-Host 'TraceLens: http://127.0.0.1:9280/  (Bu pencereyi acik tut. Durdurmak icin Ctrl+C.)'
    & npm.cmd run dev
} finally {
    if (-not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue }
}
