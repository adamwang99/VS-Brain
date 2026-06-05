#!/usr/bin/env python3
"""Debug: character-by-character typing to bypass ChatGPT anti-bot detection"""
import json, websocket, urllib.request, time, sys, random

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if 'chatgpt.com/c/' in t['url'] and t['type'] == 'page']
if not ct:
    ct = [t for t in tabs if 'chatgpt.com' in t['url'] and t['type'] == 'page' and '/c/' not in t['url']]
tab = ct[0]

print(f"Tab: {tab['id'][:12]} | {tab.get('title','')[:60]} | {tab['url'][:80]}")
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

# Navigate to fresh page first
print('\n--- Creating fresh thread ---')
ev('(function(){var b=document.querySelector("[data-testid=create-new-chat-button]");if(b)b.click();return!!b;})()')
time.sleep(3)
url = ev('window.location.href')
print(f'URL: {url}')

editor = ev('!!document.getElementById("prompt-textarea")')
print(f'Editor: {editor}')

# Type character by character
text = "Chào bạn, mình hỏi một câu đơn giản: 2+2 bằng mấy?"
print(f'\n--- Typing "{text}" char by char ---')

# Focus & clear first
ev('(function(){var el=document.getElementById("prompt-textarea");if(el){el.focus();return"OK";}return"NO_EL";})()')
time.sleep(0.5)

# Ctrl+A  
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'a','code':'KeyA','keyCode':65,'windowsVirtualKeyCode':65,'modifiers':2})
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'a','code':'KeyA','keyCode':65,'windowsVirtualKeyCode':65,'modifiers':2})
time.sleep(0.1)
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'Delete','code':'Delete','keyCode':46,'windowsVirtualKeyCode':46})
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'Delete','code':'Delete','keyCode':46,'windowsVirtualKeyCode':46})
time.sleep(0.3)

# Type each character with random human-like delays
for ch in text:
    # keyDown
    key_code = ord(ch.upper()) if ch.isalpha() else ord(ch) if ch.isdigit() else {'?': 191, ' ': 32, ':': 186, '2': 50, '+': 187}.get(ch) or 0
    req('Input.dispatchKeyEvent', {
        'type': 'keyDown', 'key': ch, 'text': ch,
        'code': 'Key'+ch.upper() if ch.isalpha() else '',
        'keyCode': key_code, 'windowsVirtualKeyCode': key_code
    })
    time.sleep(random.uniform(0.01, 0.02))  # Human-like between chars
    # keyUp
    req('Input.dispatchKeyEvent', {
        'type': 'keyUp', 'key': ch, 'text': ch,
        'code': 'Key'+ch.upper() if ch.isalpha() else '',
        'keyCode': key_code, 'windowsVirtualKeyCode': key_code
    })
    time.sleep(random.uniform(0.005, 0.02))

# Final pause after typing
time.sleep(random.uniform(0.5, 1.5))

# Check editor content
ed = ev('(document.getElementById("prompt-textarea")?.textContent||"NO_EDITOR").length')
print(f'Editor after typing: {ed} chars')

# Click send
print('\n--- Sending ---')
r = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    if(btn&&!btn.disabled){btn.click();return'CLICK_OK';}
    return'NO_BTN';
})()""")
print(f'Click result: {r}')

# Wait
print('\n--- Waiting for response ---')
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

print('\nDone')
ws.close()
