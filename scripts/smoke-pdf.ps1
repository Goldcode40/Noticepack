param(
  [Parameter(Mandatory=$true)][string]$CaseId,
  [Parameter(Mandatory=$true)][string]$DocTypeId,
  [string]$OutFile = "_out.pdf"
)

$uri = "http://localhost:3000/api/cases/$CaseId/documents/$DocTypeId/pdf"

curl.exe -sS -L `
  -H "x-dev-bypass: 1" `
  $uri `
  --output $OutFile

Write-Host "Saved:" (Resolve-Path $OutFile)

# Sanity: show first 8 bytes (PDF should start with %PDF-)
$bytes = Get-Content -Encoding Byte -TotalCount 8 -Path $OutFile
$head  = -join ($bytes | ForEach-Object { [char]$_ })
Write-Host "Header:" $head

if ($head -notlike "%PDF-*") {
  Write-Warning "Not a PDF. Contents:"
  Get-Content $OutFile -Raw
  exit 1
}

Start-Process $OutFile
