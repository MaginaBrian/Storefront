"""Store roles and the people they are assigned to."""

import json

from access import ALL, APPS, AREAS
from db import connect, query
from serializers.base import ValidationError

STORE = "Maison"

SEEDED_ROLES = [
    {
        "name": "Administrator",
        "description": "Full access to the store. Piacì manages this role, so it cannot be edited or deleted.",
        "managed": 1,
        "permissions": ALL,
    },
    {
        "name": "Merchandiser",
        "description": "Keeps the catalog current: products, variants, prices, and inventory.",
        "managed": 0,
        "permissions": ["home", "products"],
    },
    {
        "name": "Support",
        "description": "Looks up who bought and the orders they placed.",
        "managed": 0,
        "permissions": ["home", "orders", "customers"],
    },
]

SEEDED_STAFF = [
    ("Store owner", "hello@maison.co.ke", 1, "Administrator"),
    ("Merchandiser", "merchandiser@maison.co.ke", 0, "Merchandiser"),
    ("Support", "support@maison.co.ke", 0, "Support"),
]


def _perms(raw):
    try:
        data = json.loads(raw or "[]")
    except (TypeError, json.JSONDecodeError):
        data = []
    return [key for key in data if key in ALL]


def _role(row, users=0):
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"] or "",
        "category": row["category"],
        "managed": bool(row["managed"]),
        "permissions": _perms(row["permissions"]),
        "users": users,
    }


def _load_staff(db, staff_id):
    row = db.execute("SELECT * FROM staff WHERE id = ?", (staff_id,)).fetchone()
    if not row:
        return None
    person = dict(row)
    roles = [
        dict(item) for item in db.execute(
            """SELECT r.* FROM roles r
               JOIN staff_roles s ON s.role_id = r.id
               WHERE s.staff_id = ? ORDER BY r.name""",
            (staff_id,),
        )
    ]
    stores = [item["store"] for item in db.execute("SELECT store FROM staff_stores WHERE staff_id = ? ORDER BY store", (staff_id,))]
    if person["owner"]:
        permissions = list(ALL)
    else:
        permissions = []
        for role in roles:
            for key in _perms(role["permissions"]):
                if key not in permissions:
                    permissions.append(key)
    return {
        "id": person["id"],
        "name": person["name"],
        "email": person["email"],
        "owner": bool(person["owner"]),
        "roles": [_role(role) for role in roles],
        "stores": stores,
        "permissions": permissions,
    }


def acting(staff_id):
    with connect() as db:
        if staff_id in (None, ""):
            owner = db.execute("SELECT id FROM staff WHERE owner = 1 ORDER BY id LIMIT 1").fetchone()
            if not owner:
                return {"id": None, "name": "Store owner", "email": "", "owner": True, "roles": [], "stores": [STORE], "permissions": list(ALL)}
            return _load_staff(db, owner["id"])
        try:
            key = int(staff_id)
        except (TypeError, ValueError):
            return None
        return _load_staff(db, key)


def session(staff_id):
    current = acting(staff_id)
    if current is None:
        raise ValidationError("This user was not found", 404)
    people = query("SELECT id, name, email, owner FROM staff ORDER BY owner DESC, name")
    for person in people:
        person["owner"] = bool(person["owner"])
    return {
        "id": current["id"],
        "name": current["name"],
        "email": current["email"],
        "owner": current["owner"],
        "roles": [{"id": role["id"], "name": role["name"]} for role in current["roles"]],
        "permissions": current["permissions"],
        "stores": current["stores"],
        "can_manage": current["owner"] or "users" in current["permissions"],
        "people": people,
        "areas": [{"key": key, "label": label, "detail": detail} for key, label, detail in AREAS],
        "apps": [{"key": key, "label": label, "detail": detail} for key, label, detail in APPS],
        "store": STORE,
    }


class Role:
    @classmethod
    def listing(cls):
        rows = []
        for row in query("SELECT * FROM roles ORDER BY managed DESC, name"):
            count = query("SELECT COUNT(*) AS n FROM staff_roles WHERE role_id = ?", (row["id"],))[0]["n"]
            rows.append(_role(row, count))
        return rows

    @classmethod
    def get(cls, role_id):
        rows = query("SELECT * FROM roles WHERE id = ?", (role_id,))
        if not rows:
            return None
        count = query("SELECT COUNT(*) AS n FROM staff_roles WHERE role_id = ?", (role_id,))[0]["n"]
        return _role(rows[0], count)

    @classmethod
    def create(cls, fields):
        with connect() as db:
            taken = db.execute("SELECT 1 FROM roles WHERE lower(name) = lower(?)", (fields["name"],)).fetchone()
            if taken:
                raise ValidationError("A role with this name already exists")
            cur = db.execute(
                "INSERT INTO roles (name, description, category, managed, permissions) VALUES (?, ?, 'store', 0, ?)",
                (fields["name"], fields["description"], json.dumps(fields["permissions"])),
            )
            role_id = cur.lastrowid
        return cls.get(role_id)

    @classmethod
    def update(cls, role_id, fields):
        with connect() as db:
            row = db.execute("SELECT * FROM roles WHERE id = ?", (role_id,)).fetchone()
            if not row:
                raise ValidationError("Role not found", 404)
            if row["managed"]:
                raise ValidationError("This role is managed by Piacì")
            taken = db.execute(
                "SELECT 1 FROM roles WHERE lower(name) = lower(?) AND id != ?",
                (fields["name"], role_id),
            ).fetchone()
            if taken:
                raise ValidationError("A role with this name already exists")
            db.execute(
                "UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?",
                (fields["name"], fields["description"], json.dumps(fields["permissions"]), role_id),
            )
        return cls.get(role_id)

    @classmethod
    def duplicate(cls, role_id, name):
        source = cls.get(role_id)
        if not source:
            raise ValidationError("Role not found", 404)
        if source["managed"]:
            raise ValidationError("Roles managed by Piacì cannot be duplicated")
        label = name.strip() if name else f"{source['name']} copy"
        return cls.create({
            "name": label[:80],
            "description": source["description"],
            "permissions": source["permissions"],
        })

    @classmethod
    def delete(cls, role_id):
        with connect() as db:
            row = db.execute("SELECT * FROM roles WHERE id = ?", (role_id,)).fetchone()
            if not row:
                raise ValidationError("Role not found", 404)
            if row["managed"]:
                raise ValidationError("This role is managed by Piacì")
            assigned = db.execute("SELECT COUNT(*) AS n FROM staff_roles WHERE role_id = ?", (role_id,)).fetchone()["n"]
            if assigned:
                raise ValidationError("Remove this role from users before deleting it")
            db.execute("DELETE FROM roles WHERE id = ?", (role_id,))
        return {"deleted": True}


class Staff:
    @classmethod
    def listing(cls):
        people = []
        for row in query("SELECT * FROM staff ORDER BY owner DESC, name"):
            person = _load_open(row["id"])
            people.append(person)
        return people

    @classmethod
    def assign(cls, staff_id, role_id):
        with connect() as db:
            person = db.execute("SELECT id FROM staff WHERE id = ?", (staff_id,)).fetchone()
            role = db.execute("SELECT id FROM roles WHERE id = ?", (role_id,)).fetchone()
            if not person or not role:
                raise ValidationError("Choose a user and a role")
            db.execute("INSERT OR IGNORE INTO staff_roles (staff_id, role_id) VALUES (?, ?)", (staff_id, role_id))
        return _load_open(staff_id)

    @classmethod
    def remove(cls, staff_id, role_id):
        with connect() as db:
            person = db.execute("SELECT * FROM staff WHERE id = ?", (staff_id,)).fetchone()
            role = db.execute("SELECT * FROM roles WHERE id = ?", (role_id,)).fetchone()
            if not person or not role:
                raise ValidationError("Choose a user and a role")
            if person["owner"] and role["name"] == "Administrator":
                raise ValidationError("The store owner keeps the Administrator role")
            db.execute("DELETE FROM staff_roles WHERE staff_id = ? AND role_id = ?", (staff_id, role_id))
        return _load_open(staff_id)

    @classmethod
    def stores(cls, staff_id, names):
        with connect() as db:
            person = db.execute("SELECT * FROM staff WHERE id = ?", (staff_id,)).fetchone()
            if not person:
                raise ValidationError("User not found", 404)
            chosen = [STORE] if STORE in names else []
            if person["owner"] and not chosen:
                raise ValidationError("The store owner keeps access to Maison")
            db.execute("DELETE FROM staff_stores WHERE staff_id = ?", (staff_id,))
            db.executemany("INSERT INTO staff_stores (staff_id, store) VALUES (?, ?)", [(staff_id, name) for name in chosen])
        return _load_open(staff_id)


def _load_open(staff_id):
    with connect() as db:
        return _load_staff(db, staff_id)


def ensure_staff(db):
    db.execute(
        """CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT 'store',
            managed INTEGER NOT NULL DEFAULT 0,
            permissions TEXT NOT NULL DEFAULT '[]'
        )"""
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            owner INTEGER NOT NULL DEFAULT 0
        )"""
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS staff_roles (
            staff_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            PRIMARY KEY (staff_id, role_id)
        )"""
    )
    db.execute(
        """CREATE TABLE IF NOT EXISTS staff_stores (
            staff_id INTEGER NOT NULL,
            store TEXT NOT NULL,
            PRIMARY KEY (staff_id, store)
        )"""
    )
    if db.execute("SELECT COUNT(*) FROM roles").fetchone()[0]:
        return
    ids = {}
    for role in SEEDED_ROLES:
        cur = db.execute(
            "INSERT INTO roles (name, description, category, managed, permissions) VALUES (?, ?, 'store', ?, ?)",
            (role["name"], role["description"], role["managed"], json.dumps(role["permissions"])),
        )
        ids[role["name"]] = cur.lastrowid
    for name, email, owner, role_name in SEEDED_STAFF:
        cur = db.execute(
            "INSERT INTO staff (name, email, owner) VALUES (?, ?, ?)",
            (name, email, owner),
        )
        staff_id = cur.lastrowid
        db.execute("INSERT INTO staff_roles (staff_id, role_id) VALUES (?, ?)", (staff_id, ids[role_name]))
        db.execute("INSERT INTO staff_stores (staff_id, store) VALUES (?, ?)", (staff_id, STORE))
