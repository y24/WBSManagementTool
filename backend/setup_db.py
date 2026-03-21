import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys

# データベース設定
DB_HOST = "localhost"
DB_PORT = "5432"
DB_USER = "postgres"
DB_PASS = "admin"
DB_NAME = "wbs_db"
MAINTENANCE_DB = "postgres"  # DB作成のために接続するデフォルトDB

def create_database():
    print(f"PostgreSQLサーバー ({DB_HOST}:{DB_PORT}) に接続しています...")
    try:
        # postgres（デフォルトデータベース）に接続
        conn = psycopg2.connect(
            dbname=MAINTENANCE_DB,
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT
        )
        
        # データベース作成時はオートコミットを有効にする必要がある
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # データベースが既に存在するかチェック
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{DB_NAME}'")
        exists = cur.fetchone()

        if exists:
            print(f"データベース '{DB_NAME}' は既に存在します。")
        else:
            # データベースを作成
            print(f"データベース '{DB_NAME}' を作成しています...")
            cur.execute(f"CREATE DATABASE {DB_NAME} ENCODING 'UTF8'")
            print(f"データベース '{DB_NAME}' の作成が完了しました。")

        cur.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"エラー: PostgreSQLサーバーへの接続に失敗しました。\n詳細: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"エラー: 予期せぬエラーが発生しました。\n詳細: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_database()
