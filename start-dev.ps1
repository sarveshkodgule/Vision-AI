$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$pythonPath = Join-Path $projectRoot 'backend\venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Create backend\venv and install backend/requirements.txt and ml/inference_service/requirements.txt first.'
}
$processes = @()
try {
    $processes += Start-Process -FilePath $pythonPath -ArgumentList '-m uvicorn main:app --host 127.0.0.1 --port 8000' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru
    $processes += Start-Process -FilePath $pythonPath -ArgumentList '-m uvicorn ml.inference_service.main:app --host 127.0.0.1 --port 8001' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Write-Host 'Backend: http://127.0.0.1:8000/docs | Image service: http://127.0.0.1:8001/health'
    Write-Host 'Press Ctrl+C to stop development services.'
    Push-Location (Join-Path $projectRoot 'Frontend')
    try { npm.cmd run dev -- --host 127.0.0.1 } finally { Pop-Location }
} finally {
    foreach ($process in $processes) {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id }
    }
}
