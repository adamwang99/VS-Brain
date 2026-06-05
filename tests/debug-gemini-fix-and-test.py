"""Fix Gemini tab: navigate to app, stabilize, test send"""
import json, urllib.request, websocket, time

# Get Gemini tab - might be on rotation page
tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
gt = next((t for t in tabs if 'gemini' in t['url'] and t['type']=='page'), None)
if not gt:
    # Find rotation page tab
    gt = next((t for t in tabs if '5A079322' in t['id'] and t['type']=='page'), None)
if not gt:
    gt = next((t for t in tabs if 'google' in t['url'].lower() and t['type']=='page'), None)
if not gt:
    print("NO Gemini tab found!")
    for t in tabs:
        if t['type']=='page':
            print(f"  {t['id'][:12]} | {t['url'][:80]}")
    exit(1)

print(f"Tab: {gt['id'][:12]} | {gt['title'][:60]} | {gt['url'][:80]}")

# Connect
ws = websocket.create_connection(gt['webSocketDebuggerUrl'], timeout=30)
cid=[0]
def req(m,p=None):
    cid[0]+=1
    ws.send(json.dumps({'id':cid[0],'method':m,'params':p or {}}))
    while True:
        try:
            msg=json.loads(ws.recv())
            if msg.get('id')==cid[0]: return msg.get('result',{})
        except Exception as e:
            return None

req('Runtime.enable')

# Check current state
loc = req('Runtime.evaluate', {'expression':'window.location.href','returnByValue':True})
print(f"Current URL: {loc.get('result',{}).get('value','N/A')[:80]}")

# Navigate to Gemini app
print("Navigating to gemini.google.com/app...")
req('Runtime.evaluate', {'expression': 'window.location.href="https://gemini.google.com/app"', 'returnByValue': True})

# We need to wait for navigation, then reconnect
ws.close()

# Wait for page to load
print("Waiting for page to load...")
for i in range(30):
    time.sleep(1)
    # Re-fetch tabs to get new URL
    tabs2 = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
    gt2 = next((t for t in tabs2 if 'gemini.google.com/app' in t.get('url','') and t['type']=='page'), None)
    if gt2:
        print(f"Gemini back at {i+1}s: {gt2['title'][:60]}")
        break
    # Check if still rotating  
    rt = next((t for t in tabs2 if 'RotateCookies' in t.get('url','')), None)
    if rt:
        print(f"  Still rotating ({i+1}s)...")
else:
    print("Timeout - Gemini did not return to app")
    exit(1)

# Now reconnect and test
print("\nReconnecting...")
ws2 = websocket.create_connection(gt2['webSocketDebuggerUrl'], timeout=30)
cid2=[0]
def req2(m,p=None):
    cid2[0]+=1
    ws2.send(json.dumps({'id':cid2[0],'method':m,'params':p or {}}))
    while True:
        msg=json.loads(ws2.recv())
        if msg.get('id')==cid2[0]: return msg.get('result',{})
def ev2(e):
    r=req2('Runtime.evaluate',{'expression':e,'returnByValue':True})
    v=r.get('result',{})
    return v.get('value') if v.get('subtype')!='error' else None

req2('Runtime.enable')
req2('Input.enable')

# Verify ready
loc2 = ev2('window.location.href')
ce2 = ev2('!!document.querySelector("[contenteditable=true]")')
print(f"URL: {str(loc2)[:80]}")
print(f"Editor: {'✅' if ce2 else '❌'}")

# Check for model-response
mr = ev2('(function(){var m=document.querySelector("model-response");if(!m)return"";return(m.textContent||"").trim();})()')
print(f"Existing MR: {'yes ('+str(len(mr))+' chars)' if mr else 'no'}")

# Type + Send
print("\nTesting send with Enter...")
ev2('(function(){var ce=document.querySelector("[contenteditable=true]");if(ce){ce.focus();ce.innerText="";return 1;}return 0;})()')
time.sleep(0.5)
req2('Input.insertText', {'text': 'Say hello in one short sentence.'})
time.sleep(1.5)

# Check URL before sending
loc_check = ev2('window.location.href')
if loc_check and 'gemini' not in str(loc_check):
    print(f"⚠️ ROTATED before send! {str(loc_check)[:80]}")
    ws2.close()
    exit(1)

print("Sending Enter...")
req2('Input.dispatchKeyEvent', {'type':'keyDown','key':'Enter','keyCode':13,'code':'Enter','windowsVirtualKeyCode':13})
time.sleep(0.05)
req2('Input.dispatchKeyEvent', {'type':'keyUp','key':'Enter','keyCode':13,'code':'Enter'})

# Wait for response
for i in range(45):
    time.sleep(1)
    u = ev2('window.location.href')
    if u and 'gemini' not in str(u):
        print(f'ROTATED at {i+1}s: {str(u)[:80]}')
        break
    mr = ev2('(function(){var m=document.querySelector("model-response");if(!m)return"";return(m.textContent||"").trim();})()')
    if mr and len(mr) > 10:
        print(f'\n✅ Gemini responded! [{len(mr)} chars]')
        print(mr[:300])
        break
    print(i+1, end=',',flush=True)
else:
    print('\n❌ No response')

ws2.close()
