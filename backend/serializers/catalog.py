import csv
import io
import json
import zipfile
from xml.etree import ElementTree

from serializers.base import Serializer, ValidationError


def product_handle(title, product_id):
    handle = "".join(ch.lower() if ch.isalnum() else "-" for ch in title).strip("-")
    handle = "-".join(part for part in handle.split("-") if part)
    return handle or f"product-{product_id}"


class ProductCreateSerializer(Serializer):
    def validate(self):
        title = self.text("title")
        if not title:
            raise ValidationError("Title is required")
        price = self.integer("price", 0)
        stock = self.integer("stock", 0)
        if price is None or stock is None or price < 0 or stock < 0:
            raise ValidationError("Price and stock must be numbers")
        extra = self.raw("extra") if isinstance(self.raw("extra"), dict) else {}
        try:
            weight = int(extra.get("weight_g") if extra.get("weight_g") not in (None, "") else 0)
        except (TypeError, ValueError):
            weight = None
        if weight is None or weight < 0:
            weight = 0
        tags = [str(tag).strip() for tag in self.raw("tags") or [] if str(tag).strip()]
        fields = [str(name).strip() for name in self.raw("fields") or [] if str(name).strip()]
        collections = []
        for item in self.raw("collections") or []:
            try:
                collections.append(int(item))
            except (TypeError, ValueError):
                continue
        vendor = self.data.get("vendor") if "vendor" in self.data else "Maison"
        return {
            "title": title,
            "price": price,
            "stock": stock,
            "status": self.choice("status", ("active", "draft", "archived"), "active"),
            "description": str(self.raw("description") or ""),
            "category": self.text("category"),
            "product_type": self.text("product_type"),
            "vendor": str(vendor or "").strip(),
            "color": self.text("color"),
            "media": self.text("media"),
            "extra": extra,
            "tags": tags,
            "fields": fields,
            "collections": collections,
            "weight": weight,
            "tracked": 1 if extra.get("tracked", True) else 0,
            "physical": 1 if extra.get("physical", True) else 0,
            "continue_selling": 1 if extra.get("continue_selling") else 0,
            "sku": str(extra.get("sku") or "").strip() or None,
            "variant": str(extra.get("variant") or "").strip() or "Default",
        }


class CollectionCreateSerializer(Serializer):
    def validate(self):
        title = self.text("title")
        if not title:
            raise ValidationError("Title is required")
        names = []
        for item in self.raw("products") or []:
            name = str(item or "").strip()
            if name and name not in names:
                names.append(name)
        single = self.text("product")
        if single and single not in names:
            names.append(single)
        channels = []
        for item in self.raw("channels") or ["Online Store", "Agentic"]:
            name = str(item or "").strip()
            if name and name not in channels:
                channels.append(name)
        image = str(self.raw("image") or "")
        if len(image) > 400_000:
            image = ""
        return {
            "title": title,
            "conditions": self.text("conditions") or None,
            "names": names,
            "channels": channels,
            "description": str(self.raw("description") or ""),
            "image": image,
            "theme": str(self.raw("theme") or "Default collection"),
            "seo_title": str(self.raw("seo_title") or ""),
            "seo_description": str(self.raw("seo_description") or ""),
            "sort": str(self.raw("sort") or "Best selling"),
            "excludes": str(self.raw("excludes") or ""),
        }


class InventoryCreateSerializer(Serializer):
    def validate(self):
        product = self.text("product")
        if not product:
            raise ValidationError("Product is required")
        on_hand = self.integer("on_hand", 0)
        if on_hand is None:
            raise ValidationError("On hand must be a number")
        if on_hand < 0:
            raise ValidationError("On hand must be positive")
        return {"product": product, "variant": self.text("variant") or "Default", "on_hand": on_hand}


def sheet_rows(data):
    if data[:2] == b"PK":
        return xlsx_rows(data)
    if data[:8] == bytes.fromhex("D0CF11E0A1B11AE1"):
        raise ValidationError("Save this workbook as CSV or .xlsx. The older .xls format is not read.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError("That file is not a CSV or .xlsx workbook.") from exc
    return list(csv.reader(io.StringIO(text)))


def xlsx_rows(data):
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    tag = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    try:
        book = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValidationError("That .xlsx file could not be read.") from exc
    with book:
        names = book.namelist()
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ElementTree.fromstring(book.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", ns):
                shared.append("".join(node.text or "" for node in item.iter(f"{tag}t")))
        sheet_name = next((item for item in names if item.startswith("xl/worksheets/sheet")), "")
        if not sheet_name:
            raise ValidationError("That workbook has no sheet.")
        root = ElementTree.fromstring(book.read(sheet_name))
    rows = []
    for row in root.findall("m:sheetData/m:row", ns):
        cells = []
        for cell in row.findall("m:c", ns):
            ref = cell.attrib.get("r", "")
            col = 0
            for char in ref:
                if char.isalpha():
                    col = col * 26 + ord(char.upper()) - 64
                else:
                    break
            while len(cells) < max(col - 1, 0):
                cells.append("")
            node = cell.find("m:v", ns)
            value = node.text if node is not None and node.text else ""
            if cell.attrib.get("t") == "s" and value.isdigit():
                index = int(value)
                value = shared[index] if index < len(shared) else ""
            cells.append(value)
        rows.append(cells)
    return rows


def inventory_updates(table):
    if not table or not any(cell.strip() for cell in table[0]):
        raise ValidationError("The file is empty.")
    headers = [cell.strip().lower() for cell in table[0]]

    def pick(row, *keys):
        for key in keys:
            if key in headers:
                index = headers.index(key)
                if index < len(row) and str(row[index]).strip():
                    return str(row[index]).strip()
        return ""

    updates = []
    for raw in table[1:]:
        if not any(str(cell).strip() for cell in raw):
            continue
        product = pick(raw, "product", "title")
        variant = pick(raw, "variant", "option1 value", "option value") or "Default"
        sku = pick(raw, "sku")
        if sku.lower() == "no sku":
            sku = ""
        quantity = pick(raw, "on hand", "on hand (new)", "on_hand")
        if not quantity:
            continue
        try:
            on_hand = int(float(quantity))
        except ValueError as exc:
            label = product or sku or "A row"
            raise ValidationError(f"{label} has an on-hand value that is not a number.") from exc
        if on_hand < 0:
            raise ValidationError("On hand must be positive.")
        if not product and not sku:
            raise ValidationError("Each row needs a product or a SKU.")
        updates.append({"product": product, "variant": variant, "sku": sku, "on_hand": on_hand})
    if not updates:
        raise ValidationError("The file needs Product, Variant, and On hand columns.")
    return updates


class PurchaseOrderCreateSerializer(Serializer):
    def validate(self):
        supplier = self.text("supplier")
        if not supplier:
            raise ValidationError("Supplier is required")
        lines = self.raw("lines") if isinstance(self.raw("lines"), list) else []
        return {
            "supplier": supplier,
            "destination": self.text("destination"),
            "reference": self.kept("reference", 255),
            "note": self.kept("note", 5000),
            "terms": self.text("terms"),
            "currency": self.text("currency") or "KES",
            "tags": self.kept("tags", 40),
            "lines": lines,
        }


class TransferCreateSerializer(Serializer):
    def validate(self):
        origin = self.text("origin")
        destination = self.text("destination")
        if not origin or not destination:
            raise ValidationError("Origin and destination are required")
        return {
            "origin": origin,
            "destination": destination,
            "reference": self.text("reference"),
            "note": self.text("note"),
            "tags": self.text("tags"),
            "lines": self.raw("lines") if isinstance(self.raw("lines"), list) else [],
            "purchase_order": self.text("purchase_order"),
        }


class GiftCardCreateSerializer(Serializer):
    def validate(self):
        balance = self.integer("balance", 0)
        if balance is None:
            raise ValidationError("Balance must be a number")
        if balance < 0:
            raise ValidationError("Balance must be positive")
        code = self.text("code") or f"GIFT{balance or 1000}"
        return {
            "code": code,
            "customer": self.text("customer") or None,
            "balance": balance,
            "note": self.text("note"),
            "expires": self.text("expires"),
        }


def po_text(body, key, limit):
    return str(body.get(key) or "")[:limit]
