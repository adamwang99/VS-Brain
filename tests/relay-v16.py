#!/usr/bin/env python3
"""relay-v16.cjs → relay-v16.py — ChatGPT ↔ Gemini relay loop with Python websocket"""
import json, urllib.request, websocket, time, sys

SEED = (
    "Quản trị AI nên do chính phủ kiểm soát hoàn toàn hay cộng đồng mã nguồn mở tự quản? "
    "Hãy đưa ra quan điểm của bạn và lập luận ngắn gọn."
)

def instruction(prev_name, prev_text):
    return (
        f"PHẢN BIỆN: {prev_name} vừa nói: \"{prev_text}\"\n\n"
        "Hãy phản biện lại — phân tích điểm yếu trong lập luận trên, "
        "hoặc đưa ra góc nhìn đối lập. Trả lời bằng tiếng Việt."
    )

# ---- Helpers ----
def get_tabs():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())
    return [t for t in tabs if t.get("type") == "page"]

def connect(tab):
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=10)
    return ws

def cdp(ws, method, params=None):
    """Send CDP command, return result"""
    msg = {"id": 1, "method": method, "params": params or {}}
    ws.send(json.dumps(msg))
    resp = json.loads(ws.recv())
    if "error" in resp:
        print(f"CDP error: {resp['error']}", file=sys.stderr)
        return None
    return resp.get("result", {})

def evaluate(ws, expression, return_by_value=True, await_promise=False):
    r = cdp(ws, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": return_by_value,
        "awaitPromise": await_promise
    })
    if r and "result" in r:
        return r["result"].get("value")
    return None

def native_enter(ws):
    cdp(ws, "Input.dispatchKeyEvent", {
        "type": "keyDown", "key": "Enter", "keyCode": 13, "code": "Enter",
        "windowsVirtualKeyCode": 13, "nativeVirtualKeyCode": 13
    })
    time.sleep(0.05)
    cdp(ws, "Input.dispatchKeyEvent", {
        "type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"
    })

# ---- ChatGPT ----
def chatgpt_send(ws, text):
    """Open fresh thread, type, send, wait for response"""
    # Fresh thread
    print("  ChatGPT: mở thread mới...")
    evaluate(ws, 'window.location.href = "https://chatgpt.com/"')
    time.sleep(6)

    # Verify editor loaded
    ed_ok = evaluate(ws, '(!!document.getElementById("prompt-textarea"))')
    print(f"  ChatGPT: editor={ed_ok}")

    # Type
    print("  ChatGPT: đánh text...")
    safe_text = json.dumps(text)  # JSON escape for JS string
    evaluate(ws, f'''
        const el = document.getElementById("prompt-textarea");
        if(el) {{
            el.innerText = {safe_text};
            el.dispatchEvent(new Event("input", {{bubbles: true}}));
        }}
    ''')
    time.sleep(1.5)

    # Click send
    send_clk = evaluate(ws, '''
        (() => {
            const btn = document.querySelector('[data-testid="send-button"]');
            if (btn && !btn.disabled) { btn.click(); return "clicked"; }
            return "no-btn";
        })()
    ''')
    print(f"  ChatGPT: send={send_clk}")

    # Wait for response
    return wait_chatgpt(ws)

def wait_chatgpt(ws):
    last_len = 0
    stable = 0
    for _ in range(30):  # max 90s
        time.sleep(3)
        r = evaluate(ws, '''
            (() => {
                const msgs = document.querySelectorAll('[data-testid="conversation-turn"]');
                if (!msgs.length) return {status: "waiting", turns: 0};
                const last = msgs[msgs.length - 1];
                const txt = (last.innerText || "").trim();
                return {status: "ok", turns: msgs.length, text: txt.substring(0, 600), len: txt.length};
            })()
        ''')
        if not r or r.get("status") != "ok":
            continue
        elapsed = _ * 3 + 3
        print(f"  ChatGPT: t={elapsed}s turns={r['turns']} len={r['len']}")
        if r["turns"] > 1 and r["len"] > 30:
            if r["len"] == last_len:
                stable += 1
                if stable >= 3:
                    return f"[ChatGPT] {r['text']}"
            else:
                stable = 0
                last_len = r["len"]
    return None

# ---- Gemini ----
def gemini_send(ws, text):
    """Type into contenteditable, send via native Enter, wait for model-response"""
    # Clear
    evaluate(ws, '''
        const ce = document.querySelector('[contenteditable="true"]');
        if (ce) { ce.innerText = ""; ce.dispatchEvent(new Event("input", {bubbles: true})); }
    ''')
    time.sleep(0.3)

    # Type text via CDP Input.insertText
    print("  Gemini: đánh text...")
    cdp(ws, "Input.insertText", {"text": text})
    time.sleep(0.5)

    # Send via native Enter
    native_enter(ws)
    print("  Gemini: đã gửi (Enter)")

    return wait_gemini(ws)

def wait_gemini(ws):
    last_len = 0
    stable = 0
    for _ in range(30):
        time.sleep(3)
        r = evaluate(ws, '''
            (() => {
                const mr = document.querySelector("model-response");
                if (!mr) return {status: "waiting"};
                const txt = (mr.textContent || "").trim();
                if (!txt) return {status: "empty"};

                // Strip prefix
                let t = txt;
                let idx = t.indexOf("\\n");
                if (idx !== -1 && idx < 20) t = t.substring(idx + 1).trim();

                return {status: "ok", text: t.substring(0, 600), len: t.length};
            })()
        ''')
        if not r or r.get("status") not in ("ok", "empty"):
            elapsed = _ * 3 + 3
            print(f"  Gemini: t={elapsed}s {r}")
            continue
        elapsed = _ * 3 + 3
        if r["status"] == "empty":
            print(f"  Gemini: t={elapsed}s empty")
            continue
        print(f"  Gemini: t={elapsed}s len={r['len']}")
        if r["len"] > 30:
            if r["len"] == last_len:
                stable += 1
                if stable >= 3:
                    return f"[Gemini] {r['text']}"
            else:
                stable = 0
                last_len = r["len"]
    return None

# ---- MAIN ----
def main():
    tabs = get_tabs()
    chat = next((t for t in tabs if "chatgpt.com" in t.get("url", "")), None)
    gem = next((t for t in tabs if "gemini.google.com/app" in t.get("url", "") and
                "RotateCookies" not in t.get("url", "")), None)

    if not chat or not gem:
        print("Thiếu tab:", {"chatgpt": bool(chat), "gemini": bool(gem)})
        return 1

    print(f"ChatGPT: {chat['id'][:8]} {chat['url'][:80]}")
    print(f"Gemini:  {gem['id'][:8]} {gem['url'][:80]}")

    c_ws = connect(chat)
    g_ws = connect(gem)

    try:
        # R1: ChatGPT seed
        print("\n=== ROUND 1: ChatGPT seed ===")
        c1 = chatgpt_send(c_ws, SEED)
        if not c1:
            print("FAIL: ChatGPT round 1")
            return 1
        print(f"\n✅ {c1[:200]}...\n")

        # R2: Gemini phản biện
        print("=== ROUND 2: Gemini rebut ===")
        g1 = gemini_send(g_ws, instruction("ChatGPT", c1))
        if not g1:
            print("FAIL: Gemini round 2")
            return 1
        print(f"\n✅ {g1[:200]}...\n")

        # R3: ChatGPT phản biện Gemini
        print("=== ROUND 3: ChatGPT rebut ===")
        c2 = chatgpt_send(c_ws, instruction("Gemini", g1))
        if not c2:
            print("FAIL: ChatGPT round 3")
            return 1
        print(f"\n✅ {c2[:200]}...\n")

        # R4: Gemini phản biện ChatGPT
        print("=== ROUND 4: Gemini rebut ===")
        g2 = gemini_send(g_ws, instruction("ChatGPT", c2))
        if not g2:
            print("FAIL: Gemini round 4")
            return 1
        print(f"\n✅ {g2[:200]}...\n")

        print("=" * 60)
        print("RELAY HOÀN TẤT — 4/4 PASS")
        print("=" * 60)
        return 0

    finally:
        c_ws.close()
        g_ws.close()

if __name__ == "__main__":
    sys.exit(main())
