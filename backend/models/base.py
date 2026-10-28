"""Table access shared by the store models."""

from db import connect, query


class Model:
    table = ""
    pk = "id"
    order = "id DESC"

    @classmethod
    def all(cls, order=None):
        return query(f"SELECT * FROM {cls.table} ORDER BY {order or cls.order}")

    @classmethod
    def get(cls, key):
        rows = query(f"SELECT * FROM {cls.table} WHERE {cls.pk} = ?", (key,))
        return rows[0] if rows else None

    @classmethod
    def columns(cls, names, key):
        listed = ", ".join(names)
        rows = query(f"SELECT {listed} FROM {cls.table} WHERE {cls.pk} = ?", (key,))
        return rows[0] if rows else None
