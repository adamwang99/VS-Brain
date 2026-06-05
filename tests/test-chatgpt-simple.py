#!/usr/bin/env python3
"""Test ChatGPT send - simple prompt with Enter fallback"""
import json, websocket, urllib.request, time, sys

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if t['url'] == 'https://chatgpt.com/' and t['type'] == 'page']
if not ct:
    ct = [t for t in tabs if 'chatgpt.com' in t['url'] and t['type'] == 'page' and '/c/' not in t['url']]
if not ct:
    print("NO ChatGPT homepage tab found - navigating")
    # Try the thread tab
    ct = [t for t in tabs if 'chatgpt.com/c/' in t['url'] and t['type'] == 'page']
    if not ct:
        print("FATAL: no ChatGPT tab")
        sys.exit(1)

tab = ct[0]
print(f"Tab: {tab['id'][:12]} | {tab.get('title','')[:60]} | {tab['url'][:80]}")
ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=10)
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

# Check editor
editor = ev('!!document.getElementById("prompt-textarea")')
print(f'Editor: {editor}')

if not editor:
    # Navigate to homepage
    print('Navigating to /...')
    ev('window.location.href="https://chatgpt.com/"')
    for i in range(15):
        time.sleep(1)
        editor = ev('!!document.getElementById("prompt-textarea")')
        print(f'  {i+1}s: editor={editor} url={(ev("window.location.href") or "NONE")[:60]}')
        if editor:
            break
    if not editor:
        print('No editor after navigation')
        ws.close()
        sys.exit(1)

# Clear editor
ev('var el=document.getElementById("prompt-textarea");if(el){el.focus();el.innerText="";}return""')
time.sleep(0.5)

# Insert text
text = "Trả lời 1 câu đơn giản: 2+2 bằng mấy? Chỉ trả lời số, không giải thích."
req('Input.insertText', {'text': text})
time.sleep(1.5)

# Check what's in editor now
editor_txt = ev('document.getElementById("prompt-textarea")?document.getElementById("prompt-textarea").innerText:"NO"')
print(f'Editor text: {editor_txt[:80] if editor_txt else "EMPTY"}')

# Try click send button
r = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    if(btn&&!btn.disabled){btn.click();return"CLICK_SEND";}
    var bs=document.querySelectorAll("button");
    for(var i=0;i<bs.length;i++){
        var a=bs[i].getAttribute("aria-label")||"";
        if(a.indexOf('Gửi')>=0||a.indexOf('Send')>=0){
            if(!bs[i].disabled){bs[i].click();return"ARIA_"+a;}
        }
    }
    return"NO_BTN";
})()""")
print(f'Send attempt: {r}')

if r == 'NO_BTN':
    print('  Falling back to Enter...')
    req('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter', 'windowsVirtualKeyCode': 13})
    time.sleep(0.05)
    req('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter'})

# Wait for response
print('Waiting...')
for i in range(60):
    time.sleep(2)
    msgs = ev('''(function(){
        var ms=document.querySelectorAll("[data-message-author-role=assistant]");
        if(!ms.length) return "no_msgs";
        return ms.length+"||"+ms[ms.length-1].textContent.length+"||"+ms[ms.length-1].textContent.substring(0,100).replace(/\\n/g," ");
    })()''')
    url = ev('window.location.href')
    if msgs:
        print(f'  {i*2}s: msgs={msgs} url={(url or "NONE")[:60]}')
        parts = msgs.split('||')
        if len(parts) >= 3 and parts[1].strip().isdigit() and int(parts[1].strip()) > 5:
            print('\nRESPONSE FOUND!')
            print(f'Content ({parts[1]} chars): {parts[2][:200]}')
            break
    else:
        print(f'  {i*2}s: NULL url={(url or "NONE")[:60]}')
else:
    print('TIMEOUT')

ws.close()
