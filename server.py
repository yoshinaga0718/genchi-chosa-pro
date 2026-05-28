"""
静的ファイル配信 + iPadログ受信サーバー
http://192.168.0.134:7788/ でアプリを配信
POST /log でiPadのログを受信してtablet_log.txtに追記
"""
import os, json, time
from http.server import HTTPServer, SimpleHTTPRequestHandler

LOG_FILE = os.path.join(os.path.dirname(__file__), 'tablet_log.txt')
BASE_DIR  = os.path.dirname(__file__)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE_DIR, **kw)

    def do_POST(self):
        if self.path == '/log':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8', errors='replace')
            ts = time.strftime('%H:%M:%S')
            line = f'[{ts}] {body}\n'
            with open(LOG_FILE, 'a', encoding='utf-8') as f:
                f.write(line)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin','*')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
        self.end_headers()

    def log_message(self, fmt, *args):
        pass  # アクセスログ抑制

if __name__ == '__main__':
    # ログファイルをリセット
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f'=== サーバー起動 {time.strftime("%Y-%m-%d %H:%M:%S")} ===\n')
    print(f'サーバー起動: http://0.0.0.0:7788/')
    HTTPServer(('', 7788), Handler).serve_forever()
