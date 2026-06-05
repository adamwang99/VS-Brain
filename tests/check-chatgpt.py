import json, websocket
ws = websocket.create_connection('ws://127.0.0.1:9222/devtools/page/95E2E468453D631D9ABE55F94A6E487C', timeout=10)
_cid = [0]
def cmd(w, m, p=None):
    _cid[0] += 1
    w.send(json.dumps({'id': _cid[0], 'method': m, 'params': p or {}}))
    while True:
        msg = json.loads(w.recv())
        if msg.get('id') == _cid[0]:
            return msg.get('result', {})
def ev(w, e):
    r = cmd(w, 'Runtime.evaluate', {'expression': e, 'returnByValue': True})
    return r.get('result', {}).get('value')
cmd(ws, 'Runtime.enable')
print('URL:', ev(ws, 'window.location.href'))
print('Title:', ev(ws, 'document.title'))
msgs = ev(ws, 'document.querySelectorAll("[data-message-author-role]").length')
print('Messages:', msgs)
roles = ev(ws, '(function(){var ms=document.querySelectorAll("[data-message-author-role]");var out=[];ms.forEach(function(m){out.push(m.getAttribute("data-message-author-role"));});return JSON.stringify(out);})()')
print('Roles:', roles)
ed = ev(ws, '(function(){var e=document.getElementById("prompt-textarea");return e?e.textContent.length:0})()')
print('Editor chars:', ed)
if msgs and msgs > 2:
    last_text = ev(ws, '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";return(ms[ms.length-1].textContent||"").trim().substring(0,300);})()')
    print('Last assistant:', last_text)
ws.close()
