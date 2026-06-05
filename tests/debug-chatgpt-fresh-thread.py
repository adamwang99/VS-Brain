#!/usr/bin/env python3
"""Debug ChatGPT: send on existing thread (not new)"""
import json, websocket, urllib.request, time

tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list').read())
ct = [t for t in tabs if t['type']=='page' and t['title'] == 'Câu trả lời toán học']
if not ct:
    ct = [t for t in tabs if t['type']=='page' and 'chatgpt.com/c/' in t['url']]
ct = ct[0]
print(f"Tab: {ct['id'][:12]} | {ct.get('title','')[:60]} | {ct['url'][:80]}")

ws = websocket.create_connection(ct['webSocketDebuggerUrl'], timeout=10)
cid=[0]
def req(m, p=None):
    cid[0] += 1
    ws.send(json.dumps({'id': cid[0], 'method': m, 'params': p or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == cid[0]: return msg
def ev(expr):
    r = req('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
    inner = r.get('result',{}).get('result',{})
    return None if inner.get('subtype') == 'error' else inner.get('value')

req('Runtime.enable')

print("URL:", ev('window.location.href'))

# Check messages
r = ev("""
(function(){
    var all=document.querySelectorAll("[data-message-author-role]");
    var result=[];
    for(var i=0;i<all.length;i++){
        var role=all[i].getAttribute("data-message-author-role");
        var t=(all[i].textContent||"").trim();
        result.push("["+i+"] "+role+" len="+t.length);
    }
    return result.join(" | ");
})()
""")
print("Messages:", r)

ed = ev("!!document.getElementById('prompt-textarea')")
print("Editor:", ed)
sb = ev("!!document.querySelector('[data-testid=send-button]')")
print("Send btn:", sb)

# If not on a thread, navigate to one
url = ev('window.location.href')
if not url or '/c/' not in str(url):
    print("Not on a thread, nav to existing one...")
    req('Page.navigate', {'url': 'https://chatgpt.com/c/6a1ff89c-9b0c-83ec-89e5-54dcd0ee494f'})
    for i in range(15):
        time.sleep(1)
        ed = ev("!!document.getElementById('prompt-textarea')")
        url = ev('window.location.href')
        print("  {}s: editor={} url={}".format(i+1, ed, (url or '')[:60]))
        if ed and '/c/' in str(url):
            break

# Send simple message on existing thread
msg = "Tóm tắt ngắn"
escaped = json.dumps(msg)
r = ev("""
(function(){
    var e=document.getElementById('prompt-textarea');
    if(!e) return 'NO_EL';
    e.focus();
    var ok=document.execCommand('insertText',false,%s);
    return ok?'OK':'FAIL';
})()
""" % escaped)
print("Insert:", r)
time.sleep(1.5)

# Check if send button appeared
sb = ev("""
(function(){
    var b=document.querySelector('[data-testid=send-button]');
    return b?'btn_disabled='+b.disabled:'NO_BTN';
})()
""")
print("Send btn:", sb)

# Click it
r = ev("""
(function(){
    var b=document.querySelector('[data-testid=send-button]');
    if(b&&!b.disabled){b.click();return 'CLICKED';}
    return 'NO';
})()
""")
print("Send click:", r)

# Wait for response
print("Waiting...")
for i in range(60):
    time.sleep(2)
    content = ev("""
    (function(){
        var ms=document.querySelectorAll('[data-message-author-role=assistant]');
        if(!ms.length) return 'no_msgs';
        var last=ms[ms.length-1];
        var txt=last.textContent.trim();
        var html_len=last.innerHTML.length;
        return 'len='+txt.length+' html='+html_len+' txt='+txt.substring(0,200);
    })()
    """)
    url_now = ev('window.location.href')
    print("  {}s: {} url={}".format(i*2, content, (url_now or '')[:60]))
    if content and 'len=' in content:
        try:
            l = int(content.split('len=')[1].split()[0])
            if l > 10:
                print("\n✅ OK! Response:", content)
                break
        except:
            pass

ws.close()
