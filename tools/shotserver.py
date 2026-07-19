"""Tiny upload sink: the page POSTs a canvas dataURL as text/plain, we decode
and save it to tools/snapshots/browser.png. Sidesteps the flaky screenshot
tool and any copy-paste of base64. Run: python tools/shotserver.py"""
import base64, os
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = os.path.join(os.path.dirname(__file__), 'snapshots')
os.makedirs(OUT, exist_ok=True)

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n).decode('ascii', 'ignore')
        name = self.headers.get('X-Name', 'browser') + '.png'
        if ',' in body:
            body = body.split(',', 1)[1]
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(base64.b64decode(body))
        self.send_response(200); self._cors(); self.end_headers()
        self.wfile.write(b'ok')
    def log_message(self, *a): pass

HTTPServer(('127.0.0.1', 8500), H).serve_forever()
