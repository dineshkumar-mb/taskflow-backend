$ApiUrl = "http://localhost:5001/api"
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "Starting SaaS Flow Verification..." -ForegroundColor Cyan

# 1. Register User
$RegEmail = "verify_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$RegBody = @{
    name = "Verification User"
    email = $RegEmail
    password = "Password123!"
} | ConvertTo-Json

Write-Host "`n--- 1. Testing Registration ---"
try {
    $RegRes = Invoke-RestMethod -Method Post -Uri "$ApiUrl/auth/register" -Body $RegBody -ContentType "application/json" -WebSession $Session
    Write-Host "Registration Success: $($RegRes.email)" -ForegroundColor Green
    Write-Host "Organization ID: $($RegRes.organizationId)"
} catch {
    Write-Host "Registration Failed: $_" -ForegroundColor Red
    return
}

# 2. Check Analytics
Write-Host "`n--- 2. Checking Dashboard Stats ---"
try {
    $StatsRes = Invoke-RestMethod -Method Get -Uri "$ApiUrl/analytics/org" -WebSession $Session
    Write-Host "Stats Received: $StatsRes" -ForegroundColor Green
} catch {
    Write-Host "Analytics Failed: $_" -ForegroundColor Red
}

# 3. Test Project Limits
Write-Host "`n--- 3. Testing Project Limits (Free Plan = 2) ---"
for ($i = 1; $i -le 3; $i++) {
    $ProjBody = @{
        name = "Project $i"
        key = "P$i"
        description = "Test Project $i"
    } | ConvertTo-Json

    try {
        $ProjRes = Invoke-RestMethod -Method Post -Uri "$ApiUrl/projects" -Body $ProjBody -ContentType "application/json" -WebSession $Session
        Write-Host "Project $i Created: $($ProjRes.name)" -ForegroundColor Green
    } catch {
        $errMsg = $_.Exception.Response.GetResponseStream() | ForEach-Object { (New-Object System.IO.StreamReader($_)).ReadToEnd() } | ConvertFrom-Json
        Write-Host "Project $i Failed (Expected for 3): $($errMsg.message)" -ForegroundColor Yellow
    }
}

Write-Host "`nVerification Complete!" -ForegroundColor Cyan
