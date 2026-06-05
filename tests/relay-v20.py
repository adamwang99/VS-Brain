#!/usr/bin/env python3
"""
CrossCritic v20 — Ứng dụng phản biện chéo ChatGPT ↔ Gemini
Nhận ý kiến người dùng, chạy 4-round rebuttal relay, đưa ra phân tích tổng hợp.

Usage:
    python3 relay-v20.py "Quan điểm của bạn ở đây..."
    python3 relay-v20.py --rounds 3 "Chủ đề muốn phân tích..."
"""
import json, urllib.request, websocket, time, sys, textwrap

# ── Config ──────────────────────────────────────────────
MAX_ROUNDS = 4          # số round phản biện
WAIT_TIMEOUT = 120      # max giây chờ response mỗi model
STABILITY_CHECKS = 3     # số lần check text không đổi để coi là done

# ── CDP Engine ──────────────────────────────────────────
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
        # Auto-wrap in IIFE: global scope khong cho phep return
        if "return" not in expr and "function" not in expr:
            expr = "return " + expr
        wrapped = "(function(){" + expr + "})()"
        r = req("Runtime.evaluate", {"expression": wrapped, "returnByValue": True})
        inner = r.get("result", {})
        if inner.get("subtype") == "error":
            return None
        return inner.get("value")

    def insert_text(text):
        req("Input.insertText", {"text": text})

    def press_enter():
        req("Input.dispatchKeyEvent", {
            "type": "keyDown", "key": "Enter", "keyCode": 13,
            "code": "Enter", "windowsVirtualKeyCode": 13
        })
        time.sleep(0.05)
        req("Input.dispatchKeyEvent", {
            "type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"
        })

    req("Runtime.enable")
    req("Page.enable")
    req("Input.enable")
    return ws, ev, insert_text, press_enter

# ── ChatGPT ─────────────────────────────────────────────
def chatgpt_navigate(ev):
    """Mở ChatGPT fresh thread, chờ editor sẵn sàng"""
    print("  [ChatGPT] Mở thread mới...")
    ev('window.location.href="https://chatgpt.com/"')
    for i in range(40):
        time.sleep(1)
        if ev('!!document.getElementById("prompt-textarea")'):
            print(f"  [ChatGPT] Editor sẵn sàng sau {i+1}s")
            time.sleep(3)
            return True
    return False

def chatgpt_wait(ev):
    """Chờ ChatGPT phản hồi xong → trả text"""
    for t in range(WAIT_TIMEOUT // 2):
        time.sleep(2)
        raw = ev(
            '(function(){'
            'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
            'if(!ms.length)return null;'
            'var last=ms[ms.length-1];'
            'var txt=(last.textContent||"").trim();'
            'return JSON.stringify({l:txt.length,t:txt.substring(0,1500)});'
            '})()'
        )
        if not raw:
            continue
        try:
            d = json.loads(raw)
            if d["l"] > 30:
                prev = d["t"]
                stable = 0
                while stable < STABILITY_CHECKS:
                    time.sleep(2)
                    cur_raw = ev(
                        '(function(){'
                        'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
                        'if(!ms.length)return"";'
                        'return(ms[ms.length-1].textContent||"").trim();'
                        '})()'
                    )
                    if cur_raw and isinstance(cur_raw, str):
                        if cur_raw == prev:
                            stable += 1
                        else:
                            stable = 0
                            prev = cur_raw
                    print(".", end="", flush=True)
                return prev
        except:
            pass
        print(".", end="", flush=True)
    return None

def chatgpt_send(ev, ins, enter, text):
    """Gửi text cho ChatGPT, chờ phản hồi"""
    # Clear + focus
    ev(
        'var el=document.getElementById("prompt-textarea");'
        'if(el){el.focus();el.innerText="";}'
    )
    time.sleep(0.3)
    ins(text)
    time.sleep(1.0)
    # Double Enter (ChatGPT đôi khi cần 2 lần)
    enter()
    time.sleep(0.5)
    enter()
    print("  [ChatGPT] Đã gửi, đang chờ...", end="", flush=True)
    return chatgpt_wait(ev)

# ── Gemini ──────────────────────────────────────────────
def gemini_reload(ev):
    """Reload Gemini tab để tránh cache model-response cũ"""
    ev('window.location.href="https://gemini.google.com/app"')
    for i in range(20):
        time.sleep(1)
        if ev('!!document.querySelector("[contenteditable=true]")'):
            print(f"  [Gemini] Reload xong sau {i+1}s")
            time.sleep(2)
            return True
    return False

def gemini_wait(ev):
    """Chờ Gemini phản hồi xong → trả text"""
    for t in range(WAIT_TIMEOUT // 2):
        time.sleep(2)
        raw = ev(
            '(function(){'
            'var mr=document.querySelector("model-response");'
            'if(!mr)return null;'
            'var txt=(mr.textContent||"").trim();'
            'if(!txt)return null;'
            'return txt;'
            '})()'
        )
        if not raw or not isinstance(raw, str) or len(raw) < 30:
            print(".", end="", flush=True)
            continue
        # Stability check
        prev = raw
        stable = 0
        while stable < STABILITY_CHECKS:
            time.sleep(2)
            cur = ev(
                '(function(){'
                'var mr=document.querySelector("model-response");'
                'if(!mr)return"";'
                'return (mr.textContent||"").trim();'
                '})()'
            )
            if cur and isinstance(cur, str) and cur == prev:
                stable += 1
            elif cur and isinstance(cur, str):
                stable = 0
                prev = cur
            print(".", end="", flush=True)
        # Strip first short line (navigation hint)
        idx = prev.find("\n")
        if 0 < idx < 30:
            prev = prev[idx+1:].strip()
        return prev
    return None

def gemini_send(ev, ins, enter, text):
    """Gửi text cho Gemini, chờ phản hồi"""
    # Clear input
    ev(
        'var ce=document.querySelector("[contenteditable=true]");'
        'if(ce){ce.focus();ce.innerText="";}'
    )
    time.sleep(0.3)
    ins(text)
    time.sleep(1.0)
    # Click send button (Gemini dùng aria-label="Gửi tin nhắn", không nhận Enter)
    ev(
        '(function(){'
        'var btns=document.querySelectorAll("button[aria-label]");'
        'for(var i=0;i<btns.length;i++){'
        'if(btns[i].getAttribute("aria-label")==="Gửi tin nhắn"){'
        'btns[i].click();return"clicked";'
        '}}'
        'return"not-found";'
        '})()'
    )
    print("  [Gemini] Đã gửi, đang chờ...", end="", flush=True)
    return gemini_wait(ev)

# ── Prompt Engineering ──────────────────────────────────
def critique_prompt(source_name, source_text, is_first=False):
    """Tạo prompt phản biện"""
    if is_first:
        return (
            f"PHÂN TÍCH BAN ĐẦU:\n\n"
            f"Người dùng đưa ra ý kiến sau:\n\"{source_text}\"\n\n"
            f"Hãy phân tích sâu ý kiến này. Đánh giá điểm mạnh, điểm yếu, "
            f"các giả định ngầm, và đưa ra góc nhìn đa chiều. "
            f"Trả lời bằng tiếng Việt, dài khoảng 300-500 từ."
        )

    return (
        f"PHẢN BIỆN CHÉO:\n\n"
        f"{source_name} vừa phân tích:\n\"{source_text}\"\n\n"
        f"Nhiệm vụ của bạn: Phản biện lại phân tích trên — "
        f"chỉ ra những điểm yếu trong lập luận, các góc nhìn bị bỏ sót, "
        f"hoặc các giả định sai lầm. Đưa ra lập luận đối trọng cụ thể. "
        f"Trả lời bằng tiếng Việt, dài khoảng 300-500 từ."
    )

def synthesis_prompt(history):
    """Tạo prompt tổng hợp cuối cùng"""
    parts = []
    for i, (speaker, text) in enumerate(history):
        parts.append(f"Vòng {i+1} — {speaker}:\n{text[:500]}")
    full = "\n\n".join(parts)

    return (
        f"TỔNG HỢP CUỐI CÙNG:\n\n"
        f"Sau {len(history)} vòng phản biện chéo giữa các mô hình AI, "
        f"dưới đây là toàn bộ lịch sử tranh luận:\n\n"
        f"{full}\n\n"
        f"Nhiệm vụ: Tổng hợp và đưa ra PHÂN TÍCH CUỐI CÙNG chính xác nhất. "
        f"Bạn phải:\n"
        f"1. Tóm tắt các luồng lập luận chính từ cả hai phía\n"
        f"2. Chỉ ra đâu là điểm đồng thuận, đâu là bất đồng cốt lõi\n"
        f"3. Đưa ra kết luận cân bằng nhất dựa trên toàn bộ bằng chứng\n"
        f"4. Nêu các khía cạnh còn bỏ ngỏ cần nghiên cứu thêm\n\n"
        f"Trả lời bằng tiếng Việt, cấu trúc rõ ràng, dài 400-600 từ."
    )

# ── Main Pipeline ───────────────────────────────────────
def print_divider(char="─", width=70):
    print(char * width)

def print_header(text):
    print(f"\n{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}")

def run_pipeline(user_input, rounds=4):
    """
    Pipeline chính:
    1. Kết nối CDP
    2. ChatGPT phân tích input người dùng (R1)
    3. Gemini phản biện (R2)
    4. ChatGPT phản biện lại (R3)
    5. Gemini phản biện cuối (R4)
    6. ChatGPT tổng hợp final verdict
    """
    tabs = get_tabs()
    ct = next((t for t in tabs if "chatgpt.com" in t["url"]
               and t["type"] == "page" and "RotateCookies" not in t["url"]), None)
    gt = next((t for t in tabs if "gemini.google.com/app" in t["url"]
               and "RotateCookies" not in t["url"]), None)

    if not ct or not gt:
        print("❌ THIẾU TAB TRÌNH DUYỆT")
        print(f"   ChatGPT: {'✅' if ct else '❌ (mở https://chatgpt.com/)'}")
        print(f"   Gemini:  {'✅' if gt else '❌ (mở https://gemini.google.com/)'}")
        return 1

    print(f"\n📋 Tab ChatGPT: {ct['id'][:8]} | {ct.get('title','')[:50]}")
    print(f"📋 Tab Gemini:  {gt['id'][:8]} | {gt.get('title','')[:50]}")
    print(f"\n📝 Input: \"{user_input[:100]}{'...' if len(user_input)>100 else ''}\"")
    print(f"🔄 Số vòng phản biện: {rounds}")

    c_ws, c_ev, c_ins, c_enter = cdp_connect(ct)
    g_ws, g_ev, g_ins, g_enter = cdp_connect(gt)

    history = []  # [(speaker, text)]

    try:
        # ── Navigate ChatGPT fresh thread ──
        print_header("CHUẨN BỊ")
        if not chatgpt_navigate(c_ev):
            print("❌ ChatGPT không load được editor")
            return 1

        # ── R1: ChatGPT phân tích ban đầu ──
        print_header("VÒNG 1 — ChatGPT Phân tích ban đầu")
        r1 = chatgpt_send(c_ev, c_ins, c_enter, critique_prompt("User", user_input, is_first=True))
        if not r1:
            print("❌ ChatGPT R1 không phản hồi")
            return 1
        print(f"\n✅ VÒNG 1 — ChatGPT ({len(r1)} ký tự):")
        print_divider("─")
        print(textwrap.fill(r1, width=70))
        print_divider("─")
        history.append(("ChatGPT (phân tích)", r1))

        # ── R2: Gemini phản biện ──
        print_header("VÒNG 2 — Gemini Phản biện")
        # Reload Gemini để tránh cache
        if not gemini_reload(g_ev):
            print("⚠️ Gemini reload lỗi, tiếp tục với tab hiện tại...")
        r2 = gemini_send(g_ev, g_ins, g_enter, critique_prompt("ChatGPT", r1))
        if not r2:
            print("❌ Gemini R2 không phản hồi")
            return 1
        print(f"\n✅ VÒNG 2 — Gemini ({len(r2)} ký tự):")
        print_divider("─")
        print(textwrap.fill(r2, width=70))
        print_divider("─")
        history.append(("Gemini (phản biện)", r2))

        # ── R3: ChatGPT phản biện Gemini ──
        print_header("VÒNG 3 — ChatGPT Phản biện lại")
        r3 = chatgpt_send(c_ev, c_ins, c_enter, critique_prompt("Gemini", r2))
        if not r3:
            print("❌ ChatGPT R3 không phản hồi")
            return 1
        print(f"\n✅ VÒNG 3 — ChatGPT ({len(r3)} ký tự):")
        print_divider("─")
        print(textwrap.fill(r3, width=70))
        print_divider("─")
        history.append(("ChatGPT (phản biện lại)", r3))

        # ── R4: Gemini phản biện cuối ──
        if rounds >= 4:
            print_header("VÒNG 4 — Gemini Phản biện cuối")
            if not gemini_reload(g_ev):
                print("⚠️ Gemini reload lỗi, tiếp tục...")
            r4 = gemini_send(g_ev, g_ins, g_enter, critique_prompt("ChatGPT", r3))
            if not r4:
                print("⚠️ Gemini R4 không phản hồi, bỏ qua...")
            else:
                print(f"\n✅ VÒNG 4 — Gemini ({len(r4)} ký tự):")
                print_divider("─")
                print(textwrap.fill(r4, width=70))
                print_divider("─")
                history.append(("Gemini (phản biện cuối)", r4))

        # ── SYNTHESIS: ChatGPT tổng hợp cuối cùng ──
        print_header("TỔNG HỢP CUỐI CÙNG")
        final = chatgpt_send(c_ev, c_ins, c_enter, synthesis_prompt(history))
        if not final:
            print("⚠️ Tổng hợp không thành công, hiển thị kết quả từng vòng")
        else:
            print(f"\n✅ KẾT QUẢ TỔNG HỢP ({len(final)} ký tự):")
            print_divider("═")
            print(textwrap.fill(final, width=70))
            print_divider("═")

        # ── Summary ──
        print_header("KẾT QUẢ RELAY")
        print(f"  Số vòng hoàn thành: {len(history)}/{rounds}")
        for i, (speaker, text) in enumerate(history):
            print(f"  Vòng {i+1}: {speaker} — {len(text)} ký tự")
        if final:
            print(f"  Tổng hợp cuối: {len(final)} ký tự")
        return 0

    finally:
        c_ws.close()
        g_ws.close()

# ── Entry ───────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    rounds = MAX_ROUNDS
    user_input = None

    i = 0
    while i < len(args):
        if args[i] == "--rounds" and i + 1 < len(args):
            rounds = int(args[i+1])
            i += 2
        else:
            user_input = " ".join(args[i:])
            break

    if not user_input:
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║        CROSSCRITIC — Phản biện chéo AI                       ║")
        print("║        ChatGPT ↔ Gemini | Phân tích đa chiều                 ║")
        print("╠══════════════════════════════════════════════════════════════╣")
        print("║ Usage:                                                       ║")
        print("║   python3 relay-v20.py \"Ý kiến của bạn...\"                  ║")
        print("║   python3 relay-v20.py --rounds 3 \"Chủ đề...\"               ║")
        print("║                                                              ║")
        print("║ Yêu cầu: Mở sẵn tab ChatGPT + Gemini trên Chrome             ║")
        print("║          Chrome phải chạy với --remote-debugging-port=9222   ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        return 0

    return run_pipeline(user_input, rounds)

if __name__ == "__main__":
    sys.exit(main())
