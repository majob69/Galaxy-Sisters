"""Tiny static server for Galaxy Sisters that never lets the browser cache game files.
(python -m http.server allows caching, so after an update the browser can mix old and new
JavaScript modules and the game silently fails to start.)  Usage: python serve.py [port]"""
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', port), NoCacheHandler) as httpd:
        print(f'Galaxy Sisters laeuft auf http://localhost:{port}/index.html  (Strg+C beendet)')
        httpd.serve_forever()
