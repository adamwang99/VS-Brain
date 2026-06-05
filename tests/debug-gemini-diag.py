"""Quick Gemini DOM check"""
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

print('URL:', ev('window.location.href'))
ce = ev('(function(){var ce=document.querySelector("[contenteditable=true]");return ce?"len="+ce.textContent.length+" text="+ce.textContent.substring(0,100):"NONE";})()')
print('CE:', str(ce)[:150])
mr = ev('(function(){var ms=document.querySelectorAll("model-response");return ms.length+" items";})()')
print('MR count:', mr)
msgs = ev('(function(){var ms=document.querySelectorAll("message-content");return ms.length+" items";})()')
print('Message-content count:', msgs)
# Check recent conversation
conv = ev('(function(){var ms=document.querySelectorAll("model-response");if(ms.length)return ms[ms.length-1].textContent.trim().substring(0,300);return"NONE";})()')
print('Last MR:', str(conv)[:300])
ws.close()
