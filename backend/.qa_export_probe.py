import json
import requests
base='http://127.0.0.1:8001'
cards=[{"q":"Q1","a":"A1","topic":"General"}]
out=[]
for fmt in ['pdf','anki']:
    r=requests.post(base+'/export', json={'deck_name':'QADeck','format':fmt,'cards':cards}, timeout=60)
    out.append({'format':fmt,'status':r.status_code,'content_type':r.headers.get('content-type',''),'len':len(r.content),'body':(r.text[:160] if not r.ok else '')})
print(json.dumps(out,indent=2))
