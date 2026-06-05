#!/usr/bin/env python3
"""debug-human-insert.py — Input.insertText từng chunk nhỏ + human-like delays"""
import json, websocket, urllib.request, time, random

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if 'chatgpt.com' in t['url'] and t['type'] == 'page']
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

# Fresh thread
print('\n--- Fresh thread ---')
ev('(function(){var b=document.querySelector("[data-testid=create-new-chat-button]");if(b)b.click();return!!b;})()')
time.sleep(3)
url = ev('window.location.href')
print(f'URL: {url}')

# Focus editor
ev('(function(){var el=document.getElementById("prompt-textarea");if(el){el.focus();return"OK";}return"NO_EL";})()')
time.sleep(0.5)

# Clear with Direct ProseMirror API (experiment)
# Try to find ProseMirror view and dispatch a transaction to clear
clear_result = ev("""(function(){
    var el = document.getElementById("prompt-textarea");
    if(!el) return "NO_EL";
    
    // Try to find ProseMirror View instance
    // ChatGPT stores it in the React fiber or as a property
    var pm = el.querySelector('.ProseMirror');
    if(!pm) return "NO_PM";
    
    // Try various ways to access the editor view
    // Method 1: Check for React internal state
    var key = Object.keys(pm).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if(key){
        var fiber = pm[key];
        // Walk up to find the ProseMirror view
        var node = fiber;
        while(node){
            if(node.stateNode && node.stateNode.view && node.stateNode.view.state && node.stateNode.view.dispatch){
                var view = node.stateNode.view;
                var tr = view.state.tr;
                tr.delete(0, view.state.doc.content.size);
                view.dispatch(tr);
                return "PM_CLEARED_BY_REACT";
            }
            if(node.stateNode && node.stateNode.dispatch && node.stateNode.state){
                var tr2 = node.stateNode.state.tr;
                tr2.delete(0, node.stateNode.state.doc.content.size);
                node.stateNode.dispatch(tr2);
                return "PM_CLEARED_DIRECT";
            }
            node = node.return || node.parent;
        }
    }
    
    // Fallback: Ctrl+A + Delete via JS dispatchEvent
    pm.focus();
    pm.dispatchEvent(new KeyboardEvent('keydown', {key:'a', keyCode:65, ctrlKey:true, metaKey:true, bubbles:true}));
    pm.dispatchEvent(new KeyboardEvent('keydown', {key:'Delete', keyCode:46, bubbles:true}));
    return "KEY_EVT_FALLBACK";
})()""")
print(f'Clear method: {clear_result}')

time.sleep(0.5)

# Check editor is cleared
ed_before = ev('(document.getElementById("prompt-textarea")?.textContent||"").length')
print(f'Editor before insert: {ed_before} chars')

# Insert text in small chunks with human-like delays
text = "Trả lời 1 câu đơn giản: 2+2 bằng mấy? Chỉ trả lời số."
print(f'\n--- Inserting \"{text}\" in chunks ---')

chunk_size = random.randint(3, 6)
pos = 0
while pos < len(text):
    chunk = text[pos:pos+chunk_size]
    print(f'  Chunk ({len(chunk)}): "{chunk}"')
    req('Input.insertText', {'text': chunk})
    time.sleep(random.uniform(0.05, 0.15))
    pos += chunk_size
    # Occasionally insert larger chunks with longer pauses
    if random.random() < 0.3:
        time.sleep(random.uniform(0.2, 0.5))

# Random pause before send
print(f'Waiting before send...')
time.sleep(random.uniform(1.0, 3.0))

ed_after = ev('(document.getElementById("prompt-textarea")?.textContent||"")')
print(f'Editor after insert: "{ed_after}" ({len(ed_after)} chars)')

# Click send
print('\n--- Sending ---')
r = ev("""(function(){
    var btn=document.querySelector("[data-testid=send-button]");
    if(btn&&!btn.disabled){btn.click();return'CLICK_OK';}
    return'NO_BTN';
})()""")
print(f'Click result: {r}')

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
    if len_str.strip().isdigit() and int(len_str.strip()) > 10:
        print(f'\n✅ RESPONSE ({len_str} chars): {parts[2][:300]}')
        break

print('\nDone')
ws.close()
