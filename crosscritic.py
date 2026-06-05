#!/usr/bin/env python3
"""
CrossCritic v22 — Ứng dụng phản biện chéo ChatGPT ↔ Gemini
Cho người dùng thật: nhập bất kỳ ý kiến/lĩnh vực nào → phân tích đa chiều chuẩn xác nhất.

Usage:
    python3 crosscritic.py "Ý kiến của bạn về bất kỳ chủ đề nào..."
    
Yêu cầu: Chrome mở với --remote-debugging-port=9222 + 2 tab đã login ChatGPT & Gemini.
"""
import json, urllib.request, websocket, time, sys, textwrap, hashlib, os
from datetime import datetime

# ─── CONFIG ─────────────────────────────────────────────
TIMEOUT = 180       # max giây chờ response mỗi model (tăng lên vì ChatGPT có thể detect bot và response chậm)
STABLE = 3          # số lần đọc text ổn định liên tiếp
COLOR = True        # output màu
import random        # thêm random cho human-like delay

# Terminal colors
if COLOR and sys.stdout.isatty():
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'
else:
    CYAN = GREEN = YELLOW = RED = BOLD = DIM = RESET = ''

def c(text, color):
    return f"{color}{text}{RESET}" if COLOR else text

# ─── CDP ENGINE ─────────────────────────────────────────
def get_tabs():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())

def cdp_connect(tab):
    """Kết nối CDP WebSocket, trả về (ws, eval_fn, ins_text_fn, enter_fn)"""
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
    cid = [0]
    buf = []

    def req(method, params=None):
        cid[0] += 1
        ws.send(json.dumps({"id": cid[0], "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == cid[0]:
                return msg.get("result", {})
            buf.append(msg)  # Buffer unexpected messages

    def ev(expr):
        """Evaluate JS expression in page context.
        - If expr is already an IIFE: pass through directly
        - If expr has return/function keywords: wrap in IIFE
        - If expr is a simple expression: add `return` prefix then wrap"""
        if expr.strip().startswith('(function') and expr.strip().endswith(')()'):
            # Already an IIFE — pass through directly
            wrapped = expr
        elif "return" in expr or "function" in expr:
            # Has return or function — wrap without adding return
            wrapped = "(function(){" + expr + "})()"
        else:
            # Simple expression — add return
            wrapped = "(function(){return " + expr + "})()"
        r = req("Runtime.evaluate", {"expression": wrapped, "returnByValue": True})
        inner = r.get("result", {})
        if inner.get("subtype") == "error":
            return None
        return inner.get("value")

    def ins(text):
        req("Input.insertText", {"text": text})

    def ins_typed(text):
        """Insert text char-by-char via document.execCommand('insertText') via Runtime.evaluate
        Dùng cho ChatGPT: Input.insertText bị detect là automation, execCommand thì pass."""
        for ch in text:
            escaped = json.dumps(ch)
            ev(f'(function(){{document.execCommand("insertText",false,{escaped});}})()')
            time.sleep(0.01)

    def enter():
        req("Input.dispatchKeyEvent", {
            "type": "keyDown", "key": "Enter", "keyCode": 13,
            "code": "Enter", "windowsVirtualKeyCode": 13
        })
        time.sleep(0.05)
        req("Input.dispatchKeyEvent", {
            "type": "keyUp", "key": "Enter", "keyCode": 13, "code": "Enter"
        })

    def clear_editor():
        """Xóa toàn bộ nội dung editor bằng Ctrl+A + Delete qua CDP.
        Dùng Input.dispatchKeyEvent vì ProseMirror không nhận execCommand."""
        # Focus editor trước
        ev(
            '(function(){'
            'var el=document.getElementById("prompt-textarea");'
            'if(el){el.focus();return"OK";}'
            'return"NO_EL";'
            '})()'
        )
        time.sleep(0.1)
        # Ctrl+A
        req("Input.dispatchKeyEvent", {
            "type": "keyDown", "key": "a", "code": "KeyA",
            "keyCode": 65, "windowsVirtualKeyCode": 65,
            "modifiers": 2  # Ctrl
        })
        time.sleep(0.05)
        req("Input.dispatchKeyEvent", {
            "type": "keyUp", "key": "a", "code": "KeyA",
            "keyCode": 65, "windowsVirtualKeyCode": 65,
            "modifiers": 2
        })
        time.sleep(0.05)
        # Delete
        req("Input.dispatchKeyEvent", {
            "type": "keyDown", "key": "Delete", "code": "Delete",
            "keyCode": 46, "windowsVirtualKeyCode": 46
        })
        time.sleep(0.05)
        req("Input.dispatchKeyEvent", {
            "type": "keyUp", "key": "Delete", "code": "Delete",
            "keyCode": 46, "windowsVirtualKeyCode": 46
        })
        time.sleep(0.1)

    req("Runtime.enable")
    req("Page.enable")
    req("Input.enable")
    return ws, ev, ins, ins_typed, enter, clear_editor

# ─── CHATGPT ────────────────────────────────────────────
def chatgpt_navigate(ev):
    """"Mở ChatGPT fresh thread — click New Chat button thay vì navigate URL"""
    print(f"  {c('[ChatGPT]', CYAN)} Mở thread mới...")
    # Click "New Chat" button để reset trạng thái SPA
    # Dùng IIFE trực tiếp (ev() không wrap thêm vì có function keyword)
    ev(
        '(function(){'
        'var btn=document.querySelector("[data-testid=create-new-chat-button]");'
        'if(btn){btn.click();window.__xNav="BUTTON";return}'
        'var links=document.querySelectorAll("a");'
        'window.__xNav="NOLINK";'
        'for(var i=0;i<links.length;i++){'
        'var txt=(links[i].textContent||"").trim();'
        'if(txt.indexOf("mới")>=0||txt.indexOf("New Chat")>=0||txt.indexOf("new chat")>=0){'
        'links[i].click();window.__xNav="A_CLICK";return}'
        '}'
        'window.location.href="https://chatgpt.com/";window.__xNav="NAV"'
        '})()'
    )
    for i in range(30):
        time.sleep(1)
        editor = ev('!!document.getElementById("prompt-textarea")')
        url = ev('window.location.href')
        if editor and url and '/c/' not in str(url):
            print(f"  {c('[ChatGPT]', CYAN)} Sẵn sàng ({(i + 1)}s) — {ev('window.__xNav')}")
            time.sleep(3)  # Ổn định DOM
            return True
    return False

def chatgpt_wait(ev):
    """Chờ ChatGPT response xong bằng polling DOM.
    ChatGPT dùng streaming fetch — text render dần vào DOM.
    Chiến lược: poll mỗi 1.5s, bắt streaming indicator, ổn định text 3 lần."""
    print(f"  {c('[ChatGPT]', CYAN)} chờ...", end="", flush=True)
    
    prev_len = -1
    stable_count = 0
    had_text = False
    
    for i in range(TIMEOUT // 1):
        time.sleep(1.5)
        
        # Đọc last assistant message + streaming indicator
        state = ev(
            '(function(){'
            'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
            'if(!ms||!ms.length)return JSON.stringify({len:-1,text:"",streaming:false,count:0});'
            'var last=ms[ms.length-1];'
            'var text=(last.textContent||"").trim();'
            'if(text.indexOf("ChatGPT Instruments")>=0||text.indexOf("Cung cấp phản hồi")>=0)text="";'
            'var streaming=!!document.querySelector(".result-streaming")||!!document.querySelector("[data-stream]");'
            'return JSON.stringify({len:text.length,text:text,streaming:streaming,count:ms.length});'
            '})()'
        )
        
        if not isinstance(state, str) or not state:
            # ev() failed — retry
            print("?", end="", flush=True)
            continue
        
        # Parse JSON state
        try:
            state = json.loads(state)
        except (json.JSONDecodeError, TypeError):
            print("J", end="", flush=True)
            continue
        
        cur_len = state.get("len", -1)
        is_streaming = state.get("streaming", False)
        msg_count = state.get("count", 0)
        
        if msg_count == 0 or cur_len < 0:
            # Chưa có assistant message nào — đợi tiếp
            print(".", end="", flush=True)
            continue
        
        if cur_len > 0:
            had_text = True
        
        if cur_len != prev_len:
            # Text đang stream — reset stability
            delta = cur_len - prev_len if prev_len >= 0 else cur_len
            prev_len = cur_len
            stable_count = 0
            if delta > 0:
                print("+", end="", flush=True)
                continue
        else:
            # Text không đổi — tăng stable count
            stable_count += 1
            if is_streaming:
                print("s", end="", flush=True)
            else:
                print(".", end="", flush=True)
        
        # Stable 3 lần liên tiếp + có text + không streaming = done
        if stable_count >= STABLE and cur_len > 50 and not is_streaming:
            final_text = state.get("text", "")
            print(f" {c('[' + str(cur_len) + ' chars]', GREEN)}")
            return final_text
        
        # Timeout safety: nếu có text và stable lâu hơn
        if stable_count >= 8 and cur_len > 100:
            final_text = state.get("text", "")
            print(f" {c('[' + str(cur_len) + ' chars ~stb]', GREEN)}")
            return final_text
    
    # After full timeout: return whatever text we got
    if had_text:
        final_text = ev(
            'var ms=document.querySelectorAll("[data-message-author-role=assistant]");'
            'if(!ms.length)return"";'
            'return (ms[ms.length-1].textContent||"").trim();'
        )
        if isinstance(final_text, str) and len(final_text) > 50:
            print(f" {c('[' + str(len(final_text)) + ' chars T/O]', YELLOW)}")
            return final_text
    
    print(f" {c('[TIMEOUT]', RED)}")
    return None

def chatgpt_send(ev, ins, ins_typed, enter, clear_editor, text):
    """Gửi message cho ChatGPT, chờ response.
    Clear editor → execCommand insertText full text → verify → click Send."""
    # Clear editor
    clear_editor()
    time.sleep(random.uniform(0.3, 0.7))
    
    # Insert FULL text via single execCommand (tránh race condition với char-by-char)
    escaped = json.dumps(text)
    inserted = ev(
        f'(function(){{'
        f'var ed=document.getElementById("prompt-textarea");'
        f'if(ed)ed.focus();'
        f'document.execCommand("insertText",false,{escaped});'
        f'var el=document.getElementById("prompt-textarea");'
        f'return (el.textContent||el.innerText||"").length;'
        f'}})()'
    )
    
    if isinstance(inserted, (int, float)) and inserted < len(text) * 0.5:
        # Insert thất bại — retry với char-by-char fallback
        print(f"  {c('[ChatGPT]', YELLOW)} insert partial ({inserted}/{len(text)}), retry char-by-char...")
        clear_editor()
        time.sleep(0.3)
        ins_typed(text)  # Char-by-char fallback
        time.sleep(0.5)
    else:
        print(f"  {c('[ChatGPT]', DIM)} insert OK ({inserted} chars)", end=" ", flush=True)
    
    time.sleep(random.uniform(1.0, 2.0))
    # Click send button
    r = ev(
        'var btn=document.querySelector("[data-testid=send-button]");'
        'if(btn&&!btn.disabled){btn.click();return"send"}'
        'var bs=document.querySelectorAll("button[aria-label]");'
        'for(var i=0;i<bs.length;i++)'
        'if(bs[i].getAttribute("aria-label")==="Gửi lời nhắc"&&!bs[i].disabled)'
        '{bs[i].click();return"send"}'
        'return"nobtn"'
    )
    if r == "nobtn":
        # Fallback: Enter key
        enter()
        time.sleep(random.uniform(0.3, 0.7))
        enter()
    return chatgpt_wait(ev)

# ─── GEMINI ─────────────────────────────────────────────
def gemini_ensure(ev, ws=None):
    """Đảm bảo Gemini đã load xong, editor có thể nhập.
    
    Cookie rotation handling:
    - Nếu URL đã là gemini.google.com, KHÔNG navigate (tránh trigger rotation lại)
    - Nếu URL là rotation page, navigate 1 lần
    - Đóng rotation tabs phát sinh sau navigate
    - Đợi editor + hết .dot-typing (max 120s)
    """
    url = ev('window.location.href')
    ce = ev('!!document.querySelector("[contenteditable=true]")')
    
    # Nếu đã ở gemini.google.com, chỉ wait — không navigate để tránh rotation loop
    if ce:
        print(f"  {c('[Gemini]', YELLOW)} Sẵn sàng (1s)")
        time.sleep(1)
        return True
    
    if url and 'gemini.google.com' in str(url):
        # Đã đúng URL, chỉ cần wait editor load
        print(f"  {c('[Gemini]', YELLOW)} Chờ editor load...")
    else:
        # URL không đúng (rotation page hoặc blank), navigate 1 lần
        print(f"  {c('[Gemini]', YELLOW)} Đang navigate về /app...")
        if ws:
            cid = [9999]
            ws.send(json.dumps({'id': cid[0], 'method': 'Page.navigate', 'params': {'url': 'https://gemini.google.com/app'}}))
        else:
            ev('window.location.href="https://gemini.google.com/app"')
        time.sleep(3)
    
    # Wait for editor ready
    for i in range(120):
        time.sleep(1)
        
        # Đóng rotation tabs gây interrupt
        if i % 10 == 0:
            try:
                import urllib.request
                all_tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
                for tab2 in all_tabs:
                    if 'RotateCookies' in tab2.get('url', '') or 'RotateCookies' in tab2.get('title', ''):
                        ws2 = websocket.create_connection(tab2['webSocketDebuggerUrl'], timeout=5)
                        ws2.send(json.dumps({'id': 1, 'method': 'Page.close', 'params': {}}))
                        ws2.close()
            except Exception:
                pass
        
        ce = ev('!!document.querySelector("[contenteditable=true]")')
        url2 = ev('window.location.href')
        if not ce or not url2 or 'gemini.google.com' not in str(url2):
            if i % 10 == 0 and i > 0:
                print(f"[{i}s] url={str(url2)[:50] if url2 else 'none'} ce={ce}")
            continue
        
        dot_typing = ev('!!document.querySelector(".dot-typing")')
        if dot_typing and i < 30:
            if i % 5 == 0:
                print("⏳", end="", flush=True)
            continue
        
        print(f"  {c('[Gemini]', YELLOW)} Sẵn sàng ({(i + 1)}s)")
        time.sleep(2)
        return True
    
    # Timeout — check if editor exists anyway
    ce = ev('!!document.querySelector("[contenteditable=true]")')
    if ce:
        print(f"  {c('[Gemini]', YELLOW)} Timeout, dùng editor có sẵn")
        time.sleep(2)
        return True
    print(f"  {c('[Gemini]', RED)} Navigate thất bại")
    return False

def gemini_new_conversation(ev, ws):
    """Mở conversation mới hoàn toàn trong Gemini — xóa model-response cũ khỏi DOM."""
    print(f"  {c('[Gemini]', YELLOW)} New thread...", end="", flush=True)
    # Click nút New Chat (dấu +) trong sidebar
    r = ev(
        'var btn=document.querySelector("[data-test-id=new-chat-button]")||'
        'document.querySelector("[aria-label=\"New chat\"]")||'
        'document.querySelector("a[href=\"/app\"]");'
        'if(btn){btn.click();return"clicked"}'
        'return"no_btn"'
    )
    time.sleep(2)
    if isinstance(r, str) and r == "clicked":
        # Dùng gemini_ensure đợi editor thay vì wait ngắn
        time.sleep(2)
        return gemini_ensure(ev, ws)
    # Fallback: navigate
    print(f" navigate")
    cid = [9999]
    ws.send(json.dumps({'id': cid[0], 'method': 'Page.navigate', 'params': {'url': 'https://gemini.google.com/app'}}))
    time.sleep(4)
    # Dùng gemini_ensure để đợi editor đúng cách thay vì chỉ check ce một lần
    return gemini_ensure(ev, ws)

def gemini_prescan(ev, hashes_set):
    """Scan model-response hiện tại → hash vào known_hashes để skip"""
    raw = ev(
        'var mrs=document.querySelectorAll("model-response");'
        'if(!mrs.length)return"";'
        'var mr=mrs[mrs.length-1];'
        'return(mr.textContent||"").trim();'
    )

    if raw and isinstance(raw, str) and len(raw) > 30:
        h = hashlib.md5(raw.encode()).hexdigest()
        hashes_set.add(h)
        header = raw[:40].replace('\n', ' ')
        print(f"  {c('[Gemini]', YELLOW)} Pre-scan: {len(raw)} chars, hash={h[:8]}... [{header}]")
        return True
    print(f"  {c('[Gemini]', YELLOW)} Pre-scan: không có model-response cũ")
    return False

def gemini_wait(ev, known_hashes=None):
    """Chờ Gemini response, skip hash trùng (cache).
    Check loading indicator để tránh loop 'C' vô hạn khi Gemini đang generate."""
    known_hashes = known_hashes or set()
    print(f"  {c('[Gemini]', YELLOW)} chờ...", end="", flush=True)
    cc_count = 0  # hash-match counter
    for _ in range(TIMEOUT // 2):
        time.sleep(2)
        # Check for cookie rotation redirect
        url = ev('window.location.href')
        if url and 'gemini.google.com' not in str(url):
            print(f" {c('COOKIE ROTATION', RED)}")
            return None, None
        
        # Read last model-response + loading indicator
        state = ev(
            '(function(){'
            'var mrs=document.querySelectorAll("model-response");'
            'var last_txt="";'
            'if(mrs.length>0)last_txt=(mrs[mrs.length-1].textContent||"").trim();'
            'var chat_area=document.querySelector("mat-sidenav-content, .main-content, .chat-content, [class*=chat], [class*=main]");'
            'var loading=false;'
            'if(chat_area){'
            '  loading=!!chat_area.querySelector(".dot-typing")||!!chat_area.querySelector("[data-test-id=stop-generation-button]");'
            '} else {'
            '  loading=!!document.querySelector(".dot-typing")||!!document.querySelector("[data-test-id=stop-generation-button]");'
            '}'
            'var generating=!!document.querySelector("[data-test-id=stop-generation-button]");'
            'return JSON.stringify({text:last_txt,count:mrs.length,loading:loading,generating:generating});'
            '})()'
        )
        
        if not isinstance(state, str) or not state:
            print("?", end="", flush=True)
            continue
        
        try:
            state = json.loads(state)
        except (json.JSONDecodeError, TypeError):
            print("J", end="", flush=True)
            continue
        
        txt = state.get("text", "")
        is_loading = state.get("loading", False)
        is_generating = state.get("generating", False)
        
        if not txt or len(txt) < 50:
            # No text yet — show loading state
            if is_loading or is_generating:
                print("⏳", end="", flush=True)
            else:
                print(".", end="", flush=True)
            continue
        
        # Skip cache (text from previous round)
        txt_hash = hashlib.md5(txt.encode()).hexdigest()
        if txt_hash in known_hashes:
            cc_count += 1
            if is_loading or is_generating:
                # Still generating — show progress indicator
                if cc_count % 10 == 0:
                    print(f" ⏳{cc_count}", end="", flush=True)
            else:
                # Hash match but not loading — might be stuck
                if cc_count % 5 == 0:
                    print(f" C{cc_count}", end="", flush=True)
            time.sleep(1)
            continue
        # Stability check
        prev = txt
        stable = 0
        while stable < STABLE:
            time.sleep(2)
            # Check for cookie rotation during stability
            url2 = ev('window.location.href')
            if url2 and 'gemini.google.com' not in str(url2):
                print(f" {c('COOKIE ROTATION', RED)}")
                return None, None
            cur = ev(
                'var mrs=document.querySelectorAll("model-response");'
                'if(!mrs.length)return"";'
                'var mr=mrs[mrs.length-1];'
                'return(mr.textContent||"").trim();'
            )
            if isinstance(cur, str) and cur == prev:
                stable += 1
            elif isinstance(cur, str) and cur:
                stable = 0
                prev = cur
            print(".", end="", flush=True)
        # Strip first short line (navigation hint)
        idx = prev.find("\n")
        if 0 < idx < 30:
            prev = prev[idx + 1:].strip()
        # Strip Gemini UI prefix ("Gemini đã nói", "Gemini said", etc)
        prefixes = ["Gemini đã nói", "Gemini said", "Gemini says"]
        for pfx in prefixes:
            if prev.startswith(pfx):
                prev = prev[len(pfx):].strip()
                break
        print(f" {c('[' + str(len(prev)) + ' chars]', GREEN)}")
        return prev, hashlib.md5(prev.encode()).hexdigest()
    print(f" {c('[TIMEOUT]', RED)}")
    return None, None

def gemini_clear(ev):
    """Clear Gemini Quill editor — xóa toàn bộ nội dung trong .ql-editor"""
    ev(
        '(function(){'
        'var ce=document.querySelector(".ql-editor");'
        'if(!ce)return"NO_EDITOR";'
        'ce.innerHTML="";'
        'ce.dispatchEvent(new Event("input",{bubbles:true}));'
        'return"CLEARED";'
        '})()'
    )

def gemini_send(ev, ins, enter, text):
    """Gửi message cho Gemini.
    Chiến lược: click "Gửi tin nhắn" button -> JS dispatch Enter -> fallback CDP Enter
    Có verify editor content + retry insert."""
    gemini_clear(ev)
    time.sleep(0.5)
    ins(text)
    time.sleep(2.0)
    
    # Verify: kiem tra text da insert thanh cong chua
    actual_len = ev(
        'var ce=document.querySelector(".ql-editor");'
        'return ce?(ce.textContent||"").length:0'
    )
    if not isinstance(actual_len, (int, float)) or actual_len < 50:
        # Chua insert thanh cong thu lai bang JS
        print(f"  {c('[Gemini]', DIM)} insert retry")
        ev(
            '(function(){'
            'var ce=document.querySelector(".ql-editor");'
            'if(!ce)return"no_ce";'
            'ce.innerHTML="";'
            'ce.textContent="";'
            'var p=document.createElement("p");'
            'p.textContent=' + json.dumps(text) + ';'
            'ce.appendChild(p);'
            'ce.dispatchEvent(new Event("input",{bubbles:true}));'
            'return"retry_done"'
            '})()'
        )
        time.sleep(1.0)
    
    # Cach 1: Click "Gui tin nhan" button
    r = ev(
        'var btn=document.querySelector("[aria-label=\\"Gửi tin nhắn\\"]");'
        'if(btn&&!btn.disabled&&btn.offsetParent!==null){btn.click();return"send"}'
        'return"nobtn"'
    )
    if r == "send":
        print(f"  {c('[Gemini]', DIM)} clicked send button")
        return True
    
    # Cách 2: JS dispatch Enter (Quill editor cần JS event, không phải CDP key)
    r = ev(
        'var ed=document.querySelector(".ql-editor");'
        'if(ed){ed.focus();'
        'var e1=new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true});'
        'var e2=new KeyboardEvent("keyup",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true});'
        'ed.dispatchEvent(e1);'
        'ed.dispatchEvent(e2);'
        'return"enter_js"}'
        'return"no_ed"'
    )
    if r == "enter_js":
        print(f"  {c('[Gemini]', DIM)} dispatch Enter via JS")
        return True
    
    # Cách 3: CDP Enter (fallback)
    print(f"  {c('[Gemini]', DIM)} dùng CDP Enter")
    enter()
    return True

# ─── PROMPT ENGINEERING ─────────────────────────────────
def p_analysis(user_input):
    return textwrap.dedent(f"""\
Bạn giúp mình phân tích kỹ về chủ đề này nhé:

"{user_input}"

Mình muốn có một phân tích sâu, khách quan, chỉ ra cả mặt mạnh, mặt yếu, các giả định ngầm và các góc nhìn khác nhau. Nếu có dẫn chứng cụ thể thì càng tốt.

Trả lời bằng tiếng Việt, khoảng 300-500 từ.""")

def p_rebut(who, text):
    """Rút gọn text để prompt không quá dài"""
    truncated = text[:1500] if len(text) > 1500 else text
    return textwrap.dedent(f"""\
{who} mới đưa ra một phân tích thế này:

"{truncated}"

Bạn xem lại phân tích này giúp mình nhé. Có điểm nào cần phản bác, thiếu sót, hoặc góc nhìn nào bị bỏ qua không? Hãy phản biện một cách sắc bén nhưng công tâm.

Trả lời bằng tiếng Việt, khoảng 300-500 từ.""")

def p_synthesis(history):
    parts = []
    for i, (who, txt) in enumerate(history):
        parts.append(f"[Vòng {i+1}] Ý kiến của {who}:\n{txt[:500]}")
    transcript = "\n\n".join(parts)
    return textwrap.dedent(f"""\
Sau vài vòng thảo luận, dưới đây là toàn bộ nội dung:

{transcript}

Bạn giúp mình tổng hợp lại nhé:
1. Các luồng lập luận chính
2. Điểm đồng thuận và bất đồng
3. Kết luận cân bằng nhất dựa trên các bằng chứng
4. Những khía cạnh cần nghiên cứu thêm

Trả lời bằng tiếng Việt, cấu trúc rõ ràng, khoảng 400-600 từ.""")

# ─── PRETTY PRINT ───────────────────────────────────────
def section(title):
    w = 72
    print(f"\n{c('═' * w, BOLD)}")
    print(f"{c('  ' + title, BOLD)}")
    print(f"{c('═' * w, BOLD)}")

def print_response(label, text, color=GREEN):
    w = 72
    print(f"\n{c(f'  [{label}] ({len(text)} ký tự):', BOLD + color)}")
    print(f"{c('─' * w, DIM)}")
    for line in text.split('\n'):
        wrapped = textwrap.fill(line, width=w, break_long_words=False)
        if wrapped:
            print(wrapped)
        else:
            print()
    print(f"{c('─' * w, DIM)}")

def print_history(history, final_text=None):
    """In bảng tóm tắt kết quả"""
    print(f"\n{c('╔══════════════════════════════════════════════════════════╗', BOLD)}")
    print(f"{c('║', BOLD)}  {c('CROSSCRITIC — KẾT QUẢ PHẢN BIỆN CHÉO', BOLD)}")
    print(f"{c('╠══════════════════════════════════════════════════════════╣', BOLD)}")
    print(f"{c('║', BOLD)}  Số vòng hoàn thành: {len(history)}/4{' ' * 33}")
    print(f"{c('║', BOLD)}  {'─' * 54}")
    for i, (who, txt) in enumerate(history):
        model = "ChatGPT" if "ChatGPT" in who else "Gemini"
        role = who.split("(")[-1].rstrip(")") if "(" in who else ""
        print(f"{c('║', BOLD)}  R{i+1}: {model:10s} | {len(txt):5d} ký tự | {role}")
    print(f"{c('║', BOLD)}  {'─' * 54}")
    if final_text:
        print(f"{c('║', BOLD)}  TỔNG HỢP: {'ChatGPT':10s} | {len(final_text):5d} ký tự")
    print(f"{c('╚══════════════════════════════════════════════════════════╝', BOLD)}")

# ─── SAVE RESULTS ───────────────────────────────────────
def save_results(user_input, history, final_text):
    out_dir = "/home/phuong/.openclaw/workspace/projects/crosscritic/results"
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"crosscritic_{ts}.md"
    path = os.path.join(out_dir, fname)

    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# CrossCritic — Kết quả phản biện chéo\n")
        f.write(f"**Thời gian:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"## Input người dùng\n\n> {user_input}\n\n")
        f.write("## Lịch sử phản biện\n\n")
        for i, (who, txt) in enumerate(history):
            f.write(f"### Vòng {i+1}: {who}\n\n{txt}\n\n")
        if final_text:
            f.write("## Tổng hợp cuối cùng\n\n")
            f.write(f"{final_text}\n\n")
    return path

# ─── MAIN PIPELINE ──────────────────────────────────────
def run(user_input):
    """Pipeline chính: 4-round relay + synthesis"""
    
    # ── Kiểm tra tab ──
    tabs = get_tabs()
    ct = next((t for t in tabs if "chatgpt.com" in t["url"] and t["type"] == "page"
               and "RotateCookies" not in t["url"]), None)
    gt = next((t for t in tabs if "gemini.google.com/app" in t["url"]
               and "RotateCookies" not in t["url"]), None)

    if not ct or not gt:
        print(f"\n{c('❌ LỖI: Thiếu tab trình duyệt', RED + BOLD)}")
        print(f"   ChatGPT: {c('✅', GREEN) if ct else c('❌ mở https://chatgpt.com/', RED)}")
        print(f"   Gemini:  {c('✅', GREEN) if gt else c('❌ mở https://gemini.google.com/', RED)}")
        print(f"\n   Yêu cầu: Chrome chạy với --remote-debugging-port=9222")
        print(f"   và 2 tab đã đăng nhập ChatGPT + Gemini.")
        return 1

    print(f"\n  {c('Tab ChatGPT:', DIM)} {ct['id'][:8]} | {ct.get('title','')[:60]}")
    print(f"  {c('Tab Gemini:', DIM)}  {gt['id'][:8]} | {gt.get('title','')[:60]}")
    print(f"  {c('Input:', DIM)} \"{user_input[:100]}{'...' if len(user_input) > 100 else ''}\"")

    # ── Kết nối CDP ──
    c_ws, c_ev, c_ins, c_ins_typed, c_enter, c_clear = cdp_connect(ct)
    g_ws, g_ev, g_ins, g_ins_typed, g_enter, g_clear = cdp_connect(gt)
    history = []  # [(speaker, text)]
    gemini_hashes = set()
    final_text = None

    try:
        # ── CHUẨN BỊ ──
        section("CHUẨN BỊ")
        if not chatgpt_navigate(c_ev):
            print(f"  {c('❌ ChatGPT không load được editor', RED)}")
            return 1

        # ── R1: ChatGPT phân tích ──
        section("VÒNG 1 — ChatGPT phân tích ban đầu")
        r1 = chatgpt_send(c_ev, c_ins, c_ins_typed, c_enter, c_clear, p_analysis(user_input))
        if not r1:
            print(f"  {c('❌ ChatGPT R1 không phản hồi', RED)}")
            return 1
        print_response("ChatGPT", r1)
        history.append(("ChatGPT (phân tích)", r1))

        # ── R2: Gemini phản biện ──
        section("VÒNG 2 — Gemini phản biện")
        if not gemini_ensure(g_ev, g_ws):
            print(f"  {c('❌ Gemini không sẵn sàng', RED)}")
            return 1
        gemini_prescan(g_ev, gemini_hashes)
        gemini_send(g_ev, g_ins, g_enter, p_rebut("ChatGPT", r1))
        r2_text, r2_hash = gemini_wait(g_ev, gemini_hashes)
        if not r2_text:
            print(f"  {c('⚠️ Gemini retry R2...', YELLOW)}")
            if gemini_ensure(g_ev, g_ws):
                gemini_send(g_ev, g_ins, g_enter, p_rebut("ChatGPT", r1[:800]))
                r2_text, r2_hash = gemini_wait(g_ev, gemini_hashes)
        if not r2_text:
            print(f"  {c('❌ Gemini R2 không phản hồi', RED)}")
            return 1
        gemini_hashes.add(r2_hash)
        print_response("Gemini", r2_text, YELLOW)
        history.append(("Gemini (phản biện)", r2_text))

        # ── R3: ChatGPT phản biện lại ──
        section("VÒNG 3 — ChatGPT phản biện Gemini")
        r3 = chatgpt_send(c_ev, c_ins, c_ins_typed, c_enter, c_clear, p_rebut("Gemini", r2_text))
        if not r3:
            print(f"  {c('❌ ChatGPT R3 không phản hồi', RED)}")
            return 1
        print_response("ChatGPT", r3)
        history.append(("ChatGPT (phản biện lại)", r3))

        # ── R4: Gemini phản biện cuối ──
        section("VÒNG 4 — Gemini phản biện cuối")
        gemini_hashes.clear()  # Clear hashes vì conversation mới
        if not gemini_new_conversation(g_ev, g_ws):
            print(f"  {c('⚠️ Gemini không new thread được, dùng ensure', YELLOW)}")
            if not gemini_ensure(g_ev, g_ws):
                print(f"  {c('⚠️ Gemini không sẵn sàng, skip R4', YELLOW)}")
        else:
            gemini_prescan(g_ev, gemini_hashes)
            gemini_send(g_ev, g_ins, g_enter, p_rebut("ChatGPT", r3))
            r4_text, r4_hash = gemini_wait(g_ev, gemini_hashes)
            if not r4_text:
                print(f"  {c('⚠️ Gemini retry R4...', YELLOW)}")
                if gemini_ensure(g_ev, g_ws):
                    gemini_send(g_ev, g_ins, g_enter, p_rebut("ChatGPT", r3[:800]))
                    r4_text, r4_hash = gemini_wait(g_ev, gemini_hashes)
            if r4_text:
                gemini_hashes.add(r4_hash)
                print_response("Gemini", r4_text, YELLOW)
                history.append(("Gemini (phản biện cuối)", r4_text))
            else:
                print(f"  {c('⚠️ Gemini R4 timeout — dùng 3 vòng', YELLOW)}")

        # ── TỔNG HỢP ──
        section("TỔNG HỢP CUỐI CÙNG")
        final_text = chatgpt_send(c_ev, c_ins, c_ins_typed, c_enter, c_clear, p_synthesis(history))
        if not final_text:
            print(f"  {c('⚠️ Không tổng hợp được, hiển thị từng vòng', YELLOW)}")
        else:
            print_response("TỔNG HỢP", final_text, CYAN)

        # ── KẾT QUẢ ──
        print_history(history, final_text)

        # ── Lưu file ──
        out_path = save_results(user_input, history, final_text)
        print(f"\n  {c('📁 Kết quả đã lưu:', DIM)} {out_path}")

        return 0

    finally:
        c_ws.close()
        g_ws.close()

# ─── ENTRY ──────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    if not args:
        print(f"\n{c('╔══════════════════════════════════════════════════════════╗', BOLD)}")
        print(f"{c('║', BOLD)}  {c('CROSSCRITIC', BOLD + CYAN)} — Phản biện chéo ChatGPT ↔ Gemini")
        print(f"{c('║', BOLD)}  Phân tích đa chiều, kết luận chính xác nhất")
        print(f"{c('╠══════════════════════════════════════════════════════════╣', BOLD)}")
        print(f"{c('║', BOLD)}  Sử dụng:")
        print(f"{c('║', BOLD)}    python3 crosscritic.py \"Ý kiến của bạn...\"")
        print(f"{c('║', BOLD)}")
        print(f"{c('║', BOLD)}  Ví dụ:")
        print(f"{c('║', BOLD)}    python3 crosscritic.py \"AI có thay thế lập trình viên không?\"")
        print(f"{c('║', BOLD)}    python3 crosscritic.py \"Nên đầu tư vào Bitcoin năm 2026?\"")
        print(f"{c('║', BOLD)}    python3 crosscritic.py \"Học máy học có khó không?\"")
        print(f"{c('║', BOLD)}")
        print(f"{c('║', BOLD)}  {c('Yêu cầu:', YELLOW)} Chrome --remote-debugging-port=9222")
        print(f"{c('║', BOLD)}  {c('2 tab đã login:', YELLOW)} ChatGPT + Gemini")
        print(f"{c('╚══════════════════════════════════════════════════════════╝', BOLD)}")
        print()
        return 0

    user_input = " ".join(args)
    return run(user_input)

if __name__ == "__main__":
    # Hoặc chạy interactive nếu không có arg
    if not sys.argv[1:]:
        sys.argv.append(input(f"{c('Nhập ý kiến của bạn: ', CYAN + BOLD)}").strip())
        if not sys.argv[1:]:
            print("Không có input, thoát.")
            sys.exit(0)
    sys.exit(main())
