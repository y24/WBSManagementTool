# setup_phase2.ps1
# Run this script to generate your db schema and insert initial seed data.

Write-Host "Activating virtual environment..."
.\venv\Scripts\activate

Write-Host "Auto-generating Alembic migration scripts..."
alembic revision --autogenerate -m "Initial Schema"

Write-Host "Applying migrations to the database..."
alembic upgrade head

Write-Host "Seeding initial master data (status, types, etc)..."
python seed.py

Write-Host "Phase 2 Database Setup is Complete!"
