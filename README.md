# Storefront

Backend:  cd backend && pip install -r requirements.txt && python app.py
Frontend: cd frontend && npm install && npm run dev   (proxies /api to :5000)

Dummy data is stored in backend/storefront.db and seeded the first time the backend starts.

Backend modules: `db.py` holds the schema and seed, `orders.py`, `drafts.py`, `catalog.py`, and `store.py` are the API modules, and `app.py` wires them together.

Frontend modules live under `frontend/src`: `home`, `orders`, `catalog`, and `pages`, with shared helpers in `lib` and `components`.
