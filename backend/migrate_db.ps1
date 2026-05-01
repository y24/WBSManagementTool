# migrate_db.ps1
# Run this script to apply database migrations to the latest version.

Write-Host "Activating virtual environment..."
if (Test-Path ".\venv\Scripts\activate.ps1") {
    . .\venv\Scripts\activate.ps1
} else {
    Write-Error "Virtual environment not found. Please run setup first."
    exit 1
}

Write-Host "Applying migrations to the database..."
alembic upgrade head

Write-Host "Database migration complete!"
