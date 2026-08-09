<#
.SYNOPSIS
    Backs up the My Financial Life Postgres database (backlog.md Y1).

.DESCRIPTION
    The database volume is the only part of this project with no second copy - code has
    git, data has nothing. This script closes that gap.

    Design notes, each deliberate:

    * **Dump inside the container, then `docker cp`** rather than piping pg_dump's stdout
      into a PowerShell redirect. PowerShell re-encodes piped output, which silently
      corrupts a compressed (-Fc) dump and can mangle even a plain SQL one. Writing to a
      file inside the container and copying the bytes out avoids the whole class of bug.
    * **Custom format (-Fc)**, not plain SQL: compressed, and restorable selectively with
      pg_restore.
    * **A too-small dump is treated as a failure.** A 0-byte or truncated file that looks
      like a backup is worse than no backup, because it stops you looking for one.
    * **Retention is by count, newest kept.** Unbounded backups eventually fill the disk
      and turn a safety feature into an outage.

.PARAMETER DestinationDir
    Where dumps are written. Should be a DIFFERENT physical disk from the Docker volume -
    a second copy on the same failing drive is not a second copy.

.PARAMETER KeepCount
    How many dumps to retain. Older ones are deleted after a successful new dump.

.EXAMPLE
    powershell -File scripts\backup.ps1
    powershell -File scripts\backup.ps1 -DestinationDir E:\Backups\finance -KeepCount 30
#>
[CmdletBinding()]
param(
    [string]$DestinationDir = "D:\Backups\FinanceFlareAI",
    [int]$KeepCount = 14
)

$ErrorActionPreference = 'Stop'

$Container = 'myfinanciallife-postgres'
$DbUser    = 'myfinanciallife_user'
$DbName    = 'myfinanciallife'
# A real dump of this schema is several KB even with zero rows (schema + seeded system
# categories). Anything under this means pg_dump failed part-way.
$MinimumPlausibleBytes = 2048

function Write-Step($Message) { Write-Host "[backup] $Message" }

# --- Preconditions -------------------------------------------------------------------
# Checked explicitly so a failure says which assumption broke, rather than surfacing as
# a confusing docker error.
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker not found on PATH - is Docker Desktop installed and running?"
}

$running = docker ps --filter "name=$Container" --format '{{.Names}}'
if ($running -notcontains $Container) {
    throw "Container '$Container' is not running. Start the stack first: docker compose up -d"
}

if (-not (Test-Path $DestinationDir)) {
    Write-Step "Creating $DestinationDir"
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
}

$timestamp   = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$fileName    = "myfinanciallife-$timestamp.dump"
$destPath    = Join-Path $DestinationDir $fileName
$containerTmp = "/tmp/$fileName"

# --- Dump ----------------------------------------------------------------------------
Write-Step "Dumping '$DbName' inside $Container..."
docker exec $Container pg_dump -U $DbUser -d $DbName -Fc -f $containerTmp
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE - nothing was written."
}

Write-Step "Copying dump out to $destPath"
docker cp "${Container}:${containerTmp}" $destPath
$copyExit = $LASTEXITCODE
# Always clean up the in-container temp file, even if the copy failed - otherwise a
# repeatedly-failing backup slowly fills the container's filesystem.
docker exec $Container rm -f $containerTmp | Out-Null
if ($copyExit -ne 0) {
    throw "docker cp failed with exit code $copyExit - the dump did not reach $DestinationDir."
}

# --- Verify it's plausible ------------------------------------------------------------
if (-not (Test-Path $destPath)) {
    throw "Expected backup file is missing: $destPath"
}
$size = (Get-Item $destPath).Length
if ($size -lt $MinimumPlausibleBytes) {
    # Delete it so a truncated file can never be mistaken for a usable restore point.
    Remove-Item $destPath -Force
    throw "Dump was only $size bytes - implausibly small, so it was deleted rather than kept as a false safety net."
}
Write-Step ("Wrote {0} ({1:N0} bytes)" -f $fileName, $size)

# --- Retention -------------------------------------------------------------------------
# Only runs after a verified-good new dump, so a failing backup never deletes the last
# known-good one.
$all = Get-ChildItem -Path $DestinationDir -Filter 'myfinanciallife-*.dump' |
       Sort-Object LastWriteTime -Descending
if ($all.Count -gt $KeepCount) {
    $stale = $all | Select-Object -Skip $KeepCount
    foreach ($f in $stale) {
        Write-Step "Removing old backup $($f.Name)"
        Remove-Item $f.FullName -Force
    }
}

# Recount from disk rather than arithmetic on the pre-deletion list - says what is
# actually there now. (No ternary operator: this must run under Windows PowerShell 5.1.)
$retained = (Get-ChildItem -Path $DestinationDir -Filter 'myfinanciallife-*.dump').Count
Write-Step "Done. $retained backup(s) retained in $DestinationDir"
