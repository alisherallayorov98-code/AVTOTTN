@echo off
cd /d "%~dp0"
title 1Uz-to-Didox ETTN Excel Splitter

echo =============================================================
echo     1Uz-to-Didox ETTN Excel Splitter Ishga Tushirish
echo =============================================================
echo.

:: 1. Node.exe ni topish
if exist "node.exe" (
    set NODE_RUN=.\node.exe
    set NODE_PATH=%~dp0node-v20.11.1-win-x64;%~dp0
    echo [OK] Portativ Node.js topildi.
) else (
    where node >nul 2>nul
    if %errorlevel% neq 0 (
        echo [XATOLIK] Node.js topilmadi!
        pause
        exit /b 1
    )
    set NODE_RUN=node
    echo [OK] Tizimdagi Node.js ishlatiladi.
)

:: 2. Ish stolida yorliq yaratish
set SHORTCUT_PATH="%USERPROFILE%\Desktop\1Uz-to-Didox ETTN.lnk"
if not exist %SHORTCUT_PATH% (
    echo [TIZIM] Ish stolida yorliq yaratilmoqda...
    powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(%SHORTCUT_PATH%); $s.TargetPath = '%~dp0run.bat'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = 'shell32.dll,9'; $s.Save()" 2>nul
)

:: 3. Kutubxonalarni tekshirish
if not exist "node_modules" (
    echo [TIZIM] Kutubxonalar o'rnatilmoqda...
    %NODE_RUN% install-npm-deps.js
    if %errorlevel% neq 0 (
        echo [XATOLIK] Kutubxonalarni o'rnatishda xatolik!
        pause
        exit /b 1
    )
)

:: 4. Backend TypeScript -> JavaScript kompilyatsiya qilish
echo [TIZIM] Backend kompilyatsiya qilinmoqda...
set PATH=%~dp0node-v20.11.1-win-x64;%~dp0;%PATH%
.\node_modules\.bin\tsc.cmd
if %errorlevel% neq 0 (
    echo [XATOLIK] Backend kompilyatsiyada xatolik!
    pause
    exit /b 1
)
echo [OK] Backend tayyor.

:: 5. Frontend build
echo [TIZIM] Frontend tayyorlanmoqda...
if not exist "frontend\dist\index.html" (
    cd frontend
    ..\node_modules\.bin\npm.cmd run build 2>nul
    if %errorlevel% neq 0 (
        call "%~dp0node-v20.11.1-win-x64\npm.cmd" run build
    )
    cd ..
)
echo [OK] Frontend tayyor.

:: 6. Electron ishga tushirish
echo [TIZIM] Ilova ochilmoqda...
.\node_modules\.bin\electron.cmd .

if %errorlevel% neq 0 (
    echo.
    echo [XATOLIK] Ilovani ishga tushirishda xatolik yuz berdi.
    pause
)
