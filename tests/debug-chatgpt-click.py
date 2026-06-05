"""Debug ChatGPT button click + ev return"""
import json, websocket, time
ws = websocket.create_connection("ws://127.0.0.1:9222/devtools/page/95E2E468453D631D9ABE55F94A6E487C", timeout=15)
cid=[0]
def c(m,p=None):
    global cid; cid[0]+=1
    ws.send(json.dumps({"id":cid[0],"method":m,"params":p or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get("id")==cid[0]: return msg.get("result",{})
def ev(e):
    r=c("Runtime.evaluate",{"expression":e,"returnByValue":True})
    return r.get("result",{}).get("value")

c("Runtime.enable")
c("Input.enable")

print("URL:", ev("window.location.href"))
print("Editor:", ev('!!document.getElementById("prompt-textarea")'))

# Test simple ev
print("\nSimple ev test:", repr(ev('"hello world"')))

# Type something first
ev('var el=document.getElementById("prompt-textarea");if(el){el.focus();el.innerText="test message";}')
time.sleep(0.5)
c("Input.insertText",{"text":" Xin chao, test dialog AI"})
time.sleep(1)

# Now check editor text
print("Editor after type:", repr(ev('var e=document.getElementById("prompt-textarea");if(e)return e.textContent.substring(0,60);return"NO";')))

# Try button click as a standalone string expression
expr = 'var btn=document.querySelector("[data-testid=send-button]");if(btn&&!btn.disabled){btn.click();return"send-dt";}var bs=document.querySelectorAll("button[aria-label]");for(var i=0;i<bs.length;i++)if(bs[i].getAttribute("aria-label")==="Gửi lời nhắc"&&!bs[i].disabled){bs[i].click();return"send-aria:"+i;}return"no-btn:"+bs.length;'
raw = c("Runtime.evaluate",{"expression":expr,"returnByValue":True})
print("\nButton click raw:")
print(json.dumps(raw,indent=2,ensure_ascii=False)[:800])

# Check if messages appeared
time.sleep(3)
print("\nMessages:", ev('document.querySelectorAll("[data-message-author-role]").length'))

ws.close()
