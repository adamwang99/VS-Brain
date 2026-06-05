#!/usr/bin/env python3
"""Final ChatGPT CDP attempt: clean tab, proper clear + insertText + Enter"""
import json, websocket, urllib.request, time

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if 'B7953D36B862' in t['id']][0]
print(f"Tab: {ct['id'][:12]} | {ct.get('title','')[:50]} | {ct['url'][:70]}")

ws = websocket.create_connection(ct['webSocketDebuggerUrl'], timeout=10)
cid=[0]
def req(m, p=None):
    cid[0] += 1
    ws.send(json.dumps({'id': cid[0], 'method': m, 'params': p or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == cid[0]: return msg
def ev(expr):
    r = req('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    inner = r.get('result',{}).get('result',{})
    return None if inner.get('subtype') == 'error' else inner.get('value')

req('Runtime.enable'); req('Page.enable'); req('Input.enable')

# Navigate to /
req('Page.navigate', {'url': 'https://chatgpt.com/'})
for i in range(15):
    time.sleep(1)
    ed = ev("!!document.getElementById('prompt-textarea')")
    print(f"  {i+1}s editor={ed}")
    if ed: break

time.sleep(2)

# Clear editor: use select + delete
ev("""
(function(){
    var e=document.getElementById('prompt-textarea');
    if(!e)return'NO';
    e.focus();
    var s=window.getSelection();
    var r=document.createRange();
    r.selectNodeContents(e);
    s.removeAllRanges();
    s.addRange(r);
    return document.execCommand('delete',false,null)?'DEL_OK':'DEL_FAIL';
})()
""")
time.sleep(0.5)

# Read back to confirm clear
after = ev("document.getElementById('prompt-textarea').innerText.length")
print(f"After delete: len={after}")

# Now use Input.insertText (CDP standard)
req('Input.insertText', {'text': '5+7'})
time.sleep(0.5)
editor = ev("document.getElementById('prompt-textarea').innerText")
print(f"After insertText: '{editor[:50]}'")

# Wait for UI update
time.sleep(2)

# Check send button
btn = ev("""
(function(){
    var b=document.querySelector('[data-testid=send-button]');
    if(!b) return 'NO_BTN';
    return 'exists_disabled='+b.disabled;
})()
""")
print(f"Send btn: {btn}")

# If button exists, click via JS
if btn and 'exists' in btn:
    r = ev("""
    (function(){
        var b=document.querySelector('[data-testid=send-button]');
        if(b&&!b.disabled) {
            b.click();
            return 'CLICKED';
        }
        return 'NO_CLICK';
    })()
    """)
    print(f"Click: {r}")
    
    # Also enter key as backup
    time.sleep(0.3)
    req('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter', 'windowsVirtualKeyCode': 13})
    time.sleep(0.05)
    req('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter'})
    print("Enter also sent")
else:
    # Enter key
    req('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter', 'windowsVirtualKeyCode': 13})
    time.sleep(0.05)
    req('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter'})
    print("Enter sent (no button)")

# Watch for response
print("\nWatching for response...")
for i in range(60):
    time.sleep(2)
    url = ev('window.location.href') or ''
    msgs = ev("""
    (function(){
        var ms=document.querySelectorAll('[data-message-author-role]');
        if(!ms.length) return 'none';
        var r=[];
        for(var i=0;i<ms.length;i++){
            r.push(ms[i].getAttribute('data-message-author-role')+'='+ms[i].textContent.length);
        }
        return r.join(' ');
    })()
    """)
    print(f"  {i*2}s: {msgs} url={(url[:60])}")
    if '/c/' in str(url) and msgs and 'assistant=' in str(msgs) and 'assistant=0' not in str(msgs).split():
        print("\n✅ RESPONSE!")
        full = ev("var ms=document.querySelectorAll('[data-message-author-role=assistant]');return ms.length?ms[ms.length-1].textContent:'NONE';")
        print(f"  ({len(full or '')} chars) {full[:300]}...")
        break
    if '/c/' in str(url) and 'assistant=' in str(msgs):
        # Look closer at assistant content
        al = [int(x.split('=')[1]) for x in msgs.split() if x.startswith('assistant')]
        if al and al[-1] > 10:
            print("\n✅ CONTENT!")
            full = ev("var ms=document.querySelectorAll('[data-message-author-role=assistant]');return ms[ms.length-1].textContent;")
            print(f"  ({len(full or '')} chars) {full[:300]}...")
            break

ws.close()
