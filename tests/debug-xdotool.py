#!/usr/bin/env python3
"""debug-xdotool.py — Test ChatGPT với xdotool typing ở OS level"""
import json, websocket, urllib.request, time, subprocess, random, sys

def xdo(cmd_args):
    """Run xdotool command, return output"""
    return subprocess.run(['xdotool'] + cmd_args, capture_output=True, text=True).stdout.strip()

# Find Chrome window
win_ids = xdo(['search', '--onlyvisible', '--name', 'ChatGPT'])
if not win_ids:
    print("ERROR: No visible Chrome window with 'ChatGPT' in title")
    sys.exit(1)

win_id = win_ids.split('\n')[0].strip()
print(f"Chrome window: {win_id}")
print(f"Window name: {xdo(['getwindowname', win_id])}")

# Activate window
xdo(['windowactivate', '--sync', win_id])
time.sleep(0.5)

# Now connect via CDP to the ChatGPT tab
tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if 'chatgpt.com' in t['url'] and t['type'] == 'page']
if not ct:
    print("ERROR: no ChatGPT tab"); sys.exit(1)

tab = ct[0]
print(f"Tab: {tab['id'][:12]} | {tab['title'][:60]} | {tab['url'][:80]}")

ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=15)
cid=[0]
def req(m, p=None):
    cid[0] += 1
    ws.send(json.dumps({'id': cid[0], 'method': m, 'params': p or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == cid[0]: return msg
def ev(e):
    r = req('Runtime.evaluate', {'expression': e, 'returnByValue': True})
    return r.get('result',{}).get('result',{}).get('value')

req('Runtime.enable')
req('Input.enable')

# Navigate to fresh thread
print('\n--- Fresh thread ---')
xdo(['windowactivate', '--sync', win_id])
time.sleep(0.3)
ev('(function(){var b=document.querySelector("[data-testid=create-new-chat-button]");if(b)b.click();return!!b;})()')
time.sleep(3)

url = ev('window.location.href')
print(f'URL: {url}')
editor = ev('!!document.getElementById("prompt-textarea")')
print(f'Editor: {editor}')

# Focus editor
ev('(function(){var el=document.getElementById("prompt-textarea");if(el)el.focus();return!!el;})()')
time.sleep(0.3)

# Activate window again after editor focus
xdo(['windowactivate', '--sync', win_id])
time.sleep(0.3)

# Clear any existing text by Ctrl+A + Delete using CDP
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'a','code':'KeyA','keyCode':65,'windowsVirtualKeyCode':65,'modifiers':2})
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'a','code':'KeyA','keyCode':65,'windowsVirtualKeyCode':65,'modifiers':2})
time.sleep(0.1)
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'Delete','code':'Delete','keyCode':46,'windowsVirtualKeyCode':46})
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'Delete','code':'Delete','keyCode':46,'windowsVirtualKeyCode':46})
time.sleep(0.3)

# Type via xdotool with human-like delays
text = "Trả lời 1 câu đơn giản: 2+2 bằng mấy? Chỉ trả lời số."
print(f'\n--- Typing via xdotool: {len(text)} chars ---')
print(f'Text: {text}')

xdo(['windowactivate', '--sync', win_id])
time.sleep(0.2)

for ch in text:
    # Convert char to xdotool key
    if ch == ' ':
        xdo(['key', 'space'])
    elif ch == '?':
        xdo(['key', 'question'])
    elif ch == ':':
        xdo(['key', 'colon'])
    elif ch == '+':
        xdo(['key', 'plus'])
    else:
        # For regular letters/digits, xdotool can type directly
        xdo(['type', ch])
    time.sleep(random.uniform(0.03, 0.08))  # Human-like delay

# Verify editor content
ed = ev('(document.getElementById("prompt-textarea")?.textContent||"NO_EDITOR").length')
print(f'Editor after typing: {ed} chars')

# Check send button
btn_status = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    return btn ? ('exist disabled='+btn.disabled) : 'NO_BTN';
})()""")
print(f'Send button: {btn_status}')

if btn_status and 'disabled=false' in btn_status:
    # Click send via CDP
    print('Clicking send...')
    xdo(['windowactivate', '--sync', win_id])
    time.sleep(0.3)
    ev("""(function(){
        var btn=document.querySelector("[data-testid=send-button]");
        if(btn&&!btn.disabled){btn.click();return'CLICK_OK';}
        return'NO_CLICK';
    })()""")
    time.sleep(0.5)
    
    # Actually, use Enter key via xdotool
    xdo(['key', 'Return'])
    
    # Wait
    print('Waiting for response...')
    for i in range(60):
        time.sleep(2)
        msgs = ev("""(function(){
            var ms=document.querySelectorAll('[data-message-author-role=assistant]');
            if(!ms.length) return '0||';
            var last=ms[ms.length-1];
            var txt=last.textContent||'';
            return ms.length+'||'+txt.length+'||'+txt.substring(0,100).replace(/\\n/g,' ');
        })()""")
        url_n = ev('window.location.href')
        parts = msgs.split('||') if msgs else ['?','0','']
        len_str = parts[1] if len(parts) >= 2 else '0'
        print(f'  {i*2}s: msgs={parts[0]} len={len_str} url={(url_n or "NONE")[:60]}')
        if len_str.strip().isdigit() and int(len_str.strip()) > 30:
            print(f'\n✅ RESPONSE ({len_str} chars): {parts[2][:300]}')
            full = ev('(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");return ms.length?ms[ms.length-1].textContent:"";})()')
            print(f'Full: {full[:500]}')
            break
else:
    print('Send button not ready — trying Enter via xdotool')
    xdo(['key', 'Return'])
    time.sleep(3)
    for i in range(60):
        time.sleep(2)
        msgs = ev("""(function(){
            var ms=document.querySelectorAll('[data-message-author-role=assistant]');
            if(!ms.length) return '0||';
            var last=ms[ms.length-1];
            var txt=last.textContent||'';
            return ms.length+'||'+txt.length+'||'+txt.substring(0,100).replace(/\\n/g,' ');
        })()""")
        print(f'  {i*2}s: {msgs}')

print('\nDone')
ws.close()
