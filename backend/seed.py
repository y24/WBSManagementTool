import psycopg2
from app.database import SessionLocal
from app.models import MstStatus, MstSubtaskType

def seed_data():
    db = SessionLocal()
    try:
        # Seed statuses
        statuses = [
            {"id": 1, "status_name": "New", "color_code": "#9ca3af", "sort_order": 1, "is_active": True, "is_system_reserved": True},
            {"id": 2, "status_name": "In Progress", "color_code": "#53b2e7", "sort_order": 2, "is_active": True, "is_system_reserved": True},
            {"id": 3, "status_name": "In Review", "color_code": "#a973e2", "sort_order": 3, "is_active": True, "is_system_reserved": True},
            {"id": 4, "status_name": "Done", "color_code": "#51bf74", "sort_order": 4, "is_active": True, "is_system_reserved": True},
            {"id": 5, "status_name": "Blocked", "color_code": "#e45c5c", "sort_order": 5, "is_active": True, "is_system_reserved": True},
            {"id": 6, "status_name": "Pending", "color_code": "#dfb033", "sort_order": 6, "is_active": True, "is_system_reserved": True},
            {"id": 7, "status_name": "Removed", "color_code": "#d1d5db", "sort_order": 7, "is_active": True, "is_system_reserved": True},
        ]

        for st in statuses:
            existing = db.query(MstStatus).filter(MstStatus.id == st["id"]).first()
            if not existing:
                db.add(MstStatus(**st))
            else:
                # システム予約フラグのみ更新し、他の属性（名前、色、ソート順、有効フラグ）はユーザーの変更を優先して保持する
                existing.is_system_reserved = st.get("is_system_reserved", False)

        # Seed subtask types
        types = [
            {"id": 1, "type_name": "テスト計画", "sort_order": 1, "is_active": True},
            {"id": 2, "type_name": "テスト設計", "sort_order": 2, "is_active": True},
            {"id": 3, "type_name": "テスト実施", "sort_order": 3, "is_active": True},
            {"id": 4, "type_name": "テスト終了作業", "sort_order": 4, "is_active": True},
            {"id": 5, "type_name": "テスト準備", "sort_order": 5, "is_active": True},
            {"id": 6, "type_name": "テスト環境構築", "sort_order": 6, "is_active": True},
            {"id": 7, "type_name": "データ作成", "sort_order": 7, "is_active": True},
            {"id": 8, "type_name": "データ投入", "sort_order": 8, "is_active": True},
        ]

        for ty in types:
            existing = db.query(MstSubtaskType).filter(MstSubtaskType.id == ty["id"]).first()
            if not existing:
                db.add(MstSubtaskType(**ty))
            # 既存のレコードは更新せず、ユーザーの設定（名前、ソート順、有効フラグ）を保持する

        # シードリストに含まれないレコードを自動的に非アクティブ化する処理を削除
        # (ユーザーが追加したカスタム種別を保持するため)

        db.commit()
        print("Initial seed data inserted successfully.")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
