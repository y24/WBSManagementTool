import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .. import models, schemas

def create_shared_filter(db: Session, filter_in: schemas.SharedFilterCreate) -> models.SharedFilter:
    # 1. Cleanup old records (90 days)
    # Using datetime.utcnow() for consistency if the DB uses UTC
    threshold = datetime.utcnow() - timedelta(days=90)
    db.query(models.SharedFilter).filter(models.SharedFilter.created_at < threshold).delete()
    
    # 2. Generate token
    token = str(uuid.uuid4())
    
    # 3. Create record
    # filter_data is stored as a JSON string in the Text column
    import json
    db_shared = models.SharedFilter(
        token=token,
        filter_data=json.dumps(filter_in.filter_data)
    )
    db.add(db_shared)
    db.commit()
    db.refresh(db_shared)
    return db_shared

def get_shared_filter(db: Session, token: str) -> models.SharedFilter:
    return db.query(models.SharedFilter).filter(models.SharedFilter.token == token).first()
