"""Create and manage the clinician accounts that may sign in to the app.

There is no sign-up page: an administrator checks a clinician's certification, then
creates their account here. Run from the project folder with the project environment:

  python manage_users.py add <email>        create an account (asks for name, licence, password)
  python manage_users.py list                  show every account
  python manage_users.py disable <email>    stop an account signing in, and sign it out
  python manage_users.py enable <email>     allow a disabled account to sign in again
  python manage_users.py set-password <email>
"""

from __future__ import annotations

import argparse
import getpass
import sqlite3
import sys

import auth
import database


def ask(prompt: str) -> str:
    """Ask for a value until a non-empty one is given."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("This is required.")


def ask_password() -> str:
    """Ask for a new password twice, without showing it, until it is long enough and both match."""
    while True:
        password = getpass.getpass(f"Password (at least {auth.MIN_PASSWORD_LENGTH} characters): ")
        if len(password) < auth.MIN_PASSWORD_LENGTH:
            print("That password is too short.")
            continue
        if getpass.getpass("Repeat password: ") != password:
            print("The passwords do not match.")
            continue
        return password


def add_user(email: str) -> None:
    if "@" not in email:
        sys.exit(f"'{email}' is not an email address.")
    full_name = ask("Full name (shown in the app, e.g. Dr Ada Obi): ")
    licence_number = ask("Medical licence or registration number: ")
    password_hash = auth.hash_password(ask_password())
    with database.connect() as connection:
        try:
            database.insert_user(connection, email, full_name, licence_number, password_hash)
        except sqlite3.IntegrityError:
            sys.exit(f"An account for '{email}' already exists.")
    print(f"Created account '{email}' for {full_name}.")


def list_users() -> None:
    with database.connect() as connection:
        users = database.list_users(connection)
    if not users:
        print("No accounts yet. Create one with: python manage_users.py add <email>")
        return
    print(f"{'EMAIL':<28} {'NAME':<28} {'LICENCE':<18} {'STATUS':<9} CREATED")
    for user in users:
        status = "active" if user["active"] else "disabled"
        print(f"{user['email']:<28} {user['full_name']:<28} {user['licence_number']:<18} {status:<9} {user['created_at']}")


def change_user(email: str, message: str, **fields) -> None:
    """Update an account and sign it out everywhere, so the change applies straight away."""
    with database.connect() as connection:
        if not database.update_user(connection, email, **fields):
            sys.exit(f"There is no account for '{email}'.")
        database.delete_user_sessions(connection, email)
    print(message)


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage clinician accounts for the breast cancer prediction app.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("add", "disable", "enable", "set-password"):
        commands.add_parser(name).add_argument("email")
    commands.add_parser("list")
    args = parser.parse_args()

    # Make sure the users and sessions tables exist, even before the server has first run.
    database.init_db()
    if args.command == "add":
        add_user(args.email)
    elif args.command == "list":
        list_users()
    elif args.command == "disable":
        change_user(args.email, f"Disabled '{args.email}' and signed it out.", active=0)
    elif args.command == "enable":
        change_user(args.email, f"Enabled '{args.email}'.", active=1)
    elif args.command == "set-password":
        change_user(args.email, f"Changed the password for '{args.email}' and signed it out.",
                    password_hash=auth.hash_password(ask_password()))


if __name__ == "__main__":
    main()
