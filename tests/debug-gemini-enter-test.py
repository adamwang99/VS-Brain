"""Debug Gemini: verify Enter works + find actual send button in new UI"""
import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
gt = next(t for t in tabs if 'gemini.google.com/app' in t['url'])
ws = websocket.create_connection(gt['webSocketDebuggerUrl'], timeout=15)
cid=[0]
def req(m, p=None):
    cid[0]+=1
    ws.send(json.dumps({'id':cid[0],'method':m,'params':p or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get('id')==cid[0]: return msg.get('result',{})
def ev(e):
    r=req('Runtime.evaluate',{'expression':e,'returnByValue':True})
    return r.get('result',{}).get('value')

req('Runtime.enable')
req('Input.enable')

print("=== Current state ===")
print("URL:", ev('window.location.href'))
print("Title:", ev('document.title'))

# Check for ALL buttons near contenteditable
print("\n=== All buttons near editor ===")
btns = ev('''(function(){
var ce=document.querySelector("[contenteditable=true]");
if(!ce)return "NO contenteditable";
var inp=ce.closest("input-area-v2")||ce.closest(".input-area")||ce.parentElement;
var allBtns=inp?inp.querySelectorAll("button"):[];
var out=[];
allBtns.forEach(function(b,i){
  out.push('['+i+'] aria="'+(b.getAttribute("aria-label")||"")+'" disabled='+b.disabled+' visible='+(b.offsetParent!==null)+' className='+(b.className||"").substring(0,50));
});
if(!out.length) out.push("No buttons found in input area");
return out.join("\\n");
})()''')
print(btns or "NULL")

# Also search for the actual submit method
print("\n=== Looking for send/sendMessage/chat event handlers ===")
handlers = ev('''(function(){
var ce=document.querySelector("[contenteditable=true]");
if(!ce)return "NO CE";
var out=[];
// Check if it's using a modern React/vue approach
var ql=ce.closest(".ql-editor");
if(ql) out.push("Has ql-editor class");
var rich=ce.closest("rich-textarea");
if(rich) out.push("Has rich-textarea tag");
// Check for keydown listeners on the contenteditable
// (can't see listeners directly from DOM)
// Check data attributes
var allAttrs=ce.getAttributeNames ? Array.from(ce.getAttributeNames()).filter(function(a){return a.startsWith("data-")||a.startsWith("ng-")}) : [];
out.push("Attributes on CE: "+allAttrs.join(", "));
return out.join("\\n");
})()''')
print(handlers or "NULL")

# Test Enter key submit
print("\n=== Test: Clear + type + Enter ===")
ev('(function(){var ce=document.querySelector("[contenteditable=true]");if(ce){ce.focus();ce.innerText="";return "CLEARED";}return "FAIL";})()')
time.sleep(0.5)

# Type short text
req('Input.insertText', {'text': 'Test message: Hello, respond briefly with one sentence.'})
time.sleep(1.5)

# Check if send button appeared
print("Send btn after type:", ev('''(function(){
var ce=document.querySelector("[contenteditable=true]");
if(!ce)return "NO CE";
var inp=ce.closest("input-area-v2")||ce.closest(".input-area")||ce.parentElement;
var btns=inp?inp.querySelectorAll("button"):[];
var res=[];
btns.forEach(function(b,i){
  if(!b.disabled&&b.offsetParent!==null){
    res.push('['+i+'] aria="'+(b.getAttribute("aria-label")||"")+'" size='+JSON.stringify(b.getBoundingClientRect()));
  }
});
if(!res.length) res.push("No visible enabled buttons near CE - total ce buttons: "+btns.length);
return res.join("\\n");
})()'''))

# Hit Enter to send
print("Dispatching Enter...")
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'Enter','keyCode':13,'code':'Enter'})
time.sleep(0.05)
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'Enter','keyCode':13,'code':'Enter'})

# Wait for response
for i in range(30):
    time.sleep(1)
    mr = ev('(function(){var mr=document.querySelector("model-response");if(!mr)return "";return (mr.textContent||"").trim().substring(0,100);})()')
    if mr and len(mr) > 20:
        print(f"model-response after {i+1}s: {mr}...")
        break
    print(".", end="", flush=True)
else:
    print("\nTIMEOUT - no model-response")
    # Check what happened
    print("URL after timeout:", ev('window.location.href'))

ws.close()
