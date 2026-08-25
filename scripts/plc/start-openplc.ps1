<#
  Start OpenPLC with the OPC UA plugin guaranteed ON.

  Use this INSTEAD of StartOpenPLC.bat for everyday starts. OpenPLC resets plugins.conf
  (turns opcua back to 0) on every shutdown, so this re-enables it right before launching.
  It does NOT touch opcua.json, so your NodeId mapping is preserved.

  Usage (repo root, or via the `!` prefix in Claude Code):
    powershell -ExecutionPolicy Bypass -File scripts\plc\start-openplc.ps1

  (After CHANGING the PLC program, use restart-openplc.ps1 instead — it also re-maps opcua.json.)
#>
param([string]$OpenPlcHome = "C:\Users\CEO\AppData\Local\OpenPLC Runtime")

$conf = Join-Path $OpenPlcHome "openplc-runtime\plugins.conf"

# Re-enable the opcua plugin (3rd CSV field -> 1). Path field has no commas, so [^,]+ is safe.
(Get-Content $conf) -replace '^(opcua,[^,]+,)\d(,.*)$', '${1}1${2}' | Set-Content $conf -Encoding ascii
Write-Host "opcua plugin enabled in plugins.conf"

Start-Process -FilePath (Join-Path $OpenPlcHome "StartOpenPLC.bat") -WorkingDirectory $OpenPlcHome -WindowStyle Minimized

Write-Host "Waiting for the OPC UA server on :4840..."
$up = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 3
  if (Test-NetConnection -ComputerName localhost -Port 4840 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    $up = $true; break
  }
}
if ($up) { Write-Host "Up: opc.tcp://localhost:4840/openplc/opcua" }
else { Write-Host "OPC UA server did not come up in time - check the runtime console." }
