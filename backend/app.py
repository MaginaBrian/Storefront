from flask import Flask
from flask_cors import CORS

from catalog import bp as catalog_bp
from db import init_db
from drafts import bp as drafts_bp
from orders import bp as orders_bp
from store import bp as store_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(orders_bp)
app.register_blueprint(drafts_bp)
app.register_blueprint(catalog_bp)
app.register_blueprint(store_bp)
init_db()

if __name__ == "__main__":
    app.run(port=5000, debug=True)
