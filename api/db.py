"""
db.py — MySQL connection helper
"""
import pymysql

DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",
    "password": "",           # XAMPP default has no password
    "database": "airwatch_eswatini",
    "charset":  "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

def get_connection():
    return pymysql.connect(**DB_CONFIG)