# seed_db.ps1
# Run this script to insert initial seed data (master data) into the database.

Write-Host "Activating virtual environment..."
if (Test-Path ".\venv\Scripts\activate.ps1") {
    . .\venv\Scripts\activate.ps1
} else {
    Write-Error "Virtual environment not found. Please run setup first."
    exit 1
}

Write-Host "Seeding initial master data (status, types, etc)..."
python seed.py

Write-Host "Data seeding complete!"
