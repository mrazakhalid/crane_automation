@echo off
REM ============================================================================
REM  Crane Automation - one-click dev launcher
REM
REM  Double-click (or use the "Crane Automation" shortcut for the icon) to:
REM    1. Open this project in VS Code.
REM    2. Terminal 1 (Ctrl+J)          -> claude --dangerously-skip-permissions
REM    3. Terminal 2 (Ctrl+Shift+`)    -> split (Ctrl+Shift+5)
REM         left  pane (Alt+Left)      -> cd frontend & npm run dev
REM         right pane (Alt+Right)     -> cd backend  & npm run dev
REM    4. Terminal 3 (Ctrl+Shift+`)    -> interactive desktop-build menu
REM
REM  The keystroke orchestration lives in tools\launch-terminals.ps1 so the
REM  timing is tunable. If a step lands in the wrong terminal, raise the delays
REM  at the top of that script.
REM ============================================================================
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch-terminals.ps1"
