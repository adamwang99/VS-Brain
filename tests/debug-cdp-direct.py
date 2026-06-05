#!/usr/bin/env python3
"""Debug: connection + Runtime.enable test"""
import json, urllib.request, websocket

def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

tabs = get_tabs()
chat = next((t for t in tabs if "chatgpt.com" in t["url"] and t["type"]=="page" and "RotateCookies" not in t["url"]), None)
if not chat:
    print("No ChatGPT tab!")
    exit(1)

print(f"Tab: {chat['id'][:8]}")
print(f"URL: {chat['url'][:100]}")
print(f"WS: {chat['webSocketDebuggerUrl'][:80]}...")

ws = websocket.create_connection(chat["webSocketDebuggerUrl"], timeout=10)
print("Connected OK")

# Enable Runtime
ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
resp = json.loads(ws.recv())
print(f"Runtime.enable: {resp}")

# Simple eval
ws.send(json.dumps({"id": 2, "method": "Runtime.evaluate", "params": {"expression": "1+1", "returnByValue": True}}))
resp = json.loads(ws.recv())
print(f"1+1 = {resp}")

# document.title
ws.send(json.dumps({"id": 3, "method": "Runtime.evaluate", "params": {"expression": "document.title", "returnByValue": True}}))
resp = json.loads(ws.recv())
print(f"title: {resp}")

# Check for article elements
ws.send(json.dumps({"id": 4, "method": "Runtime.evaluate", "params": {"expression": "document.querySelectorAll('article').length", "returnByValue": True}}))
resp = json.loads(ws.recv())
print(f"articles: {resp}")

# editor
ws.send(json.dumps({"id": 5, "method": "Runtime.evaluate", "params": {"expression": "!!document.getElementById('prompt-textarea')", "returnByValue": True}}))
resp = json.loads(ws.recv())
print(f"editor: {resp}")

# send button after type
ws.send(json.dumps({"id": 6, "method": "Runtime.evaluate", "params": {"expression": """
(function() {
    var el = document.getElementById('prompt-textarea');
    if (!el) return 'no-editor';
    el.focus();
    document.execCommand('insertText', false, 'test');
    return 'typed';
})()
""", "returnByValue": True}}))
resp = json.loads(ws.recv())
print(f"type: {resp}")

# Find send button
import time; time.sleep(0.5)
ws.send(json.dumps({"id": 7, "method": "Runtime.evaluate", "params": {"expression": """
(function() {
    var b = document.querySelector('[data-testid=\"send-button\"]');
    if (b) return 'SEND: disabled=' + b.disabled;
    var all = document.querySelectorAll('button[aria-label]');
    var arr = [];
    all.forEach(function(btn) { arr.push(btn.getAttribute('aria-label')); });
    return 'NO-SEND buttons with aria: ' + JSON.stringify(arr.slice(0, 15));
})()
""", "returnByValue": True}}))
resp = json.loads(ws.recv())
print(f"send-btn: {resp}")

ws.close()
