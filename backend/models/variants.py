"""Product options and the inventory row for each combination."""

import json

from serializers.base import ValidationError

MAX_OPTIONS = 3
MAX_VARIANTS = 2048

# Quantities on the five seeded products stay the same. Linen is split across sizes.
SEEDED_VARIANTS = {
    "Linen Overshirt": {
        "options": [{"name": "Size", "values": ["S", "M", "L"], "source": ""}],
        "rows": [("S", "", "", 5), ("M", "", "", 5), ("L", "", "", 4)],
    },
    "Leather Weekender": {
        "options": [{"name": "Color", "values": ["Black"], "source": "color"}],
        "rows": [("Black", "", "", None)],
    },
    "Canvas Tote": {"options": [], "rows": [("", "", "", None)]},
    "Brass Card Holder": {"options": [], "rows": [("", "", "", None)]},
    "Mwotaji - Vest": {
        "options": [{"name": "Color", "values": ["Black"], "source": "color"}],
        "rows": [("Black", "", "", None)],
    },
}


def read_extra(product):
    try:
        data = json.loads(product["extra"] or "{}")
    except (TypeError, json.JSONDecodeError):
        data = {}
    return data if isinstance(data, dict) else {}


def read_options(product):
    options = []
    for item in read_extra(product).get("options") or []:
        if isinstance(item, dict) and str(item.get("name") or "").strip():
            options.append({
                "name": str(item["name"]).strip(),
                "values": [str(value).strip() for value in item.get("values") or [] if str(value).strip()],
                "source": "color" if item.get("source") == "color" else "",
            })
    return options


def variant_label(parts):
    text = " / ".join(part for part in parts if part)
    return text or "Default"


def pad(parts):
    values = [str(part or "").strip() for part in list(parts)[:3]]
    return tuple((values + ["", "", ""])[:3])


def row_parts(row):
    return (row["option1"] or "", row["option2"] or "", row["option3"] or "")


def normalize_options(raw):
    if not raw:
        return []
    if not isinstance(raw, list):
        raise ValidationError("Options need a name and at least one value")
    if len(raw) > MAX_OPTIONS:
        raise ValidationError("A product can have up to 3 options")
    cleaned = []
    names = set()
    count = 1
    for item in raw:
        if not isinstance(item, dict):
            raise ValidationError("Options need a name and at least one value")
        name = str(item.get("name") or "").strip()
        if not name:
            raise ValidationError("Each option needs a name")
        if name.lower() in names:
            raise ValidationError(f"{name} is already an option")
        names.add(name.lower())
        values = []
        seen = set()
        for value in item.get("values") or []:
            text = str(value or "").strip()
            if not text or text.lower() in seen:
                continue
            seen.add(text.lower())
            values.append(text)
        if not values:
            raise ValidationError(f"Add a value for {name}")
        count *= len(values)
        cleaned.append({
            "name": name,
            "values": values,
            "source": "color" if item.get("source") == "color" else "",
        })
    if count > MAX_VARIANTS:
        raise ValidationError("A product can have up to 2,048 variants")
    return cleaned


def combinations(options):
    combos = [()]
    for option in options:
        combos = [prefix + (value,) for prefix in combos for value in option["values"]]
    return [pad(combo) for combo in combos]


def _rows(db, title):
    return [dict(row) for row in db.execute("SELECT * FROM inventory WHERE product = ? ORDER BY id", (title,))]


def _exists(rows, parts, skip_id=None):
    wanted = pad(parts)
    for row in rows:
        if skip_id is not None and row["id"] == skip_id:
            continue
        if pad(row_parts(row)) == wanted:
            return True
    return False


def insert_variant(db, title, parts, *, price, on_hand, weight=1000, location="Nairobi", tracked=1, physical=1, continue_selling=0, sku=None, barcode="", origin="", hs_code=""):
    option1, option2, option3 = pad(parts)
    qty = max(int(on_hand), 0)
    cur = db.execute(
        """INSERT INTO inventory
           (product, variant, sku, unavailable, committed, available, on_hand, incoming, price, weight, location, tracked, physical, continue_selling, option1, option2, option3, barcode, origin, hs_code)
           VALUES (?, ?, ?, 0, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (title, variant_label((option1, option2, option3)), sku or None, qty, qty, int(price), int(weight or 0), location or "Nairobi", 1 if tracked else 0, 1 if physical else 0, 1 if continue_selling else 0, option1, option2, option3, barcode or "", origin or "", hs_code or ""),
    )
    return cur.lastrowid


def sync_stock(db, title):
    total = db.execute("SELECT COALESCE(SUM(on_hand), 0) FROM inventory WHERE product = ?", (title,)).fetchone()[0]
    db.execute("UPDATE products SET stock = ? WHERE title = ?", (int(total), title))


def persist_options(db, product, options):
    extra = read_extra(product)
    extra["options"] = options
    color = product["color"] or ""
    for option in options:
        if option.get("source") == "color" or option["name"].lower() == "color":
            color = option["values"][0] if option["values"] else color
            break
    db.execute(
        "UPDATE products SET extra = ?, color = ? WHERE id = ?",
        (json.dumps(extra), color, product["id"]),
    )
    product["extra"] = json.dumps(extra)
    product["color"] = color


def _template(product, rows):
    row = rows[0] if rows else None
    return {
        "price": product["price"],
        "weight": row["weight"] if row else 1000,
        "location": row["location"] if row else "Nairobi",
        "tracked": row["tracked"] if row else 1,
        "physical": row["physical"] if row else 1,
        "continue_selling": row["continue_selling"] if row else 0,
    }


def _guard(count):
    if count > MAX_VARIANTS:
        raise ValidationError("A product can have up to 2,048 variants")


def create_for_product(db, product, fields, options):
    title = product["title"]
    barcode = str((fields.get("extra") or {}).get("barcode") or "")
    if not options:
        insert_variant(
            db, title, ("", "", ""),
            price=fields["price"], on_hand=fields["stock"], weight=fields["weight"],
            tracked=fields["tracked"], physical=fields["physical"], continue_selling=fields["continue_selling"],
            sku=fields["sku"], barcode=barcode,
        )
        return
    combos = combinations(options)
    for index, parts in enumerate(combos):
        insert_variant(
            db, title, parts,
            price=fields["price"], on_hand=fields["stock"], weight=fields["weight"],
            tracked=fields["tracked"], physical=fields["physical"], continue_selling=fields["continue_selling"],
            sku=fields["sku"] if index == 0 else None,
            barcode=barcode if index == 0 else "",
        )
    db.execute("UPDATE products SET stock = ? WHERE id = ?", (fields["stock"] * len(combos), product["id"]))
    persist_options(db, product, options)


def apply_initial_options(db, product, raw):
    if read_options(product):
        raise ValidationError("This product already has options. Add a value or another option.")
    options = normalize_options(raw)
    if not options:
        raise ValidationError("Add an option such as size or color")
    title = product["title"]
    rows = _rows(db, title)
    stock = sum(row["on_hand"] for row in rows) if rows else int(product["stock"] or 0)
    base = _template(product, rows)
    sku = rows[0]["sku"] if len(rows) == 1 else None
    barcode = rows[0]["barcode"] if len(rows) == 1 else ""
    db.execute("DELETE FROM inventory WHERE product = ?", (title,))
    combos = combinations(options)
    for index, parts in enumerate(combos):
        insert_variant(
            db, title, parts, price=base["price"], on_hand=stock if index == 0 else 0,
            weight=base["weight"], location=base["location"], tracked=base["tracked"],
            physical=base["physical"], continue_selling=base["continue_selling"],
            sku=sku if index == 0 else None, barcode=barcode if index == 0 else "",
        )
    persist_options(db, product, options)
    sync_stock(db, title)


def _option_index(options, name):
    key = str(name or "").strip().lower()
    for index, option in enumerate(options):
        if option["name"].lower() == key:
            return index
    raise ValidationError("That option is not on this product")


def add_option(db, product, raw):
    options = read_options(product)
    if len(options) >= MAX_OPTIONS:
        raise ValidationError("A product can have up to 3 options")
    added = normalize_options([raw])[0]
    if any(option["name"].lower() == added["name"].lower() for option in options):
        raise ValidationError(f"{added['name']} is already an option")
    rows = _rows(db, product["title"])
    width = len(options)
    planned = max(len(rows), 1) * len(added["values"])
    _guard(planned)
    base = _template(product, rows)
    originals = [row_parts(row)[:width] for row in rows]
    first, *rest = added["values"]
    if rows:
        for row, prior in zip(rows, originals):
            parts = pad(tuple(prior) + (first,))
            _rewrite(db, row, parts)
        for value in rest:
            for prior in originals:
                insert_variant(db, product["title"], tuple(prior) + (value,), price=base["price"], on_hand=0, weight=base["weight"], location=base["location"], tracked=base["tracked"], physical=base["physical"], continue_selling=base["continue_selling"])
    else:
        for parts in combinations([added]):
            insert_variant(db, product["title"], parts, price=base["price"], on_hand=0, weight=base["weight"], location=base["location"], tracked=base["tracked"], physical=base["physical"], continue_selling=base["continue_selling"])
    persist_options(db, product, options + [added])
    sync_stock(db, product["title"])


def _rewrite(db, row, parts, **changes):
    option1, option2, option3 = pad(parts)
    on_hand = changes.get("on_hand", row["on_hand"])
    unavailable = row["unavailable"]
    committed = row["committed"]
    available = max(int(on_hand) - unavailable - committed, 0)
    db.execute(
        "UPDATE inventory SET variant = ?, option1 = ?, option2 = ?, option3 = ?, on_hand = ?, available = ? WHERE id = ?",
        (variant_label((option1, option2, option3)), option1, option2, option3, int(on_hand), available, row["id"]),
    )


def add_value(db, product, name, value):
    options = read_options(product)
    if not options:
        raise ValidationError("Add an option before adding values")
    index = _option_index(options, name)
    text = str(value or "").strip()
    if not text:
        raise ValidationError("Enter a value")
    if any(current.lower() == text.lower() for current in options[index]["values"]):
        raise ValidationError(f"{text} is already a {options[index]['name']} value")
    rows = _rows(db, product["title"])
    others = [option["values"] for position, option in enumerate(options) if position != index]
    combos = [()]
    for values in others:
        combos = [prefix + (item,) for prefix in combos for item in values]
    _guard(len(rows) + len(combos))
    base = _template(product, rows)
    for combo in combos:
        parts = []
        cursor = 0
        for position in range(len(options)):
            if position == index:
                parts.append(text)
            else:
                parts.append(combo[cursor])
                cursor += 1
        if not _exists(rows, parts):
            insert_variant(
                db, product["title"], parts, price=base["price"], on_hand=0,
                weight=base["weight"], location=base["location"], tracked=base["tracked"],
                physical=base["physical"], continue_selling=base["continue_selling"],
            )
    options[index]["values"].append(text)
    persist_options(db, product, options)
    sync_stock(db, product["title"])


def remove_value(db, product, name, value):
    options = read_options(product)
    index = _option_index(options, name)
    text = str(value or "").strip()
    if text not in options[index]["values"]:
        raise ValidationError(f"{text} is not a {options[index]['name']} value")
    if len(options[index]["values"]) == 1:
        raise ValidationError(f"Keep at least one {options[index]['name']} value, or remove the option")
    column = f"option{index + 1}"
    db.execute(f"DELETE FROM inventory WHERE product = ? AND {column} = ?", (product["title"], text))
    options[index]["values"] = [item for item in options[index]["values"] if item != text]
    persist_options(db, product, options)
    sync_stock(db, product["title"])


def rename_value(db, product, name, source, target):
    options = read_options(product)
    index = _option_index(options, name)
    source = str(source or "").strip()
    target = str(target or "").strip()
    if not target:
        raise ValidationError("Enter a value")
    if source not in options[index]["values"]:
        raise ValidationError(f"{source} is not a {options[index]['name']} value")
    if source == target:
        return
    if any(item.lower() == target.lower() for item in options[index]["values"] if item != source):
        raise ValidationError(f"{target} is already a {options[index]['name']} value")
    column = f"option{index + 1}"
    rows = [row for row in _rows(db, product["title"]) if row[column] == source]
    for row in rows:
        parts = list(row_parts(row))
        parts[index] = target
        option1, option2, option3 = pad(parts)
        db.execute(
            f"UPDATE inventory SET {column} = ?, variant = ?, option1 = ?, option2 = ?, option3 = ? WHERE id = ?",
            (target, variant_label(parts), option1, option2, option3, row["id"]),
        )
    options[index]["values"] = [target if item == source else item for item in options[index]["values"]]
    persist_options(db, product, options)


def remove_option(db, product, name):
    options = read_options(product)
    index = _option_index(options, name)
    rows = _rows(db, product["title"])
    groups = {}
    for row in rows:
        parts = list(row_parts(row)[:len(options)])
        key = tuple(parts[:index] + parts[index + 1:])
        groups.setdefault(key, []).append(row)
    for key, group in groups.items():
        keeper = group[0]
        stock = sum(item["on_hand"] for item in group)
        _rewrite(db, keeper, key, on_hand=stock)
        for extra in group[1:]:
            db.execute("DELETE FROM inventory WHERE id = ?", (extra["id"],))
    remaining = options[:index] + options[index + 1:]
    if not remaining:
        leftover = _rows(db, product["title"])
        if len(leftover) > 1:
            stock = sum(item["on_hand"] for item in leftover)
            _rewrite(db, leftover[0], ("", "", ""), on_hand=stock)
            for extra in leftover[1:]:
                db.execute("DELETE FROM inventory WHERE id = ?", (extra["id"],))
        elif leftover:
            _rewrite(db, leftover[0], ("", "", ""), on_hand=leftover[0]["on_hand"])
    persist_options(db, product, remaining)
    sync_stock(db, product["title"])


def add_one_variant(db, product, values, price=None, on_hand=0):
    options = read_options(product)
    if not options:
        raise ValidationError("Add options before adding a single variant")
    if not isinstance(values, list) or len(values) != len(options):
        raise ValidationError("Enter a value for every option")
    parts = [str(value or "").strip() for value in values]
    if any(not part for part in parts):
        raise ValidationError("Enter a value for every option")
    rows = _rows(db, product["title"])
    if _exists(rows, parts):
        raise ValidationError("A variant with these options already exists")
    fresh = [parts[index] not in options[index]["values"] for index in range(len(options))]
    if not any(fresh):
        raise ValidationError("Use a new option value. Add a value to an option to create every combination.")
    _guard(len(rows) + 1)
    base = _template(product, rows)
    amount = base["price"] if price is None else int(price)
    insert_variant(
        db, product["title"], parts, price=amount, on_hand=int(on_hand or 0),
        weight=base["weight"], location=base["location"], tracked=base["tracked"],
        physical=base["physical"], continue_selling=base["continue_selling"],
    )
    for index, is_new in enumerate(fresh):
        if is_new:
            options[index]["values"].append(parts[index])
    persist_options(db, product, options)
    sync_stock(db, product["title"])


def duplicate_many(db, product, ids, option_name, value):
    options = read_options(product)
    if not options:
        raise ValidationError("Add options before duplicating variants")
    index = _option_index(options, option_name)
    text = str(value or "").strip()
    if not text:
        raise ValidationError("Enter a value for the new variants")
    wanted = {int(item) for item in ids or []}
    rows = [row for row in _rows(db, product["title"]) if row["id"] in wanted]
    if not rows:
        raise ValidationError("Select at least one variant")
    column = f"option{index + 1}"
    shared = {row[column] for row in rows}
    if len(shared) != 1:
        raise ValidationError(f"Select variants that share the same {options[index]['name']}")
    if text == next(iter(shared)):
        raise ValidationError("Enter a different option value")
    rest = []
    for row in rows:
        parts = list(row_parts(row)[:len(options)])
        key = tuple(parts[:index] + parts[index + 1:])
        rest.append(key)
    if len(set(rest)) != len(rows):
        raise ValidationError("Select variants with different values for the other options")
    existing = _rows(db, product["title"])
    _guard(len(existing) + len(rows))
    created = 0
    skipped = []
    for row in rows:
        parts = list(row_parts(row))
        parts[index] = text
        if _exists(existing, parts):
            skipped.append(variant_label(pad(parts)))
            continue
        new_id = insert_variant(
            db, product["title"], parts, price=row["price"], on_hand=row["on_hand"],
            weight=row["weight"], location=row["location"], tracked=row["tracked"],
            physical=row["physical"], continue_selling=row["continue_selling"],
            sku=row["sku"], barcode=row["barcode"] or "", origin=row["origin"] or "", hs_code=row["hs_code"] or "",
        )
        existing.append({"id": new_id, "option1": pad(parts)[0], "option2": pad(parts)[1], "option3": pad(parts)[2]})
        created += 1
    if created and text not in options[index]["values"]:
        options[index]["values"].append(text)
        persist_options(db, product, options)
    sync_stock(db, product["title"])
    return {"created": created, "skipped": skipped}


def connect_option(db, product, name):
    options = read_options(product)
    index = _option_index(options, name)
    options[index]["source"] = "color"
    persist_options(db, product, options)


def disconnect_option(db, product, name):
    options = read_options(product)
    index = _option_index(options, name)
    label = options[index]["name"]
    options[index]["source"] = ""
    persist_options(db, product, options)
    db.execute(
        "INSERT OR IGNORE INTO product_fields (product_id, name) VALUES (?, ?)",
        (product["id"], label),
    )


def save_variant_fields(db, item, body):
    product = db.execute("SELECT * FROM products WHERE title = ?", (item["product"],)).fetchone()
    product = dict(product) if product else None
    options = read_options(product) if product else []
    try:
        price = int(body.get("price") if body.get("price") is not None else item["price"])
        on_hand = int(body.get("on_hand") if body.get("on_hand") is not None else item["on_hand"])
        unavailable = int(body.get("unavailable") if body.get("unavailable") is not None else item["unavailable"])
        committed = int(body.get("committed") if body.get("committed") is not None else item["committed"])
        weight = int(body.get("weight") if body.get("weight") is not None else item["weight"])
    except (TypeError, ValueError):
        raise ValidationError("Quantities must be numbers") from None
    if price < 0 or on_hand < 0 or weight < 0:
        raise ValidationError("Quantities must be numbers")
    available = max(on_hand - unavailable - committed, 0)
    location = str(body.get("location") if body.get("location") is not None else item["location"]).strip() or "Nairobi"
    tracked = 1 if body.get("tracked", item["tracked"]) else 0
    physical = 1 if body.get("physical", item["physical"]) else 0
    continue_selling = 1 if body.get("continue_selling", item["continue_selling"]) else 0
    sku = item["sku"]
    if "sku" in body:
        sku = str(body.get("sku") or "").strip() or None
    barcode = item["barcode"] if "barcode" in item.keys() else ""
    origin = item["origin"] if "origin" in item.keys() else ""
    hs_code = item["hs_code"] if "hs_code" in item.keys() else ""
    if "barcode" in body:
        barcode = str(body.get("barcode") or "").strip()
    if "origin" in body:
        origin = str(body.get("origin") or "").strip()
    if "hs_code" in body:
        hs_code = str(body.get("hs_code") or "").strip()
    parts = list(row_parts(item))
    if options:
        for index in range(len(options)):
            key = f"option{index + 1}"
            if key in body:
                text = str(body.get(key) or "").strip()
                if not text:
                    raise ValidationError(f"Enter a {options[index]['name']}")
                parts[index] = text
        siblings = _rows(db, item["product"])
        if _exists(siblings, parts, skip_id=item["id"]):
            raise ValidationError("A variant with these options already exists")
        for index in range(len(options)):
            if parts[index] not in options[index]["values"]:
                options[index]["values"].append(parts[index])
        persist_options(db, product, options)
    elif body.get("variant") is not None:
        label = str(body.get("variant") or "").strip()
        if not label:
            raise ValidationError("Enter a variant name")
        taken = db.execute(
            "SELECT 1 FROM inventory WHERE product = ? AND lower(variant) = lower(?) AND id != ?",
            (item["product"], label, item["id"]),
        ).fetchone()
        if taken:
            raise ValidationError("A variant with this name already exists")
        parts = [label, "", ""]
    option1, option2, option3 = pad(parts if options or body.get("variant") is not None else row_parts(item))
    label = variant_label((option1, option2, option3)) if options else (option1 or item["variant"])
    if not options and body.get("variant") is None:
        label = item["variant"]
        option1, option2, option3 = row_parts(item)
    db.execute(
        """UPDATE inventory
           SET variant = ?, price = ?, on_hand = ?, unavailable = ?, committed = ?, available = ?, weight = ?, location = ?, tracked = ?, physical = ?, continue_selling = ?, sku = ?, barcode = ?, origin = ?, hs_code = ?, option1 = ?, option2 = ?, option3 = ?
           WHERE id = ?""",
        (label, price, on_hand, unavailable, committed, available, weight, location, tracked, physical, continue_selling, sku, barcode or "", origin or "", hs_code or "", option1, option2, option3, item["id"]),
    )
    if product:
        sync_stock(db, product["title"])


def copy_one_variant(db, item, body):
    product = db.execute("SELECT * FROM products WHERE title = ?", (item["product"],)).fetchone()
    product = dict(product) if product else None
    options = read_options(product) if product else []
    rows = _rows(db, item["product"])
    if options:
        parts = []
        for index in range(3):
            key = f"option{index + 1}"
            current = row_parts(item)[index]
            parts.append(str(body.get(key) if body.get(key) is not None else current).strip())
        parts = parts[:len(options)]
        if any(not part for part in parts):
            raise ValidationError("Enter a value for every option")
        if pad(parts) == pad(row_parts(item)[:len(options)]):
            raise ValidationError("Change at least one option value")
        if _exists(rows, parts):
            raise ValidationError("A variant with these options already exists")
        _guard(len(rows) + 1)
        for index, part in enumerate(parts):
            if part not in options[index]["values"]:
                options[index]["values"].append(part)
        if product:
            persist_options(db, product, options)
        new_id = insert_variant(
            db, item["product"], parts, price=item["price"], on_hand=item["on_hand"],
            weight=item["weight"], location=item["location"], tracked=item["tracked"],
            physical=item["physical"], continue_selling=item["continue_selling"],
            sku=item["sku"], barcode=item["barcode"] or "", origin=item["origin"] or "", hs_code=item["hs_code"] or "",
        )
    else:
        label = str(body.get("variant") or f"{item['variant']} copy").strip()
        if not label:
            raise ValidationError("Enter a variant name")
        if any(row["variant"].lower() == label.lower() for row in rows):
            raise ValidationError("A variant with this name already exists")
        new_id = insert_variant(
            db, item["product"], (label, "", ""), price=item["price"], on_hand=item["on_hand"],
            weight=item["weight"], location=item["location"], tracked=item["tracked"],
            physical=item["physical"], continue_selling=item["continue_selling"],
            sku=item["sku"], barcode=item["barcode"] or "", origin=item["origin"] or "", hs_code=item["hs_code"] or "",
        )
    if product:
        sync_stock(db, product["title"])
    return new_id


def rename_product_inventory(db, old, new):
    if old != new:
        db.execute("UPDATE inventory SET product = ? WHERE product = ?", (new, old))


def delete_product_inventory(db, title):
    db.execute("DELETE FROM inventory WHERE product = ?", (title,))


def copy_product_inventory(db, source, target):
    for row in _rows(db, source):
        insert_variant(
            db, target, row_parts(row), price=row["price"], on_hand=row["on_hand"],
            weight=row["weight"], location=row["location"], tracked=row["tracked"],
            physical=row["physical"], continue_selling=row["continue_selling"],
            sku=row["sku"], barcode=row["barcode"] or "", origin=row["origin"] or "", hs_code=row["hs_code"] or "",
        )


def rename_connected_color(db, old, new):
    if old == new:
        return
    products = [dict(row) for row in db.execute("SELECT * FROM products")]
    for product in products:
        options = read_options(product)
        changed = False
        for option in options:
            if option.get("source") == "color":
                option["values"] = [new if value == old else value for value in option["values"]]
                changed = True
        if changed:
            persist_options(db, product, options)
        if product["color"] == old:
            db.execute("UPDATE products SET color = ? WHERE id = ?", (new, product["id"]))
    rows = [dict(row) for row in db.execute("SELECT * FROM inventory")]
    linked = {}
    for product in products:
        for option in read_options(product):
            if option.get("source") == "color":
                linked.setdefault(product["title"], set()).add(option["name"].lower())
    for row in rows:
        names = linked.get(row["product"])
        if not names:
            continue
        product = next(item for item in products if item["title"] == row["product"])
        options = read_options(product)
        parts = list(row_parts(row))
        touched = False
        for index, option in enumerate(options):
            if option.get("source") == "color" and parts[index] == old:
                parts[index] = new
                touched = True
        if touched:
            option1, option2, option3 = pad(parts)
            db.execute(
                "UPDATE inventory SET variant = ?, option1 = ?, option2 = ?, option3 = ? WHERE id = ?",
                (variant_label(parts), option1, option2, option3, row["id"]),
            )


def ensure_seeded_variants(db):
    products = [dict(row) for row in db.execute("SELECT * FROM products")]
    for product in products:
        count = db.execute("SELECT COUNT(*) FROM inventory WHERE product = ?", (product["title"],)).fetchone()[0]
        if count:
            continue
        spec = SEEDED_VARIANTS.get(product["title"])
        if spec:
            options = spec["options"]
            planned = spec["rows"]
        elif product["color"]:
            options = [{"name": "Color", "values": [product["color"]], "source": "color"}]
            planned = [(product["color"], "", "", None)]
        else:
            options = []
            planned = [("", "", "", None)]
        extra = read_extra(product)
        if not extra.get("options"):
            extra["options"] = options
            product["extra"] = json.dumps(extra)
            db.execute("UPDATE products SET extra = ? WHERE id = ?", (product["extra"], product["id"]))
        for option1, option2, option3, qty in planned:
            on_hand = product["stock"] if qty is None else qty
            insert_variant(
                db, product["title"], (option1, option2, option3),
                price=product["price"], on_hand=on_hand,
            )

