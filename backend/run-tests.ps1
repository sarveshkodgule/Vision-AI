# Run this script from PowerShell instead of using unittest discovery directly.
# It configures the process before NumPy, OpenBLAS, PyTorch, or ONNX Runtime load.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $env:JWT_SECRET_KEY) {
    $env:JWT_SECRET_KEY = 'local-test-secret-that-is-at-least-32-chars'
}
if (-not $env:HOSPITAL_DOCTOR_CODE) {
    $env:HOSPITAL_DOCTOR_CODE = 'local-doc-code'
}

# Keep the full suite within the memory available on developer machines.
$env:PALM_DEVICE = 'cpu'
$env:CUDA_VISIBLE_DEVICES = '-1'
$env:OPENBLAS_NUM_THREADS = '1'
$env:OMP_NUM_THREADS = '1'
$env:MKL_NUM_THREADS = '1'
$env:NUMEXPR_NUM_THREADS = '1'

# Python libraries can emit warnings on stderr.  Keep PowerShell from treating
# those warnings as terminating errors when a caller captures this script's
# output, while preserving unittest's real exit code.
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$pythonExecutable = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
$testExitCode = 1
if (-not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
    Write-Error "Virtual-environment Python interpreter was not found: $pythonExecutable"
} else {
    try {
        & $pythonExecutable -m unittest discover -s tests -p 'test_*.py' -v
        if ($null -ne $LASTEXITCODE) {
            $testExitCode = $LASTEXITCODE
        }
    } catch {
        Write-Error "Unable to launch virtual-environment Python: $_"
    }
}
$ErrorActionPreference = $previousErrorActionPreference
exit $testExitCode
