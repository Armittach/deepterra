@echo off
cd /d "%~dp0"
set HOST=0.0.0.0
set PORT=8777
echo DeepTerra para dispositivos de tu red local, puerto 8777.
echo Usa la IP de este PC en el navegador del celular, conectado al mismo router.
node serve.mjs
pause
