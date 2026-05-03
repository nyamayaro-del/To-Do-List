from functools import wraps
import datetime
import os
import re

import jwt
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_mysqldb import MySQL
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})

# ---------------- MYSQL CONFIG ----------------
db_host = os.getenv("DB_HOST", "localhost")
db_port = os.getenv("DB_PORT", "3306")

if ":" in db_host:
    db_host, db_port = db_host.split(":", 1)

app.config["MYSQL_HOST"] = db_host
if db_port and db_port.isdigit():
    app.config["MYSQL_PORT"] = int(db_port)

app.config["MYSQL_USER"] = os.getenv("DB_USER", "root")
app.config["MYSQL_PASSWORD"] = os.getenv("DB_PASSWORD", "")
app.config["MYSQL_DB"] = os.getenv("DB_NAME", "todo_app")
app.config["MYSQL_CURSORCLASS"] = "DictCursor"

secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    raise RuntimeError("SECRET_KEY is required in .env")
app.config["SECRET_KEY"] = secret_key

mysql = MySQL(app)

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
TASK_CATEGORIES = {
    "education",
    "exercise",
    "food",
    "personal",
    "work",
    "health",
    "finance",
    "other",
}


def to_iso(value):
    if value is None:
        return None
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    return str(value)


def parse_task_datetime(value):
    if not value:
        return None

    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def normalize_task(task):
    return {
        "id": task["id"],
        "title": task["title"],
        "description": task.get("description") or "",
        "category": task.get("category") or "other",
        "start_datetime": to_iso(task.get("start_datetime") or task.get("scheduled_at")),
        "end_datetime": to_iso(task.get("end_datetime") or task.get("scheduled_at")),
        "created_at": to_iso(task.get("created_at")),
        "completed_at": to_iso(task.get("completed_at")),
        "completed": bool(task.get("completed", False)),
    }


def create_token(user):
    now = datetime.datetime.utcnow()
    return jwt.encode(
        {
            "sub": str(user["id"]),
            "username": user["username"],
            "iat": now,
            "exp": now + datetime.timedelta(hours=2),
        },
        app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def auth_required(route):
    @wraps(route)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"message": "Token missing"}), 401

        try:
            payload = jwt.decode(parts[1], app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        cur = mysql.connection.cursor()
        cur.execute("SELECT id, username FROM users WHERE id=%s", (payload["sub"],))
        user = cur.fetchone()
        cur.close()

        if not user:
            return jsonify({"message": "User not found"}), 401

        g.current_user = user
        return route(*args, **kwargs)

    return wrapper


# ---------------- REGISTER ----------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"message": "Username, email, and password are required"}), 400

    if not EMAIL_PATTERN.match(email):
        return jsonify({"message": "Enter a valid email address"}), 400

    cur = mysql.connection.cursor()
    cur.execute(
        "SELECT username, email FROM users WHERE username=%s OR email=%s",
        (username, email),
    )
    user = cur.fetchone()

    if user:
        cur.close()
        if user["email"] == email:
            return jsonify({"message": "Email is already in use"}), 400
        return jsonify({"message": "Username is already in use"}), 400

    cur.execute(
        "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
        (username, email, generate_password_hash(password)),
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "User created"}), 201


# ---------------- LOGIN ----------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    cur = mysql.connection.cursor()
    cur.execute("SELECT id, username, password FROM users WHERE username=%s", (username,))
    user = cur.fetchone()
    cur.close()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"message": "Invalid credentials"}), 401

    return jsonify(
        {
            "token": create_token(user),
            "user": {"id": user["id"], "username": user["username"]},
        }
    )


# ---------------- PROTECTED ROUTE ----------------
@app.route("/protected", methods=["GET"])
@auth_required
def protected():
    return jsonify(
        {
            "message": "Access granted",
            "user": g.current_user,
        }
    )


# ---------------- CREATE TASK ----------------
@app.route("/tasks", methods=["POST"])
@auth_required
def create_task():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    category = (data.get("category") or "other").strip().lower()
    start_datetime = parse_task_datetime(data.get("start_datetime") or data.get("scheduled_at"))
    end_datetime = parse_task_datetime(data.get("end_datetime") or data.get("scheduled_at"))

    if not title:
        return jsonify({"message": "Task title is required"}), 400

    if not start_datetime:
        return jsonify({"message": "Task start date and time are required"}), 400
    if not end_datetime:
        return jsonify({"message": "Task end date and time are required"}), 400
    if end_datetime < start_datetime:
        return jsonify({"message": "End datetime must be after start datetime"}), 400

    if category not in TASK_CATEGORIES:
        return jsonify({"message": "Unsupported task category"}), 400

    cur = mysql.connection.cursor()
    cur.execute(
        """
        INSERT INTO tasks (user_id, title, description, category, start_datetime, end_datetime, completed)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (g.current_user["id"], title, description, category, start_datetime, end_datetime, False),
    )
    mysql.connection.commit()
    task_id = cur.lastrowid
    cur.execute(
        """
        SELECT id, title, description, category, start_datetime, end_datetime, created_at, completed_at, completed
        FROM tasks
        WHERE id=%s
        """,
        (task_id,),
    )
    task = cur.fetchone()
    cur.close()

    return jsonify(normalize_task(task)), 201


# ---------------- GET TASKS ----------------
@app.route("/tasks", methods=["GET"])
@auth_required
def get_tasks():
    cur = mysql.connection.cursor()
    cur.execute(
        """
        SELECT id, title, description, category, start_datetime, end_datetime, created_at, completed_at, completed
        FROM tasks
        WHERE user_id=%s
        ORDER BY start_datetime ASC, id DESC
        """,
        (g.current_user["id"],),
    )
    tasks = cur.fetchall()
    cur.close()

    return jsonify([normalize_task(task) for task in tasks])


# ---------------- UPDATE TASK ----------------
@app.route("/tasks/<int:task_id>", methods=["PUT"])
@auth_required
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    updates = []
    values = []

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"message": "Task title cannot be empty"}), 400
        updates.append("title=%s")
        values.append(title)

    if "description" in data:
        updates.append("description=%s")
        values.append((data.get("description") or "").strip())

    if "category" in data:
        category = (data.get("category") or "other").strip().lower()
        if category not in TASK_CATEGORIES:
            return jsonify({"message": "Unsupported task category"}), 400
        updates.append("category=%s")
        values.append(category)

    if "start_datetime" in data:
        start_datetime = parse_task_datetime(data.get("start_datetime"))
        if not start_datetime:
            return jsonify({"message": "Task start date and time are required"}), 400
        updates.append("start_datetime=%s")
        values.append(start_datetime)

    if "end_datetime" in data:
        end_datetime = parse_task_datetime(data.get("end_datetime"))
        if not end_datetime:
            return jsonify({"message": "Task end date and time are required"}), 400
        updates.append("end_datetime=%s")
        values.append(end_datetime)

    if "completed" in data:
        completed = bool(data.get("completed"))
        updates.append("completed=%s")
        values.append(completed)
        updates.append("completed_at=%s")
        values.append(datetime.datetime.utcnow() if completed else None)

    if not updates:
        return jsonify({"message": "No task changes provided"}), 400

    values.extend([task_id, g.current_user["id"]])

    cur = mysql.connection.cursor()
    cur.execute(
        f"UPDATE tasks SET {', '.join(updates)} WHERE id=%s AND user_id=%s",
        tuple(values),
    )
    mysql.connection.commit()

    if cur.rowcount == 0:
        cur.close()
        return jsonify({"message": "Task not found"}), 404

    cur.execute(
        """
        SELECT id, title, description, category, start_datetime, end_datetime, created_at, completed_at, completed
        FROM tasks
        WHERE id=%s AND user_id=%s
        """,
        (task_id, g.current_user["id"]),
    )
    task = cur.fetchone()
    cur.close()

    return jsonify(normalize_task(task))


# ---------------- DELETE TASK ----------------
@app.route("/tasks/<int:task_id>", methods=["DELETE"])
@auth_required
def delete_task(task_id):
    cur = mysql.connection.cursor()
    cur.execute(
        "DELETE FROM tasks WHERE id=%s AND user_id=%s",
        (task_id, g.current_user["id"]),
    )
    mysql.connection.commit()

    if cur.rowcount == 0:
        cur.close()
        return jsonify({"message": "Task not found"}), 404

    cur.close()
    return jsonify({"message": "Task deleted"})


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True)
