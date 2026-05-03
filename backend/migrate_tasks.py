import os

import MySQLdb
from dotenv import load_dotenv


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def column_exists(cursor, column_name):
    cursor.execute(
        """
        SELECT COUNT(*) AS count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=%s AND TABLE_NAME='tasks' AND COLUMN_NAME=%s
        """,
        (os.getenv("DB_NAME", "todo_app"), column_name),
    )
    return cursor.fetchone()[0] > 0


def index_exists(cursor, index_name):
    cursor.execute(
        """
        SELECT COUNT(*) AS count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA=%s AND TABLE_NAME='tasks' AND INDEX_NAME=%s
        """,
        (os.getenv("DB_NAME", "todo_app"), index_name),
    )
    return cursor.fetchone()[0] > 0


def main():
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "3306")

    if ":" in db_host:
        db_host, db_port = db_host.split(":", 1)

    connection = MySQLdb.connect(
        host=db_host,
        port=int(db_port),
        user=os.getenv("DB_USER", "root"),
        passwd=os.getenv("DB_PASSWORD", ""),
        db=os.getenv("DB_NAME", "todo_app"),
    )

    cursor = connection.cursor()

    migrations = [
        ("description", "ALTER TABLE tasks ADD COLUMN description TEXT NULL AFTER title"),
        (
            "category",
            "ALTER TABLE tasks ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'other' AFTER description",
        ),
        (
            "scheduled_at",
            "ALTER TABLE tasks ADD COLUMN scheduled_at DATETIME NULL AFTER category",
        ),
        (
            "start_datetime",
            "ALTER TABLE tasks ADD COLUMN start_datetime DATETIME NULL AFTER category",
        ),
        (
            "end_datetime",
            "ALTER TABLE tasks ADD COLUMN end_datetime DATETIME NULL AFTER start_datetime",
        ),
        (
            "created_at",
            "ALTER TABLE tasks ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER completed",
        ),
        (
            "completed_at",
            "ALTER TABLE tasks ADD COLUMN completed_at DATETIME NULL AFTER created_at",
        ),
    ]

    for column_name, statement in migrations:
        if not column_exists(cursor, column_name):
            cursor.execute(statement)

    cursor.execute("UPDATE tasks SET category='other' WHERE category IS NULL OR category=''")
    cursor.execute(
        "UPDATE tasks SET scheduled_at=COALESCE(created_at, NOW()) WHERE scheduled_at IS NULL"
    )
    cursor.execute("ALTER TABLE tasks MODIFY scheduled_at DATETIME NOT NULL")

    # populate new start/end columns from existing scheduled_at if present
    cursor.execute("UPDATE tasks SET start_datetime = scheduled_at WHERE start_datetime IS NULL")
    cursor.execute("UPDATE tasks SET end_datetime = start_datetime WHERE end_datetime IS NULL")
    cursor.execute("ALTER TABLE tasks MODIFY start_datetime DATETIME NOT NULL")

    if not index_exists(cursor, "tasks_user_schedule_idx"):
        cursor.execute("CREATE INDEX tasks_user_schedule_idx ON tasks (user_id, scheduled_at)")

    if not index_exists(cursor, "tasks_user_completed_idx"):
        cursor.execute("CREATE INDEX tasks_user_completed_idx ON tasks (user_id, completed)")

    connection.commit()
    cursor.close()
    connection.close()
    print("tasks scheduling migration complete")


if __name__ == "__main__":
    main()
