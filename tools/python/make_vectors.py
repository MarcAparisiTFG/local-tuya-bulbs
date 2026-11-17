"""Genera paquetes de referencia con tinytuya para probar el protocolo en TypeScript."""
import json
import tinytuya

KEY = "0123456789abcdef"
DEV = "bf1234567890abcdef"

d = tinytuya.BulbDevice(DEV, "127.0.0.1", KEY, version=3.3)
out = []

def add(name, cmd, data):
    d.seqno = 7
    msg = d.generate_payload(cmd, data)
    raw = d._encode_message(msg)
    out.append({"name": name, "cmd": cmd, "seqno": 7, "payloadJson": msg.payload.decode(), "hex": raw.hex()})

add("control_on", tinytuya.CONTROL, {"20": True})
add("control_color", tinytuya.CONTROL, {"20": True, "21": "colour", "24": "00ff00ffff"})
add("dp_query", tinytuya.DP_QUERY, None)

path = __file__.replace("make_vectors.py", "vectors-v33.json")
json.dump({"key": KEY, "devId": DEV, "vectors": out}, open(path, "w"), indent=2)
for v in out:
    print(v["name"], v["payloadJson"], v["hex"][:40])
