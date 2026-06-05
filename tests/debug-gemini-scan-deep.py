"""Deep Gemini DOM scan - find all possible send/submit mechanisms"""
import json, urllib.request, websocket
tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
gt = next(t for t in tabs if 'gemini' in t['url'])
ws = websocket.create_connection(gt['webSocketDebuggerUrl'], timeout=15)
cid=[0]
def req(m,p=None):
    cid[0]+=1; ws.send(json.dumps({'id':cid[0],'method':m,'params':p or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get('id')==cid[0]: return msg.get('result',{})

req('Runtime.enable')
def ev(e):
    r=req('Runtime.evaluate',{'expression':e,'returnByValue':True})
    return r.get('result',{}).get('value')

# Full button scan - looking for anything send-related
scan = ev('''(function(){
var out=[];
var btns=document.querySelectorAll("button");
out.push("Total buttons: "+btns.length);
btns.forEach(function(b,i){
  var a=(b.getAttribute("aria-label")||"").trim();
  var d=b.getAttribute("data-testid")||"";
  var id=b.id||"";
  var cls=b.className||"";
  var txt=(b.textContent||"").trim().substring(0,40);
  if(a||d||id||txt){
    out.push("["+i+"] aria="+a.substring(0,40)+" testid="+d.substring(0,30)+" id="+id.substring(0,20)+" txt="+txt+" dis="+b.disabled);
  }
});
return out.join("\\n");
})()''')
print(scan)

# Also check for forms
form_scan = ev('document.querySelectorAll("form").length')
print(f"\nForms: {form_scan}")

# Check for any data-send or similar attrs
attrs = ev('''(function(){
var els=document.querySelectorAll("[data-send],[data-submit],[data-enter]");
return els.length+" elements found";
})()''')
print(f"Data send/submit/enter attrs: {attrs}")

# Check the ql-editor element complexity
qled = ev('''(function(){
var ce=document.querySelector("[contenteditable=true]");
if(!ce)return "NONE";
var parent=ce.parentElement;
return "ce.parent.tag="+parent.tagName+" class="+(parent.className||"").substring(0,60)+
  " role="+(parent.getAttribute("role")||"-")+
  " childCount="+parent.children.length;
})()''')
print(f"Editor parent: {qled}")
ws.close()
