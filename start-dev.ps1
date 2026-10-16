$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$pythonPath = Join-Path $projectRoot 'backend\venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    Write-Host "Backend virtual environment not found at backend\venv\Scripts\python.exe" -ForegroundColor Red
    Write-Host "Please set up the virtual environment first." -ForegroundColor Yellow
    exit 1
}

$npmCmd = if (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }

$processes = @()
try {
    Write-Host "Starting Backend API on http://127.0.0.1:8000..." -ForegroundColor Cyan
    $processes += Start-Process -FilePath $pythonPath -ArgumentList '-m uvicorn main:app --host 127.0.0.1 --port 8000' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru

    Write-Host "Starting ML Model Service on http://127.0.0.1:8001..." -ForegroundColor Cyan
    $processes += Start-Process -FilePath $pythonPath -ArgumentList '-m uvicorn ml.inference_service.main:app --host 127.0.0.1 --port 8001' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

    Start-Sleep -Seconds 2

    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "   Shri Sarveshwar Netralaya - Healthcare System      " -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "  * Backend API:       http://127.0.0.1:8000/docs" -ForegroundColor Yellow
    Write-Host "  * ML Inference:      http://127.0.0.1:8001/health" -ForegroundColor Yellow
    Write-Host "  * Frontend UI:       http://localhost:5173" -ForegroundColor Yellow
    Write-Host "  Press Ctrl+C anytime to stop all development services." -ForegroundColor White
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""

    Push-Location (Join-Path $projectRoot 'Frontend')
    try {
        & $npmCmd run dev -- --host 127.0.0.1
    } finally {
        Pop-Location
    }
} finally {
    Write-Host "`nStopping background services..." -ForegroundColor Magenta
    foreach ($process in $processes) {
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "All services stopped." -ForegroundColor Green
}

