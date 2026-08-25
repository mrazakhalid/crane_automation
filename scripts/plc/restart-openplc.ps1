<#
  One command to run AFTER downloading a new/changed PLC program from OpenPLC Editor v4:
  stops the runtime, re-syncs the OPC UA mapping (opcua.json) from the compiled program,
  re-enables the opcua plugin, restarts the runtime, and waits for the server on :4840.

  Usage (from the repo root, or via the `!` prefix in Claude Code):
    powershell -ExecutionPolicy Bypass -File scripts\plc\restart-openplc.ps1
#>
param([string]$OpenPlcHome = "C:\Users\CEO\AppData\Local\OpenPLC Runtime")

$runtime = Join-Path $OpenPlcHome "openplc-runtime"

Write-Host "1/4 Stopping the runtime..."
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match 'plc_main|python3' -or $_.CommandLine -match 'webserver.app|StartOpenPLC' } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
Start-Sleep -Seconds 3

Write-Host "2/4 Syncing OPC UA mapping from the compiled program..."
$env:OPENPLC_HOME = ($runtime -replace '\\','/')
node (Join-Path $PSScriptRoot "sync-opcua-mapping.mjs")

Write-Host "3/4 Starting the runtime..."
Start-Process -FilePath (Join-Path $OpenPlcHome "StartOpenPLC.bat") -WorkingDirectory $OpenPlcHome -WindowStyle Minimized

Write-Host "4/4 Waiting for the OPC UA server on :4840..."
$up = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 3
  if (Test-NetConnection -ComputerName localhost -Port 4840 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    $up = $true; break
  }
}
if ($up) { Write-Host "Done - OPC UA server is up on opc.tcp://localhost:4840/openplc/opcua" }
else { Write-Host "OPC UA server did not come up in time - check the runtime console." }
