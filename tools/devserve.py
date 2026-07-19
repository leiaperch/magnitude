"""Static server that forbids caching, so edited ES modules are always refetched
on reload (the browser otherwise caches module imports by URL and silently runs
stale code). Run from the site root: python tools/devserve.py 8600"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
    def log_message(self, *a): pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8600
ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
