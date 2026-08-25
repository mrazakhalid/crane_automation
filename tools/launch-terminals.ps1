<#
  Crane Automation - VS Code integrated-terminal orchestrator.

  Opens the repo in VS Code, then reproduces this manual keystroke sequence:

    Ctrl+J                 open panel + terminal 1  -> claude (skip permissions)
    Ctrl+Shift+`           new terminal 2
    Ctrl+Shift+5           split terminal 2 -> creates terminal 3
    Alt+Left               focus left pane          -> cd frontend & npm run dev
    Alt+Right              focus right pane         -> cd backend  & npm run dev
    Ctrl+Shift+`           new terminal 4           -> desktop-build menu

  SendKeys drives the real UI, so timing matters. If keys land in the wrong
  place, increase the delays below (VS Code cold-start on this machine, disk
  speed, and extension load all affect how long the editor takes to be ready).
#>
param(
  [int]$StartupMs = 6000,   # wait for VS Code to finish loading before typing
  [int]$StepMs    = 450,    # pause between individual keystroke steps
  [int]$BootMs    = 1400    # pause after opening a terminal before typing into it
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot          # tools\ -> repo root

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
}
"@

$wshell = New-Object -ComObject WScript.Shell
$grave  = [char]0x60                              # backtick, without escaping headaches

function Focus-VSCode {
  # Prefer this repo's window; fall back to any VS Code window.
  $p = Get-Process Code -ErrorAction SilentlyContinue |
       Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |
       Sort-Object { if ($_.MainWindowTitle -like '*crane_automation*') { 0 } else { 1 } } |
       Select-Object -First 1
  if ($p) {
    [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null   # SW_RESTORE
    [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 250
    return $true
  }
  return $false
}

function Key([string]$keys) { [void]$wshell.SendKeys($keys); Start-Sleep -Milliseconds $StepMs }

function Line([string]$text) {
  # Escape SendKeys metacharacters, then send the text + Enter.
  $esc = $text -replace '([+^%~(){}\[\]])', '{$1}'
  [void]$wshell.SendKeys($esc)
  [void]$wshell.SendKeys('~')
  Start-Sleep -Milliseconds $StepMs
}

# --- 1) Launch VS Code on the repo and wait for the window ------------------
Write-Host "Opening VS Code on $repo ..."
Start-Process -FilePath 'code' -ArgumentList '-n', "`"$repo`"" | Out-Null

$deadline = (Get-Date).AddMilliseconds($StartupMs + 8000)
while ((Get-Date) -lt $deadline) {
  if (Focus-VSCode) { break }
  Start-Sleep -Milliseconds 500
}
Start-Sleep -Milliseconds $StartupMs
Focus-VSCode | Out-Null

# --- 2) Terminal 1: claude --------------------------------------------------
Key('^j'); Start-Sleep -Milliseconds $BootMs
Line('claude --dangerously-skip-permissions')

# --- 3) Terminal 2 + split (terminal 3) -------------------------------------
Key("^+$grave"); Start-Sleep -Milliseconds $BootMs   # Ctrl+Shift+` : new terminal
Key('^+5');      Start-Sleep -Milliseconds $BootMs    # Ctrl+Shift+5 : split

# left pane -> frontend
Key('%{LEFT}')
Line('cd frontend')
Line('npm run dev')

# right pane -> backend
Key('%{RIGHT}')
Line('cd backend')
Line('npm run dev')

# --- 4) Terminal 4: desktop-build menu --------------------------------------
Key("^+$grave"); Start-Sleep -Milliseconds $BootMs   # Ctrl+Shift+` : new terminal
Line('cmd /c tools\build-menu.bat')

# --- 5) Open the app in Edge once Vite is actually serving ------------------
# The dev server needs a few seconds to boot; polling avoids opening Edge on a
# dead port (which would show a "can't reach this page" error).
$appUrl   = 'http://localhost:5173/'
$deadline = (Get-Date).AddSeconds(60)
Write-Host "Waiting for the frontend dev server on 5173 ..."
while ((Get-Date) -lt $deadline) {
  $up = Test-NetConnection -ComputerName 'localhost' -Port 5173 `
          -InformationLevel Quiet -WarningAction SilentlyContinue
  if ($up) { break }
  Start-Sleep -Milliseconds 500
}
Write-Host "Opening $appUrl in Microsoft Edge ..."
Start-Process 'msedge' -ArgumentList $appUrl

Write-Host "Done. If any step misfired, rerun with larger delays, e.g.:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File tools\launch-terminals.ps1 -StartupMs 9000 -BootMs 2000"
