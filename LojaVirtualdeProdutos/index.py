"""Ponto de entrada da Vercel: carrega o app Flask que fica em src/lojavirtualdeprodutos/app.py."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "lojavirtualdeprodutos"))

from app import app  # noqa: E402,F401
