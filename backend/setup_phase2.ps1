# setup_phase2.ps1
# Run this script to generate your db schema and insert initial seed data.

Write-Host "Starting Phase 2 Setup (Migrations and Seeding)..."

# Apply Migrations
powershell -ExecutionPolicy Bypass -File .\migrate_db.ps1

# Seed Data
powershell -ExecutionPolicy Bypass -File .\seed_db.ps1

Write-Host "Phase 2 Database Setup is Complete!"
