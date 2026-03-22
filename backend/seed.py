import psycopg2
from app.database import SessionLocal
from app.models import MstStatus, MstSubtaskType

def seed_data():
    db = SessionLocal()
    try:
        # Seed statuses
        statuses = [
            {"id": 1, "status_name": "New", "color_code": "#9ca3af", "sort_order": 1, "is_active": True},
            {"id": 2, "status_name": "In Progress", "color_code": "#38bdf8", "sort_order": 2, "is_active": True},
            {"id": 3, "status_name": "In Review", "color_code": "#a855f7", "sort_order": 3, "is_active": True},
            {"id": 4, "status_name": "Done", "color_code": "#22c55e", "sort_order": 4, "is_active": True},
            {"id": 5, "status_name": "Blocked", "color_code": "#ef4444", "sort_order": 5, "is_active": True},
            {"id": 6, "status_name": "Pending", "color_code": "#eab308", "sort_order": 6, "is_active": True},
            {"id": 7, "status_name": "Removed", "color_code": "#d1d5db", "sort_order": 7, "is_active": True},
        ]

        for st in statuses:
            existing = db.query(MstStatus).filter(MstStatus.id == st["id"]).first()
            if not existing:
                db.add(MstStatus(**st))
            else:
                existing.status_name = st["status_name"]
                existing.color_code = st["color_code"]
                existing.sort_order = st["sort_order"]
                existing.is_active = st["is_active"]

        # Seed subtask types
        types = [
            {"id": 1, "type_name": "設計", "sort_order": 1, "is_active": True},
            {"id": 2, "type_name": "実装", "sort_order": 2, "is_active": True},
            {"id": 3, "type_name": "テスト", "sort_order": 3, "is_active": True},
            {"id": 4, "type_name": "レビュー対応", "sort_order": 4, "is_active": True},
            {"id": 5, "type_name": "ドキュメント修正", "sort_order": 5, "is_active": True},
        ]

        for ty in types:
            existing = db.query(MstSubtaskType).filter(MstSubtaskType.id == ty["id"]).first()
            if not existing:
                db.add(MstSubtaskType(**ty))

        db.commit()
        print("Initial seed data inserted successfully.")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
