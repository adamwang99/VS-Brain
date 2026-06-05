#!/usr/bin/env python3
"""relay-v17.py — ChatGPT ↔ Gemini relay với Page.navigate + frameStoppedLoading"""
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

# ---- CDP Helpers ----
def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

class CDP:
    def __init__(self, tab):
        self.ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
        self._id = 0

    def _recv_until(self, target_id):
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == target_id:
                return msg.get("result", {})

    def cmd(self, method, params=None):
        self._id += 1
        msg = json.dumps({"id": self._id, "method": method, "params": params or {}})
        self.ws.send(msg)
        return self._recv_until(self._id)

    def ev(self, expr, await_promise=False):
        r = self.cmd("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "awaitPromise": await_promise
        })
        if r:
            # CDP: result.result.value (nested!)
            inner = r.get("result", {})
            return inner.get("value")
        return None

    def listen_until(self, method, timeout=15):
        """Wait for event 'method', return params"""
        start = time.time()
        while time.time() - start < timeout:
            msg = json.loads(self.ws.recv())
            if msg.get("method") == method:
                return msg.get("params", {})
        return None

    def listen_any(self, timeout=15):
        start = time.time()
        while time.time() - start < timeout:
            self.ws.settimeout(timeout)
            try:
                msg = json.loads(self.ws.recv())
                return msg.get("method", ""), msg.get("params", {})
            except:
                return None, None
        return None, None

    def close(self):
        self.ws.close()

    def native_enter(self):
        self.cmd("Input.dispatchKeyEvent", {
            "type": "keyDown", "key": "Enter", "keyCode": 13, "code": "Enter",
            "windowsVirtualKeyCode": 13, "nativeVirtualKeyCode": 13
        })
        time.sleep(0.05)
        self.cmd("Input.dispatchKeyEvent", {
            "type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"
        })

# ---- ChatGPT ----
def chatgpt_navigate_fresh(cdp_obj):
    """Navigate to fresh thread and wait for page to load"""
    # Enable Page events
    cdp_obj.cmd("Page.enable")

    # Navigate
    nav = cdp_obj.cmd("Page.navigate", {"url": "https://chatgpt.com/"})
    if nav and nav.get("errorText"):
        print(f"  Navigation error: {nav['errorText']}")
        return False

    # Wait for frameStoppedLoading
    evt = cdp_obj.listen_until("Page.frameStoppedLoading", timeout=20)
    if evt is None:
        print("  Timed out waiting for page load")
        # Try to check if already loaded
    else:
        print(f"  Page loaded (frameStoppedLoading)")
    
    time.sleep(3)  # Extra buffer for SPA
    return True

def chatgpt_send(cdp_obj, text, fresh=True):
    """Send message to ChatGPT, return response.
    If fresh=True, navigate to chatgpt.com/ first."""
    if fresh:
        print("  ChatGPT: mở thread mới...")
        cdp_obj.ev('window.location.href="https://chatgpt.com/"')
        # Poll for editor to appear
        for i in range(30):
            time.sleep(0.5)
            ed = cdp_obj.ev('(!!document.getElementById("prompt-textarea"))')
            if ed:
                print(f"  ChatGPT: editor ready (t={(i+1)*0.5}s)")
                time.sleep(2)  # Extra SPA bootstrap
                break
        else:
            print("  ChatGPT: editor timeout after navigation")
            return None

    # Verify editor
    ed_ok = cdp_obj.ev('(!!document.getElementById("prompt-textarea"))')
    if not ed_ok:
        print("  ChatGPT: no editor!")
        return None

    # Type text via execCommand (confirmed working)
    print("  ChatGPT: đánh text...")
    safe_text = json.dumps(text, ensure_ascii=False)
    cdp_obj.ev(f'''
        const el = document.getElementById("prompt-textarea");
        if(!el) return "no-editor";
        el.focus();
        document.execCommand("insertText", false, {safe_text});
        return "typed";
    ''')
    time.sleep(1.5)

    # Click send
    send = cdp_obj.ev('''
        (()=>{
            const btn = document.querySelector('[data-testid="send-button"]');
            if(btn && !btn.disabled) { btn.click(); return "sent"; }
            return "fail:"+!btn+":"+(btn?btn.disabled:"null");
        })()
    ''')
    print(f"  ChatGPT: send={send}")
    if not send or send != "sent":
        return None

    return wait_chatgpt_response(cdp_obj)

def wait_chatgpt_response(cdp_obj):
    last_len, stable, msg_count = 0, 0, 0
    for _ in range(40):
        time.sleep(2)
        r = cdp_obj.ev('''
            (()=>{
                const all = document.querySelectorAll('[data-message-model-slug]');
                if (!all.length) return {status:"waiting", count:0};
                const last = all[all.length-1];
                const txt = (last.innerText||"").trim();
                return {status:"ok", count:all.length, text:txt.substring(0,600), len:txt.length,
                        slug: last.getAttribute("data-message-model-slug")};
            })()
        ''')
        if not r: continue
        elapsed = _ * 2 + 2
        print(f"  ChatGPT: t={elapsed}s msgs={r.get('count',0)} len={r.get('len',0)} slug={r.get('slug','')}")
        if r.get("count", 0) >= 2 and r.get("len", 0) > 30:
            if r.get("len") == last_len:
                stable += 1
                if stable >= 3:
                    return f"[ChatGPT] {r['text']}"
            else:
                stable = 0
                last_len = r["len"]
    return None

# ---- Gemini ----
def gemini_send(cdp_obj, text):
    """Send to Gemini, return response text"""
    # Clear
    cdp_obj.ev('''
        const ce = document.querySelector('[contenteditable="true"]');
        if(ce) { ce.innerText = ""; ce.dispatchEvent(new Event("input",{bubbles:true})); }
    ''')
    time.sleep(0.3)

    # Type via CDP Input.insertText
    print("  Gemini: đánh text...")
    cdp_obj.cmd("Input.insertText", {"text": text})
    time.sleep(0.5)

    # Send via native Enter
    cdp_obj.native_enter()
    print("  Gemini: đã gửi")

    return wait_gemini_response(cdp_obj)

def wait_gemini_response(cdp_obj):
    last_len, stable = 0, 0
    for _ in range(30):
        time.sleep(3)
        r = cdp_obj.ev('''
            (()=>{
                const mr = document.querySelector("model-response");
                if(!mr) return {status:"waiting"};
                const txt = (mr.textContent||"").trim();
                if(!txt) return {status:"empty"};
                let t = txt;
                const idx = t.indexOf("\\n");
                if(idx !== -1 && idx < 20) t = t.substring(idx+1).trim();
                return {status:"ok", text:t.substring(0,600), len:t.length};
            })()
        ''')
        elapsed = _ * 3 + 3
        if not r:
            print(f"  Gemini: t={elapsed}s null")
            continue
        if r.get("status") == "waiting":
            print(f"  Gemini: t={elapsed}s waiting (no model-response)")
            continue
        if r.get("status") == "empty":
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
    chat = next((t for t in tabs if "chatgpt.com" in t.get("url","") and t["type"]=="page"), None)
    gem = next((t for t in tabs if "gemini.google.com/app" in t.get("url","") and
                "RotateCookies" not in t.get("url","")), None)

    if not chat or not gem:
        print("Thiếu tab:", {"chatgpt": bool(chat), "gemini": bool(gem)})
        return 1

    print(f"ChatGPT: {chat['id'][:8]} {chat['url'][:80]}")
    print(f"Gemini:  {gem['id'][:8]} {gem['url'][:80]}")

    c = CDP(chat)
    g = CDP(gem)

    try:
        # R1
        print("\n=== ROUND 1: ChatGPT seed ===")
        c1 = chatgpt_send(c, SEED)
        if not c1:
            print("FAIL: ChatGPT round 1")
            return 1
        print(f"\n✅ {c1[:200]}...\n")

        time.sleep(2)

        # R2
        print("=== ROUND 2: Gemini rebut ===")
        g1 = gemini_send(g, instruction("ChatGPT", c1))
        if not g1:
            print("FAIL: Gemini round 2")
            return 1
        print(f"\n✅ {g1[:200]}...\n")

        time.sleep(2)

        # R3
        print("=== ROUND 3: ChatGPT rebut ===")
        c2 = chatgpt_send(c, instruction("Gemini", g1))
        if not c2:
            print("FAIL: ChatGPT round 3")
            return 1
        print(f"\n✅ {c2[:200]}...\n")

        time.sleep(2)

        # R4
        print("=== ROUND 4: Gemini rebut ===")
        g2 = gemini_send(g, instruction("ChatGPT", c2))
        if not g2:
            print("FAIL: Gemini round 4")
            return 1
        print(f"\n✅ {g2[:200]}...\n")

        print("=" * 60)
        print("RELAY HOÀN TẤT — 4/4 PASS")
        print("=" * 60)
        return 0

    finally:
        c.close()
        g.close()

if __name__ == "__main__":
    sys.exit(main())
