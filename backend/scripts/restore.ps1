param(
  [Parameter(Mandatory = $true)]
  [string]$File,
  [string]$Container = "startv-postgres"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $File)) { throw "Arquivo de backup não encontrado: $File" }
Get-Content -Raw $File | docker exec -i $Container psql -U startv -d startv
Write-Output "Backup restaurado: $File"
