"""Debug Gemini: find send mechanism - targeted scan"""
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

req('Runtime.enable')

# Scan everything send-related
r = req('Runtime.evaluate', {'expression': '''(function(){
var out=[];
var all=document.querySelectorAll('button[aria-label]');
all.forEach(function(b,i){
  var a=(b.getAttribute('aria-label')||'').toLowerCase();
  if(a.includes('gui')||a.includes('send')||a.includes('submit')||a.includes('enter')||a.includes('chat')){
    out.push('BTN['+i+'] aria="'+b.getAttribute('aria-label')+'" disabled='+b.disabled+' visible='+(b.offsetParent!==null));
  }
});
var dt=document.querySelectorAll('[data-testid]');
dt.forEach(function(e){
  var t=(e.getAttribute('data-testid')||'').toLowerCase();
  if(t.includes('send')||t.includes('submit')||t.includes('enter')){
    out.push('DT: tag='+e.tagName+' id="'+e.getAttribute('data-testid')+'" disabled='+(e.disabled||false));
  }
});
var ce=document.querySelector('[contenteditable=true]');
if(ce){
  out.push('CE: tag='+ce.tagName+' class='+ce.className.substring(0,60));
  var p=ce.parentElement;
  while(p&&p.tagName!='BODY'){
    out.push('  parent: <'+p.tagName.toLowerCase()+' class='+(p.className||'').substring(0,40)+'>');
    p=p.parentElement;
  }
  // Try to find the sibling send button
  var sibs=ce.parentElement?Array.from(ce.parentElement.parentElement.querySelectorAll('button')):[];
  sibs.forEach(function(s,i){
    out.push('  NEIGHBOR_BTN['+i+'] aria="'+(s.getAttribute('aria-label')||'')+'" disabled='+s.disabled);
  });
}
return out.join('\\n');
})()''', 'returnByValue': True})

print(str(r.get('result',{}).get('value','NULL')))

# Now type some text and check if the send button appears/changes
ev=lambda e: req('Runtime.evaluate', {'expression': e, 'returnByValue': True}).get('result',{}).get('value')

# Focus + type
ev('(function(){var e=document.querySelector("[contenteditable=true]");if(e){e.focus();e.innerText="";return 1;}return 0;})()')
time.sleep(0.3)
req('Input.insertText', {'text': 'Hello, test send mechanism'})
time.sleep(0.5)

r2 = req('Runtime.evaluate', {'expression': '''(function(){
var out=[];
var all=document.querySelectorAll('button[aria-label]');
all.forEach(function(b,i){
  var a=(b.getAttribute('aria-label')||'').toLowerCase();
  if(a.includes('gui')||a.includes('send')||a.includes('submit')){
    out.push('BTN['+i+'] aria="'+b.getAttribute('aria-label')+'" disabled='+b.disabled+' visible='+(b.offsetParent!==null));
  }
});
// Also try to find ANY enabled button near the contenteditable
var ce=document.querySelector('[contenteditable=true]');
if(ce){
  var parentDiv=ce.closest('div');
  if(parentDiv){
    var btns=parentDiv.parentElement.querySelectorAll('button');
    btns.forEach(function(b,i){
      var aria=b.getAttribute('aria-label')||'';
      if(!b.disabled&&b.offsetParent!==null){
        out.push('NEAR_BTN['+i+'] aria="'+aria+'" disabled='+b.disabled);
      }
    });
  }
}
return out.join('\\n');
})()''', 'returnByValue': True})
print("\n--- After typing ---")
print(str(r2.get('result',{}).get('value','NULL')))

# Also try Enter key to see if it works
print("\n--- Trying Enter after type ---")
req('Input.dispatchKeyEvent', {'type':'keyDown','key':'Enter','keyCode':13,'code':'Enter','windowsVirtualKeyCode':13})
time.sleep(0.1)
req('Input.dispatchKeyEvent', {'type':'keyUp','key':'Enter','keyCode':13,'code':'Enter'})
time.sleep(2)
r3 = req('Runtime.evaluate', {'expression': '''(function(){
var mr=document.querySelector('model-response');
if(!mr)return 'NO model-response yet';
return (mr.textContent||'').substring(0,200);
})()''', 'returnByValue': True})
print("model-response: " + str(r3.get('result',{}).get('value','NULL')))

ws.close()
