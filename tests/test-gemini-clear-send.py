#!/usr/bin/env python3
"""Test: clear Gemini editor with Range.selectNodeContents + execCommand('delete'), then send + wait"""
import json, websocket, time, urllib.request

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
gt = [t for t in tabs if 'gemini' in t['url'].lower() and 'RotateCookies' not in t['url']][0]
print(f'Using tab: {gt["id"][:12]} | {gt["title"]} | {gt["url"][:60]}')

ws = websocket.create_connection(gt['webSocketDebuggerUrl'], timeout=10)
cid = [0]

def req(m, p=None):
    cid[0] += 1
    ws.send(json.dumps({'id': cid[0], 'method': m, 'params': p or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == cid[0]:
            return msg

def ev(expr):
    r = req('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    inner = r.get('result', {}).get('result', {})
    return None if inner.get('subtype') == 'error' else inner.get('value')

req('Runtime.enable')
req('Input.enable')

# --- Clear ---
print('Clearing editor...')
r = ev("""(function(){
    var ce = document.querySelector("[contenteditable=true]");
    ce.focus();
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(ce);
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = document.execCommand("delete", false, null);
    return "DELETED:" + ok + " LEN:" + ce.innerText.length;
})()""")
print(f'  Clear result: {r}')

# --- Insert ---
time.sleep(0.5)
test_prompt = "Trả lời ngắn gọn bằng tiếng Việt: AI có thay thế được lập trình viên không?"
req('Input.insertText', {'text': test_prompt})
time.sleep(1.5)

# --- Verify text in editor ---
t = ev('document.querySelector("[contenteditable=true]").innerText')
print(f'  Editor after insert: {t[:80] if t else "NULL"}...')

# --- Send ---
print('Sending Enter...')
req('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter', 'windowsVirtualKeyCode': 13})
time.sleep(0.05)
req('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'keyCode': 13, 'code': 'Enter'})

# --- Wait ---
print('Waiting for response...')
for i in range(90):
    time.sleep(2)
    url = ev('window.location.href')
    if url and 'gemini.google.com' not in str(url):
        print(f'  COOKIE ROTATION! url={url}')
        break
    mr = ev('(function(){var mr=document.querySelector("model-response");if(!mr)return"";return mr.textContent.length+"|"+mr.textContent.substring(0,120);})()')
    if mr and mr != '':
        print(f'  {i*2}s: {mr[:150]}')
        if '|' in mr and not mr.startswith('0|'):
            # Stability check
            prev = mr.split('|', 1)[1] if '|' in mr else mr
            stable = 0
            while stable < 3:
                time.sleep(2)
                mr2 = ev('(function(){var mr=document.querySelector("model-response");if(!mr)return"";return mr.textContent.trim();})()')
                if mr2 and mr2 == mr.split('|', 1)[1] if '|' in mr else False:
                    stable += 1
                elif mr2:
                    stable = 0
                    prev = mr2
                print(f'  stable={stable} len={len(prev) if isinstance(prev, str) else 0}')
            print(f'\nFULL RESPONSE ({len(mr2)} chars):')
            print(mr2[:2000])
            break
    else:
        print('.', end='', flush=True)
print('Done.')
ws.close()
