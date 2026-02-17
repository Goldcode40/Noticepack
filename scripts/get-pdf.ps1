param(
  [Parameter(Mandatory=$true)][string]$Token,
  [Parameter(Mandatory=$true)][string]$CaseId,
  [Parameter(Mandatory=$true)][string]$DocTypeId,
  [string]$OutFile = "_out.pdf"
)

$uri = "http://localhost:3000/api/cases/$CaseId/documents/$DocTypeId/pdf"

# IMPORTANT: use curl.exe (PowerShell's curl is an alias for Invoke-WebRequest and behaves differently)
curl.exe -sS -L `
  -H "Authorization: Bearer $Token" `
  $uri `
  --output $OutFile

Write-Host "Saved:" (Resolve-Path $OutFile)

# Quick sanity: show first 8 bytes (PDF should start with %PDF-)
$bytes = Get-Content -Encoding Byte -TotalCount 8 -Path $OutFile
$head  = -join ($bytes | ForEach-Object { [char]$_ })
Write-Host "Header:" $head
if ($head -notlike "%PDF-*") {
  Write-Warning "Not a PDF. Open the file as text to see the JSON error:"
  Get-Content $OutFile -Raw
}
