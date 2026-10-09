@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js o usa el servidor Python indicado en DRONE_PROTOTYPE.md.
  pause
  exit /b 1
)
echo Abre http://localhost:8766 en tu navegador.
echo Deja esta ventana abierta mientras pruebas el dron. Ctrl+C detiene el servidor.
node serve.mjs
pause
