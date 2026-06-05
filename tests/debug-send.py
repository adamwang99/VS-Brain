#!/usr/bin/env python3
"""Debug chatgpt_send — từng bước: clear → insert → send → wait"""
import json, websocket, urllib.request, time, sys, hashlib

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if 'chatgpt.com' in t['url'] and t['type'] == 'page' and '/c/' not in t['url']]
if not ct:
    ct = [t for t in tabs if 'chatgpt.com/c/' in t['url'] and t['type'] == 'page']
if not ct:
    print("FATAL: no ChatGPT tab"); sys.exit(1)

tab = ct[0]
print(f"Tab: {tab['id'][:12]} | {tab.get('title','')[:60]} | {tab['url'][:80]}")

ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=15)
cid=[0]
def req(m, p=None):
    cid[0] += 1
    ws.send(json.dumps({'id': cid[0], 'method': m, 'params': p or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == cid[0]:
            return msg

def ev(expr):
    r = req('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    inner = r.get('result',{}).get('result',{})
    return None if inner.get('subtype') == 'error' else inner.get('value')

req('Runtime.enable')
req('Input.enable')

url = ev('window.location.href')
print(f'URL: {url}')

editor = ev('!!document.getElementById("prompt-textarea")')
print(f'Editor exists: {editor}')

if not editor:
    # Navigate SPA
    print('No editor — navigating...')
    ev('var b=document.querySelector("[data-testid=create-new-chat-button]");if(b){b.click();}else{window.location.href="https://chatgpt.com/"}')
    for i in range(15):
        time.sleep(1)
        editor = ev('!!document.getElementById("prompt-textarea")')
        url = ev('window.location.href')
        print(f'  {i+1}s: editor={editor} url={(url or "NONE")[:60]}')
        if editor:
            break

# STEP 1: Clear
print('\n--- STEP 1: Clear editor ---')
ev('(function(){var el=document.getElementById("prompt-textarea");if(el){el.focus();return"OK";}return"NO_EL";})()')
# Ctrl+A
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'a','code':'KeyA','keyCode':65,'windowsVirtualKeyCode':65,'modifiers':2})
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'a','code':'KeyA','keyCode':65,'windowsVirtualKeyCode':65,'modifiers':2})
# Delete
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'Delete','code':'Delete','keyCode':46,'windowsVirtualKeyCode':46})
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'Delete','code':'Delete','keyCode':46,'windowsVirtualKeyCode':46})
time.sleep(0.2)
# Check if cleared
editor_len = ev('(document.getElementById("prompt-textarea")?.textContent||"").length')
editor_html = ev('(document.getElementById("prompt-textarea")?.innerHTML||"NO_EDITOR")[:200]')
print(f'After clear: {editor_len} chars, html={editor_html}')

# Step 2: Insert
print('\n--- STEP 2: Insert text ---')
text = "Trả lời câu hỏi đơn giản: 2+2 bằng mấy? Chỉ trả lời số."
req('Input.insertText', {'text': text})
time.sleep(1.5)
editor_len2 = ev('(document.getElementById("prompt-textarea")?.textContent||"").length')
editor_html2 = ev('(document.getElementById("prompt-textarea")?.innerHTML||"NO_EDITOR")[:200]')
print(f'After insert: {editor_len2} chars, html={editor_html2}')

# Step 3: Click send
print('\n--- STEP 3: Send ---')
r = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    if(btn){return 'send-btn exist disabled='+btn.disabled;}
    var bs=document.querySelectorAll('button[aria-label]');
    for(var i=0;i<bs.length;i++){
        var a=bs[i].getAttribute('aria-label')||'';
        if(a.indexOf('Gửi')>=0||a.indexOf('Send')>=0){return 'aria-btn: '+a+' disabled='+bs[i].disabled;}
    }
    return 'NO_BTN';
})()""")
print(f'Button check: {r}')

r2 = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    if(btn&&!btn.disabled){btn.click();return"CLICK_OK";}
    return'NO_CLICK';
})()""")
print(f'Click result: {r2}')

# Step 4: Wait for response
print('\n--- STEP 4: Wait ---')
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
    parts = msgs.split('||') if msgs else ['?']
    print(f'  {i*2}s: msgs={parts[0]} len={parts[1]} url={(url_n or "NONE")[:60]}')
    if len(parts) >= 2 and parts[1].strip().isdigit():
        if int(parts[1].strip()) > 20:
            print(f'\n✅ GOT RESPONSE: {parts[2][:300]}')
            # Get full response
            full = ev("""(function(){
                var ms=document.querySelectorAll('[data-message-author-role=assistant]');
                if(!ms.length) return '';
                return ms[ms.length-1].textContent||'';
            })()""")
            print(f'Full ({len(full)} chars):')
            print(full[:500])
            break

print('\nDone')
ws.close()
