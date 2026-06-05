"""Force Gemini tab navigation and wait for rotation to resolve"""
import json, urllib.request, websocket, time

# Find Gemini-related tab
tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
gt = next((t for t in tabs if 'gemini' in t['url'] or '5A079322' in t['id']), None)
if not gt:
    gt = next((t for t in tabs if 'accounts.google.com' in t['url']), None)
if not gt:
    print("No suitable tab. All pages:")
    for t in tabs:
        if t['type']=='page': print(f"  {t['id'][:12]} | {t['url'][:80]}")
    exit(1)

print(f"Tab: {gt['id'][:12]} | {gt['url'][:80]}")

# Use Page.navigate (via CDP) to go to Gemini
ws = websocket.create_connection(gt['webSocketDebuggerUrl'], timeout=30)
cid=[0]
def req(m,p=None):
    cid[0]+=1
    ws.send(json.dumps({'id':cid[0],'method':m,'params':p or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get('id')==cid[0]: return msg.get('result',{})

req('Page.enable')
req('Page.navigate', {'url': 'https://gemini.google.com/app/'})
print("Navigation sent. Waiting for rotation to resolve...")

# Wait - the tab will get rotated to accounts.google.com then back to gemini
for i in range(50):
    time.sleep(2)
    tabs2 = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
    gem_possible = [t for t in tabs2 if t['type']=='page' and 'gemini.google.com' in t['url']]
    if gem_possible:
        t = gem_possible[0]
        print(f"Gemini back at {i*2+2}s | {t['title'][:50]}")
        # Test contenteditable
        ws2 = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=15)
        cid2=[0]
        def r2(m,p=None):
            cid2[0]+=1
            ws2.send(json.dumps({'id':cid2[0],'method':m,'params':p or {}}))
            while True:
                msg=json.loads(ws2.recv())
                if msg.get('id')==cid2[0]: return msg.get('result',{})
        r2('Runtime.enable')
        
        # Check various input methods
        ce = r2('Runtime.evaluate', {'expression': '(function(){var ce=document.querySelector("[contenteditable=true]");if(ce)return"yes class="+ce.className.substring(0,40);return"no";})()', 'returnByValue': True})
        ta = r2('Runtime.evaluate', {'expression': '(function(){var ta=document.querySelector("textarea");return ta?"yes":"no";})()', 'returnByValue': True})
        inp = r2('Runtime.evaluate', {'expression': '(function(){var inp=document.querySelector("input[type=text]");return inp?"yes":"no";})()', 'returnByValue': True})
        rich = r2('Runtime.evaluate', {'expression': '(function(){var r=document.querySelector("rich-textarea");return r?"yes":"no";})()', 'returnByValue': True})
        
        print(f"  contenteditable: {ce.get('result',{}).get('value','?')}")
        print(f"  textarea: {ta.get('result',{}).get('value','?')}")
        print(f"  input[text]: {inp.get('result',{}).get('value','?')}")
        print(f"  rich-textarea: {rich.get('result',{}).get('value','?')}")
        
        ws2.close()
        
        # Now found - also store new stable tab id
        print(f"\nStable Gemini tab ID: {t['id'][:12]}")
        print(f"WS URL: {t['webSocketDebuggerUrl'][:60]}")
        break
    else:
        # Show what's happening
        page_urls = [(t['id'][:8], t['url'][:60]) for t in tabs2 if t['type']=='page']
        for pid, u in page_urls:
            if 'Rotate' in u:
                print(f"  Rotating... ({i*2+2}s)", end='')
                break
        else:
            print(f"  Waiting... ({i*2+2}s)", end='')
        print()
else:
    print("\nTimed out. Current tabs:")
    tabs3 = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
    for t in tabs3:
        if t['type']=='page':
            print(f"  {t['id'][:12]} | {t.get('title','')[:50]} | {t['url'][:60]}")
