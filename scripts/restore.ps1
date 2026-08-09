<#
.SYNOPSIS
    Restores the My Financial Life database from a backup dump (companion to backup.ps1).

.DESCRIPTION
    backup.ps1 existed without this, which means the backups had never been proven
    restorable. An untested backup is not a backup — it is a file you hope about. This
    script is the other half, and running it against a throwaway database is how you
    verify the dumps are real (see -TargetDb).

    Design notes, each deliberate:

    * **Restores into a DROPped-and-recreated database.** pg_restore into a populated
      database half-merges: existing rows survive, constraints collide, and you end up
      with a mixture of two points in time that looks plausible and is wrong. Starting
      empty is the only way the result equals the dump.
    * **Requires -Confirm or an interactive "yes".** This destroys the current database.
      Nothing about that should be possible by arrow-up-and-enter.
    * **The backend is stopped for the duration.** It holds a connection pool; Postgres
      refuses to DROP a database with active connections, and a half-restored database
      being served to a live app is worse than a clear outage.
    * **-TargetDb restores to a different name**, so you can rehearse a restore without
      touching real data. Do this at least once before you trust the backups.
    * **Verifies row counts after restore** rather than trusting a zero exit code.

.PARAMETER BackupFile
    Path to a .dump written by backup.ps1. Defaults to the newest one found.

.PARAMETER SourceDir
    Where to look for the newest dump when -BackupFile is not given.

.PARAMETER TargetDb
    Database to restore INTO. Defaults to the live database. Set something else
    (e.g. restore_test) to rehearse safely.

.PARAMETER Confirm
    Skip the interactive prompt. Intended for scripted rehearsals, not routine use.

.EXAMPLE
    # Rehearse: prove the newest backup is restorable, without touching live data
    powershell -File scripts\restore.ps1 -TargetDb restore_test -Confirm

.EXAMPLE
    # The real thing
    powershell -File scripts\restore.ps1
    powershell -File scripts\restore.ps1 -BackupFile D:\Backups\FinanceFlareAI\myfinanciallife-2026-08-09_120000.dump
#>
[CmdletBinding()]
param(
    [string]$BackupFile,
    [string]$SourceDir = "D:\Backups\FinanceFlareAI",
    [string]$TargetDb  = "myfinanciallife",
    [switch]$Confirm
)

$ErrorActionPreference = 'Stop'

$Container    = 'myfinanciallife-postgres'
$BackendName  = 'myfinanciallife-backend'
$DbUser       = 'myfinanciallife_user'
$LiveDb       = 'myfinanciallife'

function Write-Step($Message) { Write-Host "[restore] $Message" }

# --- Preconditions -------------------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker not found on PATH - is Docker Desktop installed and running?"
}

$running = docker ps --filter "name=$Container" --format '{{.Names}}'
if ($running -notcontains $Container) {
    throw "Container '$Container' is not running. Start the stack first: docker compose up -d"
}

if (-not $BackupFile) {
    if (-not (Test-Path $SourceDir)) {
        throw "No -BackupFile given and $SourceDir does not exist. Run scripts\backup.ps1 first."
    }
    $newest = Get-ChildItem -Path $SourceDir -Filter 'myfinanciallife-*.dump' |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $newest) {
        throw "No backups found in $SourceDir. Run scripts\backup.ps1 first."
    }
    $BackupFile = $newest.FullName
    Write-Step "No -BackupFile given; using newest: $($newest.Name)"
}

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}
$backupSize = (Get-Item $BackupFile).Length
Write-Step ("Source: {0} ({1:N0} bytes)" -f $BackupFile, $backupSize)

# --- Consent -------------------------------------------------------------------------
$isLive = ($TargetDb -eq $LiveDb)
if (-not $Confirm) {
    if ($isLive) {
        Write-Host ""
        Write-Host "  This DESTROYS the current '$LiveDb' database and replaces it" -ForegroundColor Yellow
        Write-Host "  with the contents of the backup above. This cannot be undone." -ForegroundColor Yellow
        Write-Host ""
    }
    $answer = Read-Host "Type 'yes' to restore into '$TargetDb'"
    if ($answer -ne 'yes') { Write-Step "Aborted - nothing was changed."; return }
}

# --- Stop the app while the database is swapped ---------------------------------------
# Only for a live restore: a rehearsal into a scratch database doesn't disturb anything.
$stoppedBackend = $false
if ($isLive) {
    $backendRunning = docker ps --filter "name=$BackendName" --format '{{.Names}}'
    if ($backendRunning -contains $BackendName) {
        Write-Step "Stopping $BackendName (it holds a connection pool)"
        docker stop $BackendName | Out-Null
        $stoppedBackend = $true
    }
}

try {
    # --- Recreate the target empty ----------------------------------------------------
    Write-Step "Recreating database '$TargetDb'"
    # Terminate stragglers first, or DROP DATABASE fails on any lingering session.
    docker exec $Container psql -U $DbUser -d postgres -c `
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TargetDb' AND pid <> pg_backend_pid();" | Out-Null
    docker exec $Container psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $TargetDb;" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not drop '$TargetDb'." }
    docker exec $Container psql -U $DbUser -d postgres -c "CREATE DATABASE $TargetDb;" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create '$TargetDb'." }

    # --- Restore ----------------------------------------------------------------------
    $containerTmp = "/tmp/restore.dump"
    Write-Step "Copying dump into $Container"
    docker cp $BackupFile "${Container}:${containerTmp}"
    if ($LASTEXITCODE -ne 0) { throw "docker cp failed - the dump did not reach the container." }

    Write-Step "Running pg_restore into '$TargetDb'..."
    docker exec $Container pg_restore -U $DbUser -d $TargetDb --no-owner --no-privileges $containerTmp
    $restoreExit = $LASTEXITCODE
    docker exec $Container rm -f $containerTmp | Out-Null
    # pg_restore exits non-zero on warnings too, so don't fail here — the row-count
    # verification below is the real check.
    if ($restoreExit -ne 0) {
        Write-Step "pg_restore reported exit code $restoreExit (often just warnings) - verifying..."
    }

    # --- Verify -----------------------------------------------------------------------
    # A zero exit code is not proof. Count what actually landed.
    $counts = docker exec $Container psql -U $DbUser -d $TargetDb -tAc `
        "SELECT (SELECT COUNT(*) FROM users)||'|'||(SELECT COUNT(*) FROM transactions)||'|'||(SELECT COUNT(*) FROM categories)||'|'||(SELECT version_num FROM alembic_version)"
    if ($LASTEXITCODE -ne 0 -or -not $counts) {
        throw "Restore verification failed - could not read the restored tables. '$TargetDb' is NOT usable."
    }
    $parts = ($counts -join '').Trim() -split '\|'
    Write-Step "Restored: $($parts[0]) users, $($parts[1]) transactions, $($parts[2]) categories, schema $($parts[3])"

    if ([int]$parts[2] -eq 0) {
        throw "No categories present after restore - the system categories are seeded on every start, so an empty table means the restore did not land. Treat '$TargetDb' as bad."
    }

    Write-Step "Restore into '$TargetDb' completed and verified."
    if (-not $isLive) {
        Write-Step "This was a rehearsal. Drop it when done:"
        Write-Step "  docker exec $Container psql -U $DbUser -d postgres -c 'DROP DATABASE $TargetDb;'"
    }
}
finally {
    if ($stoppedBackend) {
        Write-Step "Restarting $BackendName"
        docker start $BackendName | Out-Null
    }
}
