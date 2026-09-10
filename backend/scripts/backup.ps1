param(
  [string]$OutputDirectory = "./backups",
  [string]$Container = "startv-postgres"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDirectory "startv-$timestamp.sql"

docker exec $Container pg_dump -U startv -d startv --clean --if-exists | Out-File -FilePath $output -Encoding utf8
Write-Output "Backup criado em $output"
