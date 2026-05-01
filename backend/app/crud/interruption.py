from sqlalchemy.orm import Session
from .. import models, schemas

def get_subtask_interruptions(db: Session, subtask_id: int):
    return db.query(models.SubtaskInterruption).filter(models.SubtaskInterruption.subtask_id == subtask_id).order_by(models.SubtaskInterruption.interruption_date).all()

def create_subtask_interruption(db: Session, interruption: schemas.SubtaskInterruptionCreate):
    db_interruption = models.SubtaskInterruption(**interruption.model_dump())
    db.add(db_interruption)
    db.commit()
    db.refresh(db_interruption)
    return db_interruption

def update_subtask_interruption(db: Session, interruption_id: int, interruption: schemas.SubtaskInterruptionUpdate):
    db_interruption = db.query(models.SubtaskInterruption).filter(models.SubtaskInterruption.id == interruption_id).first()
    if not db_interruption:
        return None
    
    update_data = interruption.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_interruption, key, value)
    
    db.commit()
    db.refresh(db_interruption)
    return db_interruption

def delete_subtask_interruption(db: Session, interruption_id: int):
    db_interruption = db.query(models.SubtaskInterruption).filter(models.SubtaskInterruption.id == interruption_id).first()
    if not db_interruption:
        return False
    
    db.delete(db_interruption)
    db.commit()
    return True
