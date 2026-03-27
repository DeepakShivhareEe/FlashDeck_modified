import json
import time
import requests

base='http://127.0.0.1:8001'
metrics=[]

def timed(name, method, path, **kwargs):
    t0=time.perf_counter()
    r=requests.request(method, base+path, timeout=120, **kwargs)
    dt=(time.perf_counter()-t0)*1000
    metrics.append({"name":name,"status":r.status_code,"latency_ms":round(dt,2)})
    return r

cards=[{"q":"What is Python?","a":"A programming language","topic":"Programming"},{"q":"What is photosynthesis?","a":"Plants convert light into energy","topic":"Biology"}]

timed('health','GET','/health')
timed('leaderboard','GET','/leaderboard?scope=global&limit=10')
timed('generate-quiz-medium','POST','/generate-quiz', json={"cards":cards,"question_count":5,"difficulty":"medium"})

print(json.dumps(metrics, indent=2))
