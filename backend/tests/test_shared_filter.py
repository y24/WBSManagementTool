import pytest
from datetime import datetime, timedelta
from app import crud, schemas, models
from app.crud.shared_filter import create_shared_filter, get_shared_filter

def test_create_and_get_shared_filter(db_session):
    filter_data = {"projectIds": [1, 2], "searchTerm": "test"}
    filter_in = schemas.SharedFilterCreate(filter_data=filter_data)
    
    # Create
    db_shared = create_shared_filter(db_session, filter_in)
    assert db_shared.token is not None
    assert "projectIds" in db_shared.filter_data
    
    # Get
    retrieved = get_shared_filter(db_session, db_shared.token)
    assert retrieved.id == db_shared.id
    import json
    assert json.loads(retrieved.filter_data) == filter_data

def test_shared_filter_cleanup(db_session):
    # 1. Manually insert an old record (100 days ago)
    old_date = datetime.utcnow() - timedelta(days=100)
    old_filter = models.SharedFilter(
        token="old-token",
        filter_data='{"test": "old"}',
        created_at=old_date
    )
    db_session.add(old_filter)
    db_session.commit()
    
    # Verify it exists
    assert db_session.query(models.SharedFilter).filter_by(token="old-token").count() == 1
    
    # 2. Create a new filter (triggers cleanup)
    filter_in = schemas.SharedFilterCreate(filter_data={"test": "new"})
    create_shared_filter(db_session, filter_in)
    
    # 3. Verify old filter is gone
    assert db_session.query(models.SharedFilter).filter_by(token="old-token").count() == 0
