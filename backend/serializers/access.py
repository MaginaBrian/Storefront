from access import ALL
from serializers.base import Serializer, ValidationError


class RoleSerializer(Serializer):
    def validate(self):
        name = self.text("name")
        if not name:
            raise ValidationError("Enter a role name")
        raw = self.raw("permissions")
        if not isinstance(raw, list) or not raw:
            raise ValidationError("Select at least one permission")
        permissions = []
        for item in raw:
            key = str(item or "").strip()
            if key in ALL and key not in permissions:
                permissions.append(key)
        if not permissions:
            raise ValidationError("Select at least one permission")
        return {
            "name": name[:80],
            "description": self.text("description")[:400],
            "category": "store",
            "permissions": permissions,
        }
