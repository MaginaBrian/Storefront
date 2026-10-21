# Piacì

Admin for **Maison**, a Nairobi clothing and fabric store. Prices are in Kenyan shillings. The screens follow a store-admin layout, and every list is backed by a local API instead of a hosted shop.

The browser app is React. The API is Flask. Both talk to one SQLite file, `backend/storefront.db`. Starting the API creates that file and the tables, and leaves them empty. The dummy store used for clicking through orders, products, markets, and settings lives in `backend/seed.py` and is loaded only when you ask for it.

## Run

Use two terminals from this directory. Python 3.12 is enough. The frontend needs Node and npm.

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Flask listens on [http://127.0.0.1:5000](http://127.0.0.1:5000) with the debug reloader on. Importing `app.py` calls `init_db()`, so the tables exist before the first request.

```bash
cd frontend
npm install
npm run dev
```

Vite serves the admin at [http://127.0.0.1:5173](http://127.0.0.1:5173) and proxies every `/api` request to port 5000. Start Flask first. A refresh is enough after the API is up. You do not need to rebuild.

Until you load the test data, lists are empty and the home chart has no channels. That is the normal empty store.

## Test data

`backend/seed.py` inserts the Maison dummy store: three orders, four drafts, the product and fabric catalog, customers, markets, discounts, menus, color swatches, reports, and the General settings. Running it again replaces whatever is currently in the database, including records you created in the admin.

```bash
cd backend
. .venv/bin/activate
python seed.py
```

To go back to an empty store:

```bash
python seed.py --clear
```

Deleting `backend/storefront.db` does the same thing after the next API start. The next `python seed.py` builds the file again and fills it.

Amounts in the database are integer cents. `30000` is KES 300.00. The frontend formats them in `frontend/src/lib/money.js`. Kenya tax on an order is 16% VAT taken out of the total (`round(total * 16 / 116)`), not added on top. The home-page channel totals are a separate dashboard figure stored as whole shillings on the `channels` table, which is why that donut does not equal the three seeded orders.

The seeded store, once loaded, includes:

| Record | What it is |
| --- | --- |
| `#1004` Korom Festival | Pending, unfulfilled, linked to draft `D4` |
| `#1002` Hawkeye Media | Paid and fulfilled, linked to draft `D2` |
| `#1001` Mwotaji Ltd | Paid and fulfilled, linked to draft `D1` |
| Draft `D3` | Korom Festival, no order yet |
| Kenya, Uganda, Tanzania | Active KES, active UGX, draft TZS |
| `maison.co.ke` | Online Store, Dawn theme, published |
| WELCOME10, FREESHIP, WEEKEND | The three discount codes |
| Mwotaji - Vest | The product editor example |
| Teal rib fabric | The inventory variant editor example, KES 1,487.00 |

## How a click moves through the app

The admin is one page. `frontend/src/App.jsx` reads the URL hash and renders the matching screen. `frontend/src/nav.js` lists the legal hashes. Anything else falls back to Home.

```text
#/orders?order=1004
#/drafts?draft=D4
#/products?product=Mwotaji%20-%20Vest
#/inventory?item=1
#/markets?market=Kenya
#/catalogs?create=1
#/settings?section=payments
```

`setView(id, extra)` writes that hash. The destination reads `focus` and asks the API for that record, then shows related rows from the same database. A customer name on an order opens `#/customers?customer=...`. A fabric name in a new catalog opens that fabric in inventory. A payment row in Settings opens the order. Drafts `D4`, `D2`, and `D1` point at orders through `drafts.order_id`. Draft `D3` does not.

The sidebar only expands the section you are in. Orders reveals Drafts and Abandoned checkouts. Products reveals Collections, Inventory, Purchase orders, Transfers, and Gift cards. The same pattern is used for Customers, Content, Markets, and Analytics. The parent row is highlighted only when that parent screen itself is open.

Search in the sidebar (also Ctrl K) checks page names locally, and from two characters onward calls `GET /api/search`, which returns orders, products, customers, and the other records that can be opened the same way.

## Request path

```text
React screen
  fetch("/api/...")
    Vite proxy
      Flask blueprint
        db.query / db.connect
          backend/storefront.db
```

`frontend/src/lib/api.js` wraps that fetch. `useJson` and `useApi` load a path when the component mounts and return a reload function for after a save. Writes are plain `fetch` calls with `POST` or `PATCH` and a JSON body. The Flask blueprints validate the body, write a row, and return the saved record or an `{ "error": "..." }` message with status 400.

`db.connect()` opens SQLite with row access by name. `db.query()` runs a read and returns a list of dicts. Writes use `with connect() as db`, which commits if the block finishes. There is no login and no second store. CORS is open so the Vite origin can call the API directly if the proxy is not used.

Creating an order or completing a draft also calls `attach_new_order()` in `db.py`. That helper writes the confirmation code, the shipping address, one line, and the timeline events the order screen expects. It is part of the API, not part of the seed file.

## Backend

`backend/app.py` builds the Flask app, registers four blueprints, and calls `init_db()`.

`backend/db.py` owns the file path, the `CREATE TABLE` script, and `migrate()`. `migrate()` adds columns that were introduced after the first schema: `drafts.order_id`, product editor fields, inventory price and weight, and the extra fields on purchase orders, transfers, and gift cards. It does not insert rows. `init_db()` is safe to run on every startup.

| Module | What it serves |
| --- | --- |
| `orders.py` | Order list, order detail, order timeline edits, today's summary, the small overview counts |
| `drafts.py` | Draft list and detail, completing a draft into an order, abandoned-checkout list |
| `catalog.py` | Products and the product editor, collections, inventory and the variant editor, purchase orders, transfers, gift cards |
| `store.py` | Customers, segments, companies, discounts, content pages, files, metaobjects, menus, blog posts, markets, catalogs, rollouts, reports, dashboard, analytics series, store, agentic, settings, search |
| `seed.py` | The dummy rows, run by hand |

Detail routes are the list route plus an id, for example `GET /api/orders/1004` and `POST /api/orders/1004` to change that order. Markets use `PATCH /api/markets/<id>`. Settings use `GET` and `PATCH /api/settings`, where each row is a key such as `entity_name` or `order_prefix`.

## Frontend

`frontend/src/main.jsx` mounts `App`. `App.jsx` is the shell: the Maison sidebar, search, and the `view === ...` switch. Feature screens live in four folders.

| Folder | Screens |
| --- | --- |
| `home/Home.jsx` | Sales performance, the channel donut, the week bars, recent orders |
| `orders/` | Order list and editor, draft list and editor, abandoned checkouts |
| `catalog/` | Collections, inventory, variant editor, and the create forms for purchase orders, transfers, and gift cards |
| `pages/` | Products, customers, segments, companies, discounts, content, markets, catalogs, rollouts, analytics, reports, live view, growth, online store, agentic, settings |

Shared pieces are `components/Modal.jsx`, `components/Tag.jsx`, and `lib/` (`api.js`, `money.js`, `csv.js`). Styles enter through `styles.css`, which imports `styles/base.css` (the shell), `styles/lists.css` (tables and empty states), and `styles/detail.css` (editors, markets, settings).

A screen that can open a record takes `focus` and `onOpen`. `onOpen('orders', { order: 1004 })` is the only way one screen should send the user to another. Create flows use the same mechanism: `#/catalogs?create=1`, `#/purchase-orders?create=1`, `#/companies?create=1`.

Settings is a second list inside the page, not a replacement for the sidebar. `#/settings` opens General. The other sections are Payments, Checkout, Shipping, Taxes, Locations, Sales channels, Domains, Notifications, and Content. Each one reads the store's own rows and links back into the matching screen. Shipping on a market opens Settings on the shipping section.

## What stays on the client

A few screens are laid out for the demo and do not recompute from the order table:

- The home donut and KPI tiles read the `channels`, `kpis`, and `week` tables. Those numbers are the dashboard story, not a sum of `#1001`, `#1002`, and `#1004`.
- Analytics for "today" is a fixed picture for 14 October 2026: no sales that day, one desktop session from Nairobi. The September orders stay outside that range.
- Segment percentages are stored on the segment row. Opening a segment still filters real customers: "purchased at least once" lists everyone with orders, and "purchased more than once" lists Korom Festival because that customer is stored with two orders.
- Live view shows that same single visitor.
- Reports are a fixed catalog of report names. Opening one links to the related admin screen.

Empty on purpose, even after seeding: companies, files, blog posts, saved market catalogs, rollouts, gift cards, purchase orders, and transfers. Their create screens are there so you can add one while testing. `python seed.py` will wipe that addition the next time it runs.

## Tables

Orders, drafts, and checkouts are the selling flow. `order_detail`, `order_address`, `order_lines`, `order_tags`, and `order_events` belong to one order. `draft_lines` and `draft_events` belong to a draft that has not become an order yet.

Products, collections, inventory, purchase orders, transfers, and gift cards are the catalog. Customers, segments, and companies are the people. Discounts, pages, menus, files, metaobjects, and blog posts are what the storefront is made of. Markets, `catalog_items`, `market_catalogs`, and rollouts are where a price list can differ by country.

`channels`, `week`, `kpis`, `store`, and `agentic` feed Home, Online Store, and Agentic. `settings` is the General page, one key per row. `reports` is the report library.

## Reset

```bash
cd backend
. .venv/bin/activate
python seed.py --clear    # empty store
python seed.py            # dummy store again
```
