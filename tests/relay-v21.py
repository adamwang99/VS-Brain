#!/usr/bin/env python3
"""relay-v21.py — CrossCritic finale: ChatGPT↔Gemini 4-round + synthesis, all bugs fixed"""
import json, urllib.request, websocket, time, sys, textwrap, hashlib

TIMEOUT = 90  # max giây chờ mỗi model

def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

def cdp_connect(tab):
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=60)
    cid = [0]
    def req(method, params=None):
        cid[0] += 1
        ws.send(json.dumps({"id": cid[0], "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == cid[0]:
                return msg.get("result", {})
    def ev(expr):
        # Auto-wrap in IIFE (return khong hop le trong global scope)
        if "return" not in expr and "function" not in expr:
            expr = "return " + expr
        wrapped = "(function(){" + expr + "})()"
        r = req("Runtime.evaluate", {"expression": wrapped, "returnByValue": True})
        inner = r.get("result", {})
        if inner.get("subtype") == "error":
            return None
        return inner.get("value")
    def ins(text):
        req("Input.insertText", {"text": text})
    def enter():
        req("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "keyCode": 13, "code": "Enter", "windowsVirtualKeyCode": 13})
        time.sleep(0.05)
        req("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"})
    req("Runtime.enable")
    req("Page.enable")
    req("Input.enable")
    return ws, ev, ins, enter

# ── ChatGPT ─────────────────────────────────────────────
def chatgpt_new_thread(ev):
    print("  [ChatGPT] Mở thread mới...")
    ev('window.location.href="https://chatgpt.com/"')
    for i in range(45):
        time.sleep(1)
        if ev('!!document.getElementById("prompt-textarea")'):
            print(f"  [ChatGPT] Editor sẵn sàng ({i+1}s)")
            time.sleep(3)
            return True
    return False

def chatgpt_wait(ev):
    """Wait for assistant response, returns (text, md5_hash)"""
    print("  [ChatGPT] chờ...", end="", flush=True)
    for t in range(TIMEOUT // 2):
        time.sleep(2)
        # Get directly from DOM without JSON.stringify to avoid escape issues
        txt = ev(
            'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
            'if(!ms.length)return"";'
            'return(ms[ms.length-1].textContent||"").trim();'
        )
        if not txt or not isinstance(txt, str) or len(txt) < 50:
            print(".", end="", flush=True)
            continue
        # Stability check
        prev = txt
        stable = 0
        while stable < 3:
            time.sleep(2)
            cur = ev(
                'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
                'if(!ms.length)return"";'
                'return(ms[ms.length-1].textContent||"").trim();'
            )
            if isinstance(cur, str) and cur == prev:
                stable += 1
            elif isinstance(cur, str) and cur:
                stable = 0
                prev = cur
            print(".", end="", flush=True)
        print(f" [{len(prev)} chars]")
        return prev, hashlib.md5(prev.encode()).hexdigest()
    print(" TIMEOUT")
    return None, None

def chatgpt_send(ev, ins, enter, text):
    """Type + send, wait response"""
    ev(
        'var el=document.getElementById("prompt-textarea");'
        'if(el){el.focus();el.innerText="";}'
    )
    time.sleep(0.3)
    ins(text)
    time.sleep(1.5)
    # Click send button (works even with Enter-disabled UIs)
    r = ev(
        'var btn=document.querySelector("[data-testid=send-button]");'
        'if(btn&&!btn.disabled){btn.click();return"send-dt";}'
        'var bs=document.querySelectorAll("button[aria-label]");'
        'for(var i=0;i<bs.length;i++)'
        'if(bs[i].getAttribute("aria-label")==="Gửi lời nhắc"&&!bs[i].disabled)'
        '{bs[i].click();return"send-aria:"+i;}'
        'return"no-btn:"+bs.length;'
    )
    print(f"  [ChatGPT] gửi={r}", end="", flush=True)
    return chatgpt_wait(ev)

# ── Gemini ──────────────────────────────────────────────
def gemini_reload(ev):
    """Reload Gemini + chờ editor sẵn sàng"""
    print("  [Gemini] Reload...")
    ev('window.location.href="https://gemini.google.com/app"')
    for i in range(30):
        time.sleep(1)
        if ev('!!document.querySelector("[contenteditable=true]")'):
            print(f"  [Gemini] Sẵn sàng ({i+1}s)")
            time.sleep(2)
            return True
    return False

def gemini_wait(ev, known_hashes=None):
    """Wait for Gemini response — skip text identical to any known_hashes (cache from previous rounds)"""
    known_hashes = known_hashes or set()
    print("  [Gemini] chờ...", end="", flush=True)
    for t in range(TIMEOUT // 2):
        time.sleep(2)
        txt = ev(
            'var mr=document.querySelector("model-response");'
            'if(!mr)return"";'
            'return(mr.textContent||"").trim();'
        )
        if not txt or not isinstance(txt, str) or len(txt) < 50:
            print(".", end="", flush=True)
            continue
        # FIX B3: skip if text hash matches known cache
        txt_hash = hashlib.md5(txt.encode()).hexdigest()
        if txt_hash in known_hashes:
            print("C", end="", flush=True)  # "Cache" — skip duplicate
            time.sleep(2)
            continue
        # Stability check
        prev = txt
        stable = 0
        while stable < 3:
            time.sleep(2)
            cur = ev(
                'var mr=document.querySelector("model-response");'
                'if(!mr)return"";'
                'return(mr.textContent||"").trim();'
            )
            if isinstance(cur, str) and cur == prev:
                stable += 1
            elif isinstance(cur, str) and cur:
                stable = 0
                prev = cur
            print(".", end="", flush=True)
        # Strip first short line
        idx = prev.find("\n")
        if 0 < idx < 30:
            prev = prev[idx + 1:].strip()
        print(f" [{len(prev)} chars]")
        return prev, hashlib.md5(prev.encode()).hexdigest()
    print(" TIMEOUT")
    return None, None

def gemini_send(ev, ins, text):
    """Type + click send button, wait response"""
    ev(
        'var ce=document.querySelector("[contenteditable=true]");'
        'if(ce){ce.focus();ce.innerText="";}'
    )
    time.sleep(0.3)
    ins(text)
    time.sleep(1.0)
    # FIX B2: log button click result
    r = ev(
        'var bs=document.querySelectorAll("button[aria-label]");'
        'for(var i=0;i<bs.length;i++)'
        'if(bs[i].getAttribute("aria-label")==="Gửi tin nhắn"&&!bs[i].disabled)'
        '{bs[i].click();return"send-aria:"+i;}'
        'return"no-btn:"+bs.length;'
    )
    print(f"  [Gemini] gửi={r}", end="", flush=True)
    return r  # Return click result for logging

# ── Prompts ─────────────────────────────────────────────
def p_first(user_input):
    return (
        f"PHÂN TÍCH BAN ĐẦU:\n\n"
        f"Người dùng nêu ý kiến hoặc câu hỏi:\n\"{user_input}\"\n\n"
        f"Phân tích sâu — đánh giá điểm mạnh/yếu, giả định ngầm, góc nhìn đa chiều. "
        f"Tiếng Việt, 300-500 từ."
    )

def p_rebut(who, text):
    return (
        f"PHẢN BIỆN CHÉO:\n\n{who} vừa phân tích:\n\"{text[:1200]}\"\n\n"
        f"Phản biện lại — chỉ ra điểm yếu, góc nhìn bị bỏ sót, giả định sai. "
        f"Tiếng Việt, 300-500 từ."
    )

def p_synth(history):
    parts = [f"[Vòng {i+1}] {w}:\n{t[:400]}" for i, (w, t) in enumerate(history)]
    return (
        f"TỔNG HỢP CUỐI CÙNG:\n\n"
        f"Sau {len(history)} vòng phản biện ChatGPT↔Gemini:\n\n"
        f"{chr(10).join(parts)}\n\n"
        f"Nhiệm vụ:\n"
        f"1. Tóm tắt luồng lập luận chính hai phía\n"
        f"2. Điểm đồng thuận & bất đồng cốt lõi\n"
        f"3. Kết luận cân bằng nhất\n"
        f"4. Khía cạnh còn bỏ ngỏ\n"
        f"Tiếng Việt, 400-600 từ."
    )

# ── Main ────────────────────────────────────────────────
def run(user_input):
    tabs = get_tabs()
    ct = next((t for t in tabs if "chatgpt.com" in t["url"] and t["type"] == "page"
               and "RotateCookies" not in t["url"]), None)
    gt = next((t for t in tabs if "gemini.google.com/app" in t["url"]
               and "RotateCookies" not in t["url"]), None)
    if not ct or not gt:
        print("Thiếu tab:", {"chatgpt": bool(ct), "gemini": bool(gt)})
        return 1

    print(f"ChatGPT: {ct['id'][:8]} | {ct.get('title','')[:60]}")
    print(f"Gemini:  {gt['id'][:8]} | {gt.get('title','')[:60]}")
    print(f"Input:   {user_input[:100]}{'...' if len(user_input)>100 else ''}")

    c_ws, c_ev, c_ins, c_enter = cdp_connect(ct)
    g_ws, g_ev, g_ins, _ = cdp_connect(gt)
    history = []
    gemini_hashes = set()  # FIX B3: track hashes to skip cache duplicates

    try:
        # ── Prep ──
        print("\n── Chuẩn bị ──")
        if not chatgpt_new_thread(c_ev):
            print("FAIL: ChatGPT navigate")
            return 1

        # ── R1: ChatGPT seed ──
        print("\n── VÒNG 1: ChatGPT phân tích ──")
        r1_text, r1_hash = chatgpt_send(c_ev, c_ins, c_enter, p_first(user_input))
        if not r1_text:
            print("FAIL R1")
            return 1
        print(textwrap.fill(f"[ChatGPT] {r1_text}", width=72, break_long_words=False))
        history.append(("ChatGPT", r1_text))

        # ── R2: Gemini rebut ──
        print("\n── VÒNG 2: Gemini phản biện ──")
        if not gemini_reload(g_ev):
            print("WARN: Gemini reload lỗi")
        gemini_hashes.add(r1_hash)  # Don't match ChatGPT's own text hash
        click_ok = gemini_send(g_ev, g_ins, p_rebut("ChatGPT", r1_text))
        if "no-btn" in (click_ok or ""):
            print("FAIL: Gemini send button not found")
            return 1
        r2_text, r2_hash = gemini_wait(g_ev, gemini_hashes)
        if not r2_text:
            print("FAIL R2")
            return 1
        gemini_hashes.add(r2_hash)
        print(textwrap.fill(f"[Gemini] {r2_text}", width=72, break_long_words=False))
        history.append(("Gemini", r2_text))

        # ── R3: ChatGPT rebut ──
        print("\n── VÒNG 3: ChatGPT phản biện ──")
        r3_text, r3_hash = chatgpt_send(c_ev, c_ins, c_enter, p_rebut("Gemini", r2_text))
        if not r3_text:
            print("FAIL R3")
            return 1
        print(textwrap.fill(f"[ChatGPT] {r3_text}", width=72, break_long_words=False))
        history.append(("ChatGPT", r3_text))

        # ── R4: Gemini final ──
        print("\n── VÒNG 4: Gemini phản biện cuối ──")
        if not gemini_reload(g_ev):
            print("WARN: Gemini reload lỗi")
        click_ok = gemini_send(g_ev, g_ins, p_rebut("ChatGPT", r3_text))
        if "no-btn" in (click_ok or ""):
            print("WARN: Gemini không gửi được R4")
        else:
            r4_text, r4_hash = gemini_wait(g_ev, gemini_hashes)
            if not r4_text:
                print("WARN: Gemini R4 timeout — dùng 3 vòng")
            else:
                gemini_hashes.add(r4_hash)
                print(textwrap.fill(f"[Gemini] {r4_text}", width=72, break_long_words=False))
                history.append(("Gemini", r4_text))

        # ── Synthesis ──
        print("\n── TỔNG HỢP CUỐI CÙNG ──")
        final_text, _ = chatgpt_send(c_ev, c_ins, c_enter, p_synth(history))
        if not final_text:
            print("WARN: Tổng hợp thất bại")
        else:
            print("═" * 72)
            print(textwrap.fill(f"[TỔNG HỢP] {final_text}", width=72, break_long_words=False))
            print("═" * 72)

        # ── Report ──
        print(f"\n{'='*72}")
        print(f"  RELAY HOÀN TẤT — {len(history)} vòng hoàn thành")
        print(f"{'='*72}")
        for i, (who, txt) in enumerate(history):
            print(f"  R{i+1}: {who:10s} — {len(txt):5d} ký tự")
        if final_text:
            print(f"  TỔNG: {'ChatGPT':10s} — {len(final_text):5d} ký tự")
        return 0
    finally:
        c_ws.close()
        g_ws.close()

if __name__ == "__main__":
    user_input = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    if not user_input:
        print("CrossCritic v21 — ChatGPT ↔ Gemini phản biện chéo")
        print("Usage: python3 relay-v21.py \"Ý kiến của bạn...\"")
        print("Cần: Chrome --remote-debugging-port=9222 + 2 tab đã login")
        sys.exit(0)
    sys.exit(run(user_input))
