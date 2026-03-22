import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import models

# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    
    # Pre-seed mandatory master data if needed
    db = TestingSessionLocal()
    
    # Add default statuses (matches seed.py logic)
    statuses = [
        models.MstStatus(id=1, status_name="New", color_code="#cccccc", sort_order=1, is_system_reserved=True),
        models.MstStatus(id=2, status_name="In Progress", color_code="#007bff", sort_order=2, is_system_reserved=False),
        models.MstStatus(id=4, status_name="Done", color_code="#28a745", sort_order=4, is_system_reserved=True),
        models.MstStatus(id=5, status_name="Blocked", color_code="#dc3545", sort_order=5, is_system_reserved=True),
        models.MstStatus(id=7, status_name="Removed", color_code="#6c757d", sort_order=7, is_system_reserved=True),
    ]
    db.add_all(statuses)
    
    # Add a member
    member = models.MstMember(id=1, member_name="Test User", sort_order=1)
    db.add(member)
    
    db.commit()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
