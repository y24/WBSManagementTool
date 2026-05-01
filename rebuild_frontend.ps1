# rebuild_frontend.ps1
# WBS Management Tool: Frontend Rebuild Script (Simple Version)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WBS Management Tool - Frontend Build    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$frontendRoot = "frontend"

if (-not (Test-Path $frontendRoot)) {
    Write-Host "Error: '$frontendRoot' directory not found." -ForegroundColor Red
    exit 1
}

Write-Host "`nBuilding for production..." -ForegroundColor Yellow
Push-Location $frontendRoot
npm run build
Pop-Location

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Frontend Build Completed!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
