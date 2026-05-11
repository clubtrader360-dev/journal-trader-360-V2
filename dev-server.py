#!/usr/bin/env python3
"""
Serveur local SPA-friendly.

Sert les fichiers statiques normalement, mais retombe sur index.html
pour toute URL "applicative" (pas de fichier ET pas /api/*) — pour que
le rafraîchissement sur /dashboard, /tradelog, /coach/students... fonctionne.

Usage : python3 dev-server.py [port]
"""
import http.server
import os
import socketserver
import sys
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        url_path = urlparse(self.path).path
        fs_path = self.translate_path(self.path)
        last_segment = url_path.rsplit('/', 1)[-1]
        looks_like_asset = '.' in last_segment  # ex: /foo.js, /img/logo.png

        # Fallback SPA : si la route est applicative (pas /api/*, pas un asset
        # avec extension), et qu'aucun fichier ne correspond, on rejoue index.html.
        # Pour les assets manquants, on laisse partir un 404 propre — sinon le
        # navigateur reçoit du HTML quand il attend du JS et tout casse en silence.
        if (
            not os.path.exists(fs_path)
            and not url_path.startswith('/api/')
            and not looks_like_asset
        ):
            self.path = '/index.html'

        return super().do_GET()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), SPAHandler) as httpd:
    print(f'SPA server : http://localhost:{PORT}/  (Ctrl+C pour arrêter)')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
