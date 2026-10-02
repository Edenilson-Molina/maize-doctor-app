<#
.SYNOPSIS
    Script de compilación para el Manual de Usuario en LaTeX de Doctor Maíz.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Compilando Manual de Usuario - Doctor Maíz (LaTeX)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

if (-not (Get-Command pdflatex -ErrorAction SilentlyContinue)) {
    Write-Error "No se encontró 'pdflatex' en el PATH del sistema. Asegúrese de tener instalado MiKTeX o TeX Live."
    exit 1
}

Write-Host "`n[1/2] Ejecutando primera pasada de pdflatex..." -ForegroundColor Cyan
& pdflatex -interaction=nonstopmode -halt-on-error manual_usuario.tex
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error en la primera pasada de compilación."
    exit $LASTEXITCODE
}

Write-Host "`n[2/2] Ejecutando segunda pasada (índices y referencias cruzadas)..." -ForegroundColor Cyan
& pdflatex -interaction=nonstopmode -halt-on-error manual_usuario.tex
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error en la segunda pasada de compilación."
    exit $LASTEXITCODE
}

$PdfPath = Join-Path $ScriptDir "manual_usuario.pdf"
if (Test-Path $PdfPath) {
    $PdfSize = (Get-Item $PdfPath).Length / 1MB
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host ("  Manual generado exitosamente: {0:N2} MB" -f $PdfSize) -ForegroundColor Green
    Write-Host "  Ruta: $PdfPath" -ForegroundColor Yellow
    Write-Host "========================================================" -ForegroundColor Green
}
