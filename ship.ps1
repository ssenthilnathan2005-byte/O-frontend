param([Parameter(Mandatory=$true)][string]$Message)
function Run($c) { Invoke-Expression $c; if ($LASTEXITCODE -ne 0) { throw "FAILED: $c" } }
$branch = (git branch --show-current).Trim()
if ($branch -eq "main") { throw "You are on main. Create a work branch first: git checkout -b my-change" }
git add -A
if (git status --porcelain) { git commit -m $Message }
Run "git fetch origin"
Run "git merge origin/main --no-edit"
Run "npx tsc --noEmit"
Run "npm run build"
Run "git push -u origin $branch"
Run "git checkout main"
Run "git pull origin main"
Run "git merge $branch --no-edit"
Run "git push origin main"
Run "git checkout $branch"
Write-Host "Shipped to main. Production should start building." -ForegroundColor Green