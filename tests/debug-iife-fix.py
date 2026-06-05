"""Test IIFE wrapping fix"""
import json, websocket, time
ws = websocket.create_connection("ws://127.0.0.1:9222/devtools/page/95E2E468453D631D9ABE55F94A6E487C", timeout=15)
cid=[0]
def c(m,p=None):
    global cid; cid[0]+=1
    ws.send(json.dumps({"id":cid[0],"method":m,"params":p or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get("id")==cid[0]: return msg.get("result",{})

# FIX: wrap in IIFE
def ev(e):
    if "return" not in e and "function" not in e:
        e = "return " + e
    w = "(function(){" + e + "})()"
    r = c("Runtime.evaluate",{"expression":w,"returnByValue":True})
    return r.get("result",{}).get("value")

c("Runtime.enable")
c("Input.enable")

print("1. Simple:", repr(ev('"hello"')))
print("2. Bang:", repr(ev('!!document.getElementById("prompt-textarea")')))
print("3. URL:", repr(ev('window.location.href="https://chatgpt.com/"')))

# Focus + type
ev('var el=document.getElementById("prompt-textarea");if(el){el.focus();el.innerText="";}')
time.sleep(0.3)
c("Input.insertText",{"text":"Xin chao tu fix IIFE"})
time.sleep(1)
print("4. Editor:", repr(ev('(function(){var e=document.getElementById("prompt-textarea");if(e)return e.textContent.substring(0,60);return"NO";})()')))

# Button click test
r = c("Runtime.evaluate",{"expression":"""var btn=document.querySelector("[data-testid=send-button]");if(btn&&!btn.disabled){btn.click();return"send-dt";}var bs=document.querySelectorAll("button[aria-label]");for(var i=0;i<bs.length;i++)if(bs[i].getAttribute("aria-label")==="Gửi lời nhắc"&&!bs[i].disabled){bs[i].click();return"send-aria:"+i;}return"no-btn:"+bs.length;""","returnByValue":True})
print("5. Click raw:", json.dumps(r.get("result",{}),ensure_ascii=False)[:300])
print("   Value:", r.get("result",{}).get("value"))

# This one should work
click_expr = 'var btn=document.querySelector("[data-testid=send-button]");if(btn&&!btn.disabled){btn.click();return"send-dt";}var bs=document.querySelectorAll("button[aria-label]");for(var i=0;i<bs.length;i++)if(bs[i].getAttribute("aria-label")==="Gửi lời nhắc"&&!bs[i].disabled){bs[i].click();return"send-aria:"+i;}return"no-btn:"+bs.length;'
r2 = c("Runtime.evaluate",{"expression":"(function(){" + click_expr + "})()","returnByValue":True})
print("6. Click IIFE value:", r2.get("result",{}).get("value"))

ws.close()
