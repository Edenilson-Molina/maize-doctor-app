@echo off
echo ========================================================
echo   Compilando Manual de Usuario - Doctor Maiz (LaTeX)
echo ========================================================
cd /d "%~dp0"

echo [1/2] Ejecutando primera pasada de pdflatex...
pdflatex -interaction=nonstopmode -halt-on-error manual_usuario.tex
if %errorlevel% neq 0 (
    echo [ERROR] Fallo en la primera pasada de compilacion.
    pause
    exit /b %errorlevel%
)

echo [2/2] Ejecutando segunda pasada para actualizar indice y referencias...
pdflatex -interaction=nonstopmode -halt-on-error manual_usuario.tex
if %errorlevel% neq 0 (
    echo [ERROR] Fallo en la segunda pasada de compilacion.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   Compilacion exitosa: manual_usuario.pdf generado.
echo ========================================================
if exist manual_usuario.pdf (
    echo Archivo listo en: %~dp0manual_usuario.pdf
)
pause
