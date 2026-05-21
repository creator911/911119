param(
  [string]$Message = "update project",
  [string]$RemoteHost = "64.176.229.125",
  [string]$RemoteUser = "root",
  [string]$RemoteDir = "~/911119",
  [string]$ProcessName = "itemzone",
  [switch]$SkipRemote
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Action
}

function Run-Cmd {
  param(
    [string]$Command,
    [string]$FailMessage
  )

  Write-Host "> $Command" -ForegroundColor DarkGray
  cmd.exe /c $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$FailMessage (exit code: $LASTEXITCODE)"
  }
}

Set-Location (Split-Path -Parent $PSScriptRoot)

Run-Step "Local project checks" {
  Run-Cmd "node --check server.mjs" "server.mjs syntax check failed"
  Run-Cmd "node --check public/app.js" "public/app.js syntax check failed"
  Run-Cmd "npm.cmd run build" "build check failed"
}

Run-Step "Local git status" {
  git status --short --branch
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed"
  }
}

$porcelain = git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "git status --porcelain failed"
}

if ($porcelain) {
  Run-Step "Commit local changes" {
    Run-Cmd "git add ." "git add failed"
    Run-Cmd "git commit -m `"$Message`"" "git commit failed"
  }
} else {
  Write-Host ""
  Write-Host "==> No local changes. Skipping commit." -ForegroundColor Yellow
}

Run-Step "Push to GitHub" {
  Run-Cmd "git push" "git push failed"
}

$localHead = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or -not $localHead) {
  throw "failed to read local HEAD"
}

$remoteHead = (git ls-remote origin refs/heads/main).Split("`t")[0].Trim()
if ($LASTEXITCODE -ne 0 -or -not $remoteHead) {
  throw "failed to read origin/main HEAD"
}

Write-Host ""
Write-Host "Local HEAD : $localHead"
Write-Host "Origin HEAD: $remoteHead"

if ($localHead -ne $remoteHead) {
  throw "GitHub origin/main does not match local HEAD. Stop before VPS deploy."
}

if ($SkipRemote) {
  Write-Host ""
  Write-Host "SkipRemote was set. GitHub upload is complete." -ForegroundColor Green
  exit 0
}

$remoteScript = @"
set -euo pipefail

cd $RemoteDir

echo
echo "==> Remote working tree"
git status --short --branch

if [ -n "`$(git status --porcelain)" ]; then
  echo
  echo "Remote working tree is not clean. Stop before pull."
  echo "Fix or backup the files shown above, then rerun deploy."
  exit 20
fi

echo
echo "==> Optional JSON db backup"
if [ -f data/db.json ]; then
  cp data/db.json "data/db.manual-backup-`$(date +%F-%H%M%S).json"
  echo "data/db.json backup created"
else
  echo "data/db.json not found; skipping backup"
fi

echo
echo "==> Pull latest code"
git pull --ff-only

echo
echo "==> Install dependencies"
npm install

echo
echo "==> Restart PM2"
pm2 restart $ProcessName --update-env
pm2 save

echo
echo "==> PM2 process check"
pm2 status

echo
echo "==> PM2 cwd/script check"
pm2 describe $ProcessName | grep -E "cwd|script path|exec cwd" || true

echo
echo "==> Local HTTP check"
curl -fsS http://127.0.0.1:3000/ >/dev/null
echo "HTTP 127.0.0.1:3000 OK"

echo
echo "==> Remote HEAD"
git rev-parse HEAD

echo
echo "==> Recent logs"
pm2 logs $ProcessName --lines 50 --nostream
"@

Run-Step "Deploy on VPS $RemoteUser@$RemoteHost" {
  Write-Host "SSH may ask for the VPS password once." -ForegroundColor Yellow
  $remoteScript | ssh "$RemoteUser@$RemoteHost" "bash -s"
  if ($LASTEXITCODE -ne 0) {
    throw "remote deploy failed"
  }
}

Write-Host ""
Write-Host "Deploy complete. Local, GitHub, and VPS should now point to $localHead" -ForegroundColor Green
