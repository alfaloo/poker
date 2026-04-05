#!/usr/bin/env python3
"""Add 1000 balance to a user by username."""

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

DATABASE_URL = os.environ["DATABASE_URL_UNPOOLED"]


def add_balance(username: str, amount: int = 1000):
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET balance = balance + %s WHERE username = %s RETURNING username, balance",
                (amount, username),
            )
            row = cur.fetchone()
            if row is None:
                print(f"User '{username}' not found.")
                return
            conn.commit()
            print(f"Updated '{row[0]}': new balance = {row[1]}")
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <username>")
        sys.exit(1)
    add_balance(sys.argv[1])
