"""Debug Gemini: find send mechanism"""
import json, urllib.request, websocket, time

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read())
gem_tab = next((t for t in tabs if "gemini.google.com/app" in t.get("url","")), None)

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
req("Input.enable")

print("URL:", ev("window.location.href"))
print("Title:", ev("document.title"))

# Scan for send-related buttons/data-testid
sc = ev("""
(function(){
    var out = [];
    // All buttons with aria-label
    var all = document.querySelectorAll('button[aria-label]');
    out.push('=== Buttons with aria-label: ' + all.length + ' ===');
    all.forEach(function(b,i){
        var aria = b.getAttribute('aria-label')||'';
        out.push(i+': aria="'+aria.substring(0,80)+'" disabled='+b.disabled);
    });
    
    // Elements with data-testid
    var dt = document.querySelectorAll('[data-testid]');
    out.push('\\n=== Elements with data-testid: ' + dt.length + ' ===');
    dt.forEach(function(e,i){
        out.push(i+': tag='+e.tagName+' testid="'+e.getAttribute('data-testid')+'"');
    });
    
    // Check if there's a form
    var forms = document.querySelectorAll('form');
    out.push('\\n=== Forms: ' + forms.length + ' ===');
    forms.forEach(function(f,i){
        out.push(i+': action='+(f.getAttribute('action')||'none')+' method='+(f.getAttribute('method')||'none'));
    });
    
    // Check contenteditable
    var ce = document.querySelectorAll('[contenteditable]');
    out.push('\\n=== Contenteditable: ' + ce.length + ' ===');
    ce.forEach(function(e,i){
        out.push(i+': tag='+e.tagName+' role='+(e.getAttribute('role')||'none')+' text='+(e.textContent||'').substring(0,60));
    });
    
    return out.join('\\n');
})()
""")
print("\n" + (sc or "NULL"))

# Focus editor, type, check
ev('var e=document.querySelector("[contenteditable=true]");if(e){e.focus();e.innerText="";}')
time.sleep(0.3)
req("Input.insertText", {"text": "test"})
time.sleep(0.5)
sc2 = ev("""
(function(){
    var out = [];
    var all = document.querySelectorAll('button[aria-label]');
    all.forEach(function(b,i){
        var aria = b.getAttribute('aria-label')||'';
        if(aria.toLowerCase().includes('send') || aria.toLowerCase().includes('gui') || aria.toLowerCase().includes('submit')){
            out.push(i+': aria="'+aria+'" disabled='+b.disabled);
        }
    });
    if(!out.length) out.push('NO send/submit button found among '+all.length+' buttons');
    return out.join('\\n');
})()
""")
print("\n=== Send buttons after type ===")
print(sc2)

ws.close()
