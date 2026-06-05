"""Debug Gemini: connect -> reload -> type -> Enter -> wait response"""
import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())
gem_tab = next((t for t in tabs if "gemini.google.com/app" in t.get("url","")), None)
print(f"Tab: {gem_tab['id'][:8]} URL: {gem_tab['url'][:80]}")

ws = websocket.create_connection(gem_tab["webSocketDebuggerUrl"], timeout=15)
_cid=[0]
def req(m, p=None):
    _cid[0]+=1
    ws.send(json.dumps({"id":_cid[0],"method":m,"params":p or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get("id")==_cid[0]: return msg.get("result",{})
def ev(e):
    r=req("Runtime.evaluate",{"expression":e,"returnByValue":True})
    return r.get("result",{}).get("value")

req("Runtime.enable")
req("Page.enable")
req("Input.enable")

# 1. Reload
print("\n>>> Reloading...")
ev('window.location.href="https://gemini.google.com/app"')
time.sleep(3)
for i in range(20):
    st = ev("document.readyState")
    if st == "complete":
        ce = ev('!!document.querySelector("[contenteditable=true]")')
        print(f"   Ready after {3+i}s | editor={ce} | readyState={st}")
        if ce:
            break
    time.sleep(1)
else:
    print("   TIMEOUT waiting for load")

# 2. Focus + type
print("\n>>> Focusing + typing...")
ev('var e=document.querySelector("[contenteditable=true]");if(e){e.focus();e.innerText="";}')
time.sleep(0.5)
req("Input.insertText", {"text": "Test phan bien: Hoc sinh co nen dung AI de lam bai tap ve nha?"})
time.sleep(1)
txt = ev('(function(){var e=document.querySelector("[contenteditable=true]");return e?e.textContent:null})()')
print(f"   Editor text: {repr(txt[:100] if txt else 'null')}")

# 3. Press Enter
print(">>> Pressing Enter...")
req("Input.dispatchKeyEvent", {"type":"keyDown","key":"Enter","keyCode":13,"code":"Enter","windowsVirtualKeyCode":13})
time.sleep(0.05)
req("Input.dispatchKeyEvent", {"type":"keyUp","key":"Enter","keyCode":13,"code":"Enter"})

# 4. Wait
print(">>> Waiting for model-response...")
for t in range(30):
    time.sleep(2)
    mr = ev('(function(){var m=document.querySelector("model-response");return m?(m.textContent||"").substring(0,300):null})()')
    ed = ev("document.readyState")
    preview = (mr or "null")[:80] if mr is not None else "TYPE_ERR"
    print(f"   t={t*2}s ready={ed} mr={preview}")
    if mr and len(mr) > 20:
        print(f"\n===== GEMINI RESPONSE ({len(mr)} chars) =====")
        print(mr)
        print("=" * 50)
        break
    if t > 0 and t % 5 == 0:
        ce = ev('!!document.querySelector("[contenteditable=true]")')
        btn = ev('!!document.querySelector("button")')
        print(f"   [check] editor={ce} any-btn={btn}")

ws.close()
