"""Turn a request body into cleaned fields."""


class ValidationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


class Serializer:
    def __init__(self, data=None):
        self.data = data if isinstance(data, dict) else {}

    def raw(self, key, default=None):
        return self.data.get(key, default)

    def text(self, key, default="", limit=None):
        value = self.data.get(key)
        text = str(default if value is None else value).strip()
        return text[:limit] if limit else text

    def kept(self, key, limit):
        value = self.data.get(key)
        return str("" if value is None else value)[:limit]

    def choice(self, key, allowed, default):
        value = self.data.get(key)
        return value if value in allowed else default

    def integer(self, key, default=0):
        raw = self.data.get(key)
        try:
            return int(raw if raw not in (None, "") else default)
        except (TypeError, ValueError):
            return None

    def flag(self, key, default=False):
        if key not in self.data:
            return bool(default)
        return bool(self.data.get(key))

    @classmethod
    def load(cls, data):
        return cls(data).validate()

    def validate(self):
        raise NotImplementedError
