from sqlalchemy.orm import Session
from .. import models, schemas

def get_markers(db: Session):
    return db.query(models.Marker).order_by(models.Marker.marker_date).all()

def get_marker_by_date(db: Session, marker_date):
    return db.query(models.Marker).filter(models.Marker.marker_date == marker_date).first()

def create_or_update_marker(db: Session, marker: schemas.MarkerCreate):
    db_marker = get_marker_by_date(db, marker.marker_date)
    if db_marker:
        # Update existing
        db_marker.name = marker.name
        db_marker.note = marker.note
        db_marker.color = marker.color
    else:
        # Create new
        db_marker = models.Marker(
            marker_date=marker.marker_date,
            name=marker.name,
            note=marker.note,
            color=marker.color
        )
        db.add(db_marker)
    
    db.commit()
    db.refresh(db_marker)
    return db_marker

def update_marker(db: Session, marker_id: int, marker_in: schemas.MarkerUpdate):
    db_marker = db.query(models.Marker).filter(models.Marker.id == marker_id).first()
    if not db_marker:
        return None
    
    update_data = marker_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_marker, field, value)
    
    db.commit()
    db.refresh(db_marker)
    return db_marker

def delete_marker(db: Session, marker_id: int):
    db_marker = db.query(models.Marker).filter(models.Marker.id == marker_id).first()
    if db_marker:
        db.delete(db_marker)
        db.commit()
    return db_marker
