#!/usr/bin/env python3
"""debug-execinsert.py — Gửi prompt ChatGPT qua document.execCommand("insertText")"""
import json, websocket, urllib.request, time, random

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if 'chatgpt.com' in t['url'] and t['type'] == 'page']
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

# Fresh thread
print('\n--- Fresh thread ---')
ev('(function(){var b=document.querySelector("[data-testid=create-new-chat-button]");if(b)b.click();return!!b;})()')
time.sleep(3)
print(f'URL: {ev("window.location.href")}')

# Focus + insert via execCommand (char by char)
print('\n--- Inserting text via execCommand ---')
text = "Trả lời câu hỏi: 2+2 bằng mấy? Chỉ trả lời số."

ev('(function(){var el=document.getElementById("prompt-textarea");el.focus();return "OK";})()')
time.sleep(0.3)

# Insert each character via execCommand with delays
for i, ch in enumerate(text):
    escaped = json.dumps(ch)
    ev(f'(function(){{document.execCommand("insertText",false,{escaped});return "OK";}})()')
    time.sleep(random.uniform(0.01, 0.03))
    # Small random pause every 4-6 chars
    if i > 0 and i % 5 == 0:
        time.sleep(random.uniform(0.03, 0.08))

time.sleep(random.uniform(0.5, 1.5))

# Verify content
ed = ev('(document.getElementById("prompt-textarea")?.textContent||"").length')
print(f'Editor: {ed} chars')

# Send
r = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    if(btn&&!btn.disabled){btn.click();return'CLICK_OK';}
    return'NO_BTN';
})()""")
print(f'Send: {r}')

if r == 'NO_BTN':
    req('Input.dispatchKeyEvent', {'type':'keyDown','key':'Enter','keyCode':13,'code':'Enter','windowsVirtualKeyCode':13})
    req('Input.dispatchKeyEvent', {'type':'keyUp','key':'Enter','keyCode':13,'code':'Enter'})

# Wait
print('Waiting...')
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
    print(f'  {i*2}s: msgs={parts[0]} len={len_str} url={(url_n or "")[:60]}')
    if len_str.strip().isdigit() and int(len_str.strip()) > 5:
        print(f'\n✅ RESPONSE ({len_str} chars): {parts[2][:300]}')
        full = ev('(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");return ms.length?ms[ms.length-1].textContent:"";})()')
        print(f'Full: {full[:500]}')
        break

print('\nDone')
ws.close()
