# Storefront

Admin for **Maison**, a Nairobi store that sells in Kenyan shillings. The interface is a local demo: Flask serves dummy data from SQLite, and the React app reads it.

Open the app at [http://127.0.0.1:5173/](http://127.0.0.1:5173/). The API is [http://127.0.0.1:5000/](http://127.0.0.1:5000/).

## Run

Use two terminals from this directory.

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to port 5000. Start the backend first.

## What you can click through

The sidebar opens Home, Orders, Products, Customers, Growth, Discounts, Content, Markets, Analytics, Online Store, Agentic, and Settings. A section’s extra pages appear only while that section is selected. Drafts and abandoned checkouts sit under Orders. Collections, inventory, purchase orders, transfers, and gift cards sit under Products.

Choosing a record keeps it in the address. `#/orders?order=1004` opens that order, `#/markets?market=Kenya` opens Kenya, and `#/products?product=Mwotaji%20-%20Vest` opens the vest editor. Related rows link onward: a customer name opens that customer, a fabric in a catalog opens its inventory, and a payment in Settings opens the order.

The seeded store includes:

- Orders **#1004** Korom Festival (pending), **#1002** Hawkeye Media, and **#1001** Mwotaji Ltd, plus matching drafts
- Markets for Kenya (KES), Uganda (UGX), and Tanzania (TZS, draft)
- Online Store at `maison.co.ke` on the Dawn theme
- Discount codes WELCOME10, FREESHIP, and WEEKEND

Amounts are stored as integer cents. The screen shows them as KES. Kenya tax is 16% VAT included in the order total.

Settings starts on General and covers this store: contact `hello@maison.co.ke`, the Nairobi location, order numbers, payments, shipping, tax, sales channels, and content.

## Data

`backend/storefront.db` is created the first time `app.py` imports. If the orders table is empty, the seed runs. Later starts keep the database and only add missing tables and rows, so a catalog or company you save stays until you delete the file.

To start over, stop the backend and remove `backend/storefront.db`.

## Layout

| Path | Role |
| --- | --- |
| `backend/app.py` | Flask app, port 5000 |
| `backend/db.py` | Schema and seed |
| `backend/orders.py`, `drafts.py`, `catalog.py`, `store.py` | API blueprints |
| `frontend/src/App.jsx` | Shell and hash routing |
| `frontend/src/nav.js` | Sections and route names |
| `frontend/src/home` | Home dashboard |
| `frontend/src/orders` | Orders, drafts, abandoned checkouts |
| `frontend/src/catalog` | Collections, inventory, purchase orders, transfers, gift cards |
| `frontend/src/pages` | Customers, content, markets, analytics, channels, settings |
| `frontend/src/lib` | API helper, money formatting, CSV export |
