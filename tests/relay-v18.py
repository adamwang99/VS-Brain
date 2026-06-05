#!/usr/bin/env python3
"""relay-v18.py — ChatGPT↔Gemini relay, CDP direct, existing tabs, 2 rounds"""
import json, urllib.request, websocket, time, sys

SEED = (
    "Quản trị AI nên do chính phủ kiểm soát hoàn toàn hay cộng đồng mã nguồn mở tự quản? "
    "Hãy đưa ra quan điểm của bạn và lập luận ngắn gọn."
)

def inst(prev_name, prev_text):
    return (
        f"PHẢN BIỆN: {prev_name} vừa nói: \"{prev_text}\"\n\n"
        "Hãy phản biện lại — phân tích điểm yếu trong lập luận trên, "
        "hoặc đưa ra góc nhìn đối lập. Trả lời bằng tiếng Việt."
    )

def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

def cdp_connect(tab):
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
    cid = [0]
    def _req(method, params=None):
        cid[0] += 1
        mid = cid[0]
        ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        # recv until matching id, skip events
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == mid:
                return msg.get("result", {})
            # events have no id, they're skipped
    def ev(expr, await_promise=False):
        r = _req("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": await_promise})
        inner = r.get("result", {})
        if inner.get("subtype") == "error":
            return {"error": inner.get("description","")}
        return inner.get("value")
    def native_enter():
        _req("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "keyCode": 13, "code": "Enter"})
        time.sleep(0.05)
        _req("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"})
    _req("Runtime.enable")
    _req("Page.enable")
    return ws, ev, native_enter, _req

# ---- ChatGPT ----
WATCH_QUERY = """
(function() {
    var msgs = document.querySelectorAll('[data-message-author-role]');
    if (!msgs.length) return JSON.stringify({found:false, reason:'no msgs', total:0, last:[]});
    var out = [];
    for (var i = Math.max(0, msgs.length-3); i < msgs.length; i++) {
        var m = msgs[i];
        var role = m.getAttribute('data-message-author-role') || '?';
        var txt = (m.textContent||'').trim().substring(0, 800);
        out.push({role: role, text: txt.substring(0, 400), full_len: txt.length});
    }
    return JSON.stringify({found:true, total: msgs.length, last: out});
})()
"""

def chatgpt_send(ev, native_enter, text, fresh=False):
    """Type + send to ChatGPT, return response text"""
    if fresh:
        print("  ChatGPT: mở new thread...")
        ev('window.location.href="https://chatgpt.com/"')
        time.sleep(3)
        for i in range(20):
            time.sleep(1)
            if ev('!!document.getElementById("prompt-textarea")'):
                print(f"  ChatGPT: editor ready after {(i+1)*1+3}s")
                time.sleep(2)
                break
        else:
            print("  ChatGPT: editor timeout")
            return None

    # Clear existing text + type new
    safe = json.dumps(text)
    r = ev(f"""
        (function() {{
            var el = document.getElementById('prompt-textarea');
            if (!el) return 'no-editor';
            el.focus();
            el.innerText = '';
            document.execCommand('insertText', false, {safe});
            return 'typed';
        }})()
    """)
    if r != 'typed':
        print(f"  ChatGPT: type fail: {r}")
        return None
    
    time.sleep(1.0)

    # Click send
    r = ev("""
        (function() {
            var b = document.querySelector('[data-testid="send-button"]');
            if (b && !b.disabled) { b.click(); return 'sent'; }
            return 'fail found=' + !!b + ' disabled=' + (b ? b.disabled : 'null');
        })()
    """)
    print(f"  ChatGPT: send={r}")
    if r != 'sent':
        return None

    return wait_chatgpt(ev)

def wait_chatgpt(ev):
    """Wait for new assistant response"""
    # Count existing messages first
    base_raw = ev(WATCH_QUERY)
    base_count = 0
    try:
        base_data = json.loads(base_raw) if base_raw else {}
        base_count = base_data.get('total', 0) if base_data.get('found') else 0
    except: pass
    print(f"  ChatGPT: base_msgs={base_count}", end="", flush=True)
    
    for t in range(60):
        time.sleep(2)
        raw = ev(WATCH_QUERY)
        if not raw:
            print(f" [t={t*2}s:null]", end="", flush=True)
            continue
        try:
            data = json.loads(raw)
        except:
            print(f" [t={t*2}s:parse_err]", end="", flush=True)
            continue
        
        if not data.get('found'):
            print(f" [t={t*2}s:none]", end="", flush=True)
            continue
        
        total = data.get('total', 0)
        last = data.get('last', [])
        
        # New message arrived
        if total > base_count:
            # Get the new assistant msg (last msg = assistant)
            for m in last:
                if m.get('role') == 'assistant' and m.get('full_len', 0) > 30:
                    print(f" [t={t*2}s:new={total} len={m['full_len']}]")
                    return f"[ChatGPT] {m['text']}"
        
        # Still the old count - waiting
        print(f".", end="", flush=True)
    print(" TIMEOUT")
    return None

# ---- Gemini ----
GEM_WATCH = """
(function() {
    var mr = document.querySelector('model-response');
    if (!mr) return JSON.stringify({found:false});
    var txt = (mr.textContent||'').trim();
    // strip first short line (often "Showing results for...")
    var idx = txt.indexOf('\\n');
    if (idx > 0 && idx < 30) txt = txt.substring(idx+1).trim();
    return JSON.stringify({found:true, text: txt.substring(0, 600), len: txt.length});
})()
"""

def gemini_send(ev, native_enter, text):
    """Type + send to Gemini, return response"""
    safe = json.dumps(text)
    r = ev(f"""
        (function() {{
            var ce = document.querySelector('[contenteditable="true"]');
            if (!ce) return 'no-editor';
            ce.focus();
            ce.innerText = '';
            document.execCommand('insertText', false, {safe});
            return 'typed';
        }})()
    """)
    if r != 'typed':
        print(f"  Gemini: type fail: {r}")
        return None

    time.sleep(0.5)
    native_enter()
    print("  Gemini: sent")

    # Wait for response
    print("  Gemini: waiting...", end="", flush=True)
    for t in range(45):
        time.sleep(2)
        raw = ev(GEM_WATCH)
        if not raw:
            print(f" [t={t*2}s:null]", end="", flush=True)
            continue
        try:
            data = json.loads(raw)
        except:
            print(f" [t={t*2}s:parse]", end="", flush=True)
            continue
        if data.get('found') and data.get('len', 0) > 30:
            print(f" [t={t*2}s:found len={data['len']}]")
            return f"[Gemini] {data['text']}"
        print(f".", end="", flush=True)
    print(" TIMEOUT")
    return None

# ---- MAIN ----
def main():
    tabs = get_tabs()
    chat = next((t for t in tabs if "chatgpt.com" in t["url"] and t["type"]=="page" and "RotateCookies" not in t["url"]), None)
    gem = next((t for t in tabs if "gemini.google.com/app" in t["url"] and "RotateCookies" not in t["url"]), None)
    
    if not chat or not gem:
        print("Missing tabs:", {"chatgpt": bool(chat), "gemini": bool(gem)})
        return 1

    print(f"ChatGPT: {chat['id'][:8]} {chat['url'][:80]}")
    print(f"Gemini:  {gem['id'][:8]} {gem['url'][:80]}")

    c_ws, c_ev, c_enter, _ = cdp_connect(chat)
    g_ws, g_ev, g_enter, _ = cdp_connect(gem)

    try:
        # R1: ChatGPT seed
        print("\n=== ROUND 1: ChatGPT seed ===")
        c1 = chatgpt_send(c_ev, c_enter, SEED)
        if not c1:
            print("FAIL: ChatGPT R1")
            return 1
        print(f"\n✅ {c1[:300]}...\n")

        # R2: Gemini rebut
        print("=== ROUND 2: Gemini rebut ===")
        g1 = gemini_send(g_ev, g_enter, inst("ChatGPT", c1))
        if not g1:
            print("FAIL: Gemini R2")
            return 1
        print(f"\n✅ {g1[:300]}...\n")

        # R3: ChatGPT rebut
        print("=== ROUND 3: ChatGPT rebut ===")
        c2 = chatgpt_send(c_ev, c_enter, inst("Gemini", g1))
        if not c2:
            print("FAIL: ChatGPT R3")
            return 1
        print(f"\n✅ {c2[:300]}...\n")

        # R4: Gemini rebut
        print("=== ROUND 4: Gemini rebut ===")
        g2 = gemini_send(g_ev, g_enter, inst("ChatGPT", c2))
        if not g2:
            print("FAIL: Gemini R4")
            return 1
        print(f"\n✅ {g2[:300]}...\n")

        print("=" * 60)
        print("RELAY HOÀN TẤT — 4/4 PASS")
        print("=" * 60)
        return 0
    finally:
        c_ws.close()
        g_ws.close()

if __name__ == "__main__":
    sys.exit(main())
