#!/usr/bin/env python3
"""Debug: tìm selector đúng để lấy ChatGPT response"""
import json, urllib.request, websocket

def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

class CDP:
    def __init__(self, tab):
        self.ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=15)
        self._id = 0
    def _recv_until(self, target_id):
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == target_id:
                return msg.get("result", {})
    def cmd(self, method, params=None):
        self._id += 1
        self.ws.send(json.dumps({"id": self._id, "method": method, "params": params or {}}))
        return self._recv_until(self._id)
    def ev(self, expr, await_promise=False):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": await_promise})
        if r:
            inner = r.get("result", {})
            if inner.get("subtype") == "error":
                return "ERROR: " + inner.get("description","")
            return inner.get("value")
        return None
    def close(self):
        self.ws.close()

tabs = get_tabs()
chat = next((t for t in tabs if "chatgpt.com" in t["url"] and t["type"]=="page" and "RotateCookies" not in t["url"]), None)
if not chat:
    print("No ChatGPT tab!")
    exit(1)

print(f"Tab: {chat['id'][:8]} URL: {chat['url'][:100]}")
c = CDP(chat)

# 1. Check page state
print("\n=== PAGE STATE ===")
print(f"URL: {c.ev('window.location.href')}")
print(f"Title: {c.ev('document.title')}")

# 2. Scan all elements that might contain response text
print("\n=== DOM STRUCTURE SCAN ===")
scan = c.ev("""
(function() {
    var out = [];
    // Check all chat-like containers
    var articles = document.querySelectorAll('article');
    out.push('articles count: ' + articles.length);
    articles.forEach(function(a, i) {
        var attrs = [];
        for (var j = 0; j < Math.min(a.attributes.length, 10); j++) {
            attrs.push(a.attributes[j].name + '=' + (a.attributes[j].value||'').substring(0, 50));
        }
        var txt = (a.textContent||'').substring(0, 200);
        out.push('article['+i+'] attrs=[' + attrs.join(', ') + '] text=' + txt);
    });

    // Check [data-message-*] elements
    var msgSlug = document.querySelectorAll('[data-message-model-slug]');
    out.push('\\\\n[data-message-model-slug] count: ' + msgSlug.length);
    var msgRole = document.querySelectorAll('[data-message-author-role]');
    out.push('[data-message-author-role] count: ' + msgRole.length);
    msgRole.forEach(function(m, i) {
        out.push('  ['+i+'] role=' + m.getAttribute('data-message-author-role') + ' text=' + (m.textContent||'').substring(0, 150));
    });

    // Check for markdown content
    var md = document.querySelectorAll('.markdown,.prose,[class*="markdown"],[class*="prose"]');
    out.push('\\\\nmarkdown-like containers: ' + md.length);
    md.forEach(function(m, i) {
        out.push('  ['+i+'] class=' + (m.className||'').substring(0,60) + ' text=' + (m.textContent||'').substring(0, 150));
    });

    // all divs with class containing 'turn' or 'message'
    var turns = document.querySelectorAll('[class*="turn"],[class*="message"],[class*="agent"]');
    out.push('\\\\nclass[turn|message|agent] elements: ' + turns.length);
    turns.forEach(function(t, i) {
        if (i < 10) out.push('  ['+i+'] tag=' + t.tagName + ' class=' + (t.className||'').substring(0, 80));
    });

    return out.join('\\\\n');
})
""")
print(scan if scan else "null")

# 3. Check send button
print("\n=== SEND BUTTON ===")
btn = c.ev("""
(function() {
    var b = document.querySelector('[data-testid=\"send-button\"]');
    if (b) return 'FOUND data-testid=send-button disabled=' + b.disabled + ' aria=' + (b.getAttribute('aria-label')||'none');
    b = document.querySelector('[aria-label*=\"G\"]');
    if (b) return 'FOUND aria-label contains G: ' + (b.getAttribute('aria-label')||'');
    var all = document.querySelectorAll('button');
    var matches = [];
    all.forEach(function(btn) {
        var aria = (btn.getAttribute('aria-label')||'').toLowerCase();
        if (aria && (aria.includes('gui') || aria.includes('send') || aria.includes('submit'))) {
            matches.push('aria=' + aria);
        }
    });
    return 'NO send button. aria-match: ' + JSON.stringify(matches) + ' total buttons: ' + all.length;
})
""")
print(btn)

# 4. Type something and rescan
print("\n=== TYPE + SEND BUTTON CHECK ===")
c.ev("""
(function() {
    var el = document.getElementById('prompt-textarea');
    if (!el) return 'no editor';
    el.focus();
    document.execCommand('insertText', false, 'test phan bien');
    return 'typed';
})()
""")
import time
time.sleep(1)

btn2 = c.ev("""
(function() {
    var b = document.querySelector('[data-testid=\"send-button\"]');
    if (b) return 'FOUND after type: disabled=' + b.disabled + ' aria=' + (b.getAttribute('aria-label')||'none') + ' x=' + b.getBoundingClientRect().x + ' y=' + b.getBoundingClientRect().y;
    var svgBtns = document.querySelectorAll('button[aria-label]');
    var matches = [];
    svgBtns.forEach(function(b) {
        var aria = b.getAttribute('aria-label')||'';
        if (aria) matches.push(aria);
    });
    return 'STILL no send-button. aria buttons: ' + JSON.stringify(matches.slice(0, 20));
})
""")
print(btn2)

c.close()
