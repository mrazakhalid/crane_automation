@echo off
REM ============================================================================
REM  Crane Automation - desktop build menu
REM
REM  Builds the offline desktop app from the two web apps (frontend + backend).
REM  Stays open and keeps listening for the next option until you choose Exit.
REM  Launched by tools\launch-terminals.ps1 in its own VS Code terminal.
REM ============================================================================
setlocal EnableExtensions
REM tools\ -> repo root, so all paths below are relative to the project root.
cd /d "%~dp0.."
set "ROOT=%CD%"

:menu
cls
echo ============================================================
echo   CRANE AUTOMATION  -  Desktop Build Menu
echo   Root: %ROOT%
echo ============================================================
echo.
echo   [1] Full offline build   (FE build + BE build + installer)
echo         cd desktop ^&^& npm run bundle   -^> desktop\release\*.exe
echo.
echo   [2] Build frontend only  (tsc -b ^&^& vite build)
echo   [3] Build backend only   (tsc)
echo   [4] Run desktop app      (electron .  - dev shell)
echo   [5] Install desktop deps (npm install in desktop\)
echo   [6] Open release folder  (desktop\release)
echo   [7] Commit changes       (git add -A ^&^& git commit -m "...")
echo.
echo   [0] Exit
echo.
set "choice="
set /p "choice=Select an option: "

if "%choice%"=="1" goto full
if "%choice%"=="2" goto fe
if "%choice%"=="3" goto be
if "%choice%"=="4" goto run
if "%choice%"=="5" goto deps
if "%choice%"=="6" goto open
if "%choice%"=="7" goto commit
if "%choice%"=="0" goto end
echo.
echo   Invalid choice: "%choice%"
timeout /t 2 >nul
goto menu

:full
echo.
echo === Full offline build ===
pushd "%ROOT%\desktop" && call npm run bundle & popd
goto after

:fe
echo.
echo === Build frontend ===
pushd "%ROOT%\frontend" && call npm run build & popd
goto after

:be
echo.
echo === Build backend ===
pushd "%ROOT%\backend" && call npm run build & popd
goto after

:run
echo.
echo === Desktop app (electron .) ===
echo Close the app window to return to this menu.
pushd "%ROOT%\desktop" && call npm run dev & popd
goto after

:deps
echo.
echo === Install desktop deps ===
pushd "%ROOT%\desktop" && call npm install & popd
goto after

:commit
echo.
echo === Commit changes ===
git -C "%ROOT%" status --short
echo.
set "msg="
set /p "msg=Enter commit message (blank to cancel): "
if not defined msg (
  echo Cancelled - no message entered.
  goto after
)
git -C "%ROOT%" add -A
git -C "%ROOT%" commit -m "%msg%"
goto after

:open
if exist "%ROOT%\desktop\release" (
  start "" "%ROOT%\desktop\release"
) else (
  echo No release folder yet - run option [1] first.
)
timeout /t 2 >nul
goto menu

:after
echo.
echo ------------------------------------------------------------
echo   Done. Press any key to return to the menu...
pause >nul
goto menu

:end
echo.
echo Bye.
endlocal
exit /b 0
