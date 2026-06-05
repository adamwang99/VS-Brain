#!/usr/bin/env python3
"""relay-v19.py — ChatGPT<->Gemini relay, Input.insertText + Enter, fixed wait logic"""
import json, urllib.request, websocket, time, sys

SEED = (
    "Quan tri AI nen do chinh phu kiem soat hoan toan hay cong dong ma nguon mo tu quan? "
    "Hay dua ra quan diem cua ban va lap luan ngan gon."
)

def inst(prev_name, prev_text):
    return (
        "PHAN BIEN: " + prev_name + " vua noi: \"" + prev_text + "\"\n\n"
        "Hay phan bien lai — phan tich diem yeu trong lap luan tren, "
        "hoac dua ra goc nhin doi lap. Tra loi bang tieng Viet."
    )

def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

def cdp_connect(tab):
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
    cid = [0]
    def req(method, params=None):
        cid[0] += 1
        ws.send(json.dumps({"id": cid[0], "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == cid[0]:
                return msg.get("result", {})
    def ev(expr):
        r = req("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        inner = r.get("result", {})
        if inner.get("subtype") == "error":
            return None
        return inner.get("value")
    def insert_text(text):
        req("Input.insertText", {"text": text})
    def press_enter():
        req("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "keyCode": 13, "code": "Enter", "windowsVirtualKeyCode": 13})
        time.sleep(0.05)
        req("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"})
    req("Runtime.enable")
    req("Page.enable")
    req("Input.enable")
    return ws, ev, insert_text, press_enter

def chatgpt_navigate(ev):
    """Navigate to fresh thread"""
    ev('window.location.href="https://chatgpt.com/"')
    for i in range(30):
        time.sleep(1)
        if ev('!!document.getElementById("prompt-textarea")'):
            time.sleep(3)
            return True
    return False

def chatgpt_wait(ev):
    """Wait for ChatGPT to finish responding. Returns response text."""
    print("  ChatGPT: wait", end="", flush=True)
    for t in range(60):
        time.sleep(2)
        raw = ev(
            '(function(){'
            'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
            'if(!ms.length)return"{}";'
            'var last=ms[ms.length-1];'
            'var txt=(last.textContent||"").trim();'
            'return JSON.stringify({l:txt.length,t:txt.substring(0,800)});'
            '})()'
        )
        if raw and isinstance(raw, str) and raw != "{}":
            try:
                d = json.loads(raw)
                if d["l"] > 30:
                    prev_t = d["t"]
                    stable = 0
                    while stable < 3:
                        time.sleep(2)
                        cur_raw = ev(
                            '(function(){'
                            'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
                            'if(!ms.length)return"";'
                            'return(ms[ms.length-1].textContent||"").trim();'
                            '})()'
                        )
                        if cur_raw and isinstance(cur_raw, str):
                            if cur_raw == prev_t:
                                stable += 1
                            else:
                                stable = 0
                                prev_t = cur_raw
                            print(".", end="", flush=True)
                    print(" [done len=" + str(len(prev_t)) + "]")
                    return "[ChatGPT] " + prev_t
            except: pass
        print(".", end="", flush=True)
    print(" TIMEOUT")
    return None

def chatgpt_send(ev, insert_text, press_enter, text):
    """Type + Enter, wait response"""
    ev(
        '(function(){'
        'var el=document.getElementById("prompt-textarea");'
        'if(el){el.focus();el.innerText="";}'
        '})()'
    )
    time.sleep(0.3)
    insert_text(text)
    time.sleep(1.0)
    press_enter()
    time.sleep(0.5)
    press_enter()
    print("  ChatGPT: sent")
    return chatgpt_wait(ev)

def gemini_wait(ev):
    """Wait for Gemini response"""
    print("  Gemini: wait", end="", flush=True)
    for t in range(60):
        time.sleep(2)
        raw = ev(
            '(function(){'
            'var mr=document.querySelector("model-response");'
            'if(!mr)return"";'
            'var txt=(mr.textContent||"").trim();'
            'if(!txt)return"";'
            'return txt;'
            '})()'
        )
        if raw and isinstance(raw, str) and len(raw) > 30:
            prev_t = raw
            stable = 0
            while stable < 3:
                time.sleep(2)
                cur_raw = ev(
                    '(function(){'
                    'var mr=document.querySelector("model-response");'
                    'if(!mr)return"";'
                    'return (mr.textContent||"").trim();'
                    '})()'
                )
                if cur_raw and isinstance(cur_raw, str):
                    if cur_raw == prev_t:
                        stable += 1
                    else:
                        stable = 0
                        prev_t = cur_raw
                    print(".", end="", flush=True)
            idx_ = prev_t.find("\n")
            if 0 < idx_ < 30:
                prev_t = prev_t[idx_+1:].strip()
            print(" [done len=" + str(len(prev_t)) + "]")
            return "[Gemini] " + prev_t
        print(".", end="", flush=True)
    print(" TIMEOUT")
    return None

def gemini_send(ev, insert_text, press_enter, text):
    """Type + Enter, wait response"""
    ev(
        '(function(){'
        'var ce=document.querySelector("[contenteditable=true]");'
        'if(ce){ce.focus();ce.innerText="";}'
        '})()'
    )
    time.sleep(0.3)
    insert_text(text)
    time.sleep(0.5)
    press_enter()
    print("  Gemini: sent")
    return gemini_wait(ev)

def main():
    tabs = get_tabs()
    ct = next((t for t in tabs if "chatgpt.com" in t["url"] and t["type"]=="page" and "RotateCookies" not in t["url"]), None)
    gt = next((t for t in tabs if "gemini.google.com/app" in t["url"] and "RotateCookies" not in t["url"]), None)

    if not ct or not gt:
        print("Missing tabs:", {"chatgpt": bool(ct), "gemini": bool(gt)})
        return 1

    print(f"ChatGPT: {ct['id'][:8]} {ct['url'][:80]}")
    print(f"Gemini:  {gt['id'][:8]} {gt['url'][:80]}")

    c_ws, c_ev, c_ins, c_enter = cdp_connect(ct)
    g_ws, g_ev, g_ins, g_enter = cdp_connect(gt)

    try:
        print("\n=== ROUND 1: ChatGPT seed ===")
        if not chatgpt_navigate(c_ev):
            print("FAIL: navigate")
            return 1
        c1 = chatgpt_send(c_ev, c_ins, c_enter, SEED)
        if not c1: print("FAIL R1"); return 1
        print("\n" + c1 + "\n")

        print("=== ROUND 2: Gemini rebut ===")
        g1 = gemini_send(g_ev, g_ins, g_enter, inst("ChatGPT", c1))
        if not g1: print("FAIL R2"); return 1
        print("\n" + g1 + "\n")

        print("=== ROUND 3: ChatGPT rebut ===")
        c2 = chatgpt_send(c_ev, c_ins, c_enter, inst("Gemini", g1))
        if not c2: print("FAIL R3"); return 1
        print("\n" + c2 + "\n")

        print("=== ROUND 4: Gemini rebut ===")
        g2 = gemini_send(g_ev, g_ins, g_enter, inst("ChatGPT", c2))
        if not g2: print("FAIL R4"); return 1
        print("\n" + g2 + "\n")

        print("="*60)
        print("RELAY HOAN TAT — 4/4 PASS")
        print("="*60)
        return 0
    finally:
        c_ws.close()
        g_ws.close()

if __name__ == "__main__":
    sys.exit(main())
