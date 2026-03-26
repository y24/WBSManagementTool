# server_setup.ps1
# WBS Management Tool: Server Setup Script

$ErrorActionPreference = "Stop"

# 1. Start setup
Write-Host "================================" -ForegroundColor Cyan
Write-Host " WBS Management Tool - Server Setup " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 2. Check for required software
Write-Host "`n[Check] Checking for required software..." -ForegroundColor Yellow
$requiredSoftware = @("node", "npm", "python", "pip")
foreach ($soft in $requiredSoftware) {
    if (Get-Command $soft -ErrorAction SilentlyContinue) {
        Write-Host "  OK: $soft is installed." -ForegroundColor Green
    } else {
        Write-Error "  Error: $soft is not found. Please install it and add to PATH."
    }
}

# 3. Setup Backend (Python)
Write-Host "`n[Backend] Setting up Backend environment..." -ForegroundColor Yellow
$backendRoot = "backend"
if (-not (Test-Path "$backendRoot\venv")) {
    Write-Host "  Creating virtual environment..."
    python -m venv "$backendRoot\venv"
}

Write-Host "  Installing dependencies..."
& "$backendRoot\venv\Scripts\pip.exe" install fastapi uvicorn sqlalchemy alembic psycopg2-binary pydantic pydantic-settings httpx python-dotenv pandas openpyxl python-multipart

Write-Host "  Setting up .env file..."
if (-not (Test-Path "$backendRoot\.env")) {
    if (Test-Path "$backendRoot\.env.example") {
        Copy-Item "$backendRoot\.env.example" "$backendRoot\.env"
        Write-Host "    Created .env from .env.example" -ForegroundColor Green
    } else {
        Write-Warning "    .env.example not found. Skipping .env creation."
    }
} else {
    Write-Host "    .env already exists."
}

Write-Host "  Setting up database if not exists..."
& "$backendRoot\venv\Scripts\python.exe" "$backendRoot\setup_db.py"


Write-Host "  Running migrations..."
# Alembic needs to be run from backend root
Push-Location $backendRoot
& ".\venv\Scripts\alembic.exe" upgrade head
Write-Host "  Seeding initial data..."
& ".\venv\Scripts\python.exe" "seed.py"
Pop-Location

# 4. Setup Frontend (React)
Write-Host "`n[Frontend] Setting up Frontend..." -ForegroundColor Yellow
$frontendRoot = "frontend"
Push-Location $frontendRoot

Write-Host "  Installing npm packages..."
npm install

Write-Host "  Creating .env.production..."
"VITE_API_URL=/api" | Out-File -FilePath ".env.production" -Encoding UTF8

Write-Host "  Building for production..."
npm run build
Pop-Location

# 5. Generate IIS web.config
Write-Host "`n[IIS] Generating web.config in frontend\dist..." -ForegroundColor Yellow
$webConfigContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- Reverse Proxy Setup: Forward requests to localhost:8000 -->
                <rule name="ReverseProxyToBackend" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://localhost:8000/api/{R:1}" />
                </rule>
                <!-- SPA Fallback -->
                <rule name="React SPA Routing" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="index.html" />
                </rule>
            </rules>
        </rewrite>
    </system.webServer>
</configuration>
"@

$distPath = "$frontendRoot\dist"
if (Test-Path $distPath) {
    $webConfigContent | Out-File -FilePath "$distPath\web.config" -Encoding UTF8
    Write-Host "  web.config generated at $distPath\web.config" -ForegroundColor Green
} else {
    Write-Warning "  Warning: dist folder not found. Build might have failed."
}

# 6. Final Steps
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host " Setup Completed!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Next Steps:"
Write-Host "1. In IIS Manager, create a site pointing to: $(Get-Item $distPath | Select-Object -ExpandProperty FullName)"
Write-Host "2. Enable ARR Proxy in IIS (Application Request Routing -> Server Proxy Settings -> Enable proxy)"
Write-Host "3. Start Backend as a service using NSSM or similar tool."
Write-Host "`nSee IIS_Setup_Guide.md for more details."
