"""Paquetes de referencia del protocolo 3.4 (el del enchufe) hechos con tinytuya, para probar src/tuya/protocol34.ts.
Las claves y nonces son de mentira y fijos: así el resultado no cambia de una vez a otra."""
import json
import struct
import tinytuya
from tinytuya.core.crypto_helper import AESCipher
from tinytuya.core.message_helper import TuyaMessage, pack_message, unpack_message
from tinytuya.core.command_types import CONTROL, DP_QUERY, STATUS, DP_QUERY_NEW, SESS_KEY_NEG_RESP
from tinytuya.core.XenonDevice import MessagePayload
import hmac
from hashlib import sha256

KEY = "0123456789abcdef"
DEV = "bf1234567890abcdef"
LOCAL_NONCE = bytes.fromhex("00112233445566778899aabbccddeeff")
REMOTE_NONCE = bytes.fromhex("f0e1d2c3b4a5968778695a4b3c2d1e0f")

d = tinytuya.OutletDevice(DEV, "127.0.0.1", KEY, version=3.4)
key = KEY.encode()


def device_frame(k, seqno, cmd, clear):
    """Lo que manda el aparato: código de retorno 0 y los datos cifrados, firmado con HMAC."""
    payload = struct.pack(">I", 0) + AESCipher(k).encrypt(clear, False)
    return pack_message(TuyaMessage(seqno, cmd, 0, payload, 0, True, 0x55AA, None), hmac_key=k)


# 1. el nonce nuestro, cifrado con la clave local
d.seqno = 1
d.local_key = d.real_local_key
d.local_nonce = LOCAL_NONCE
step1 = d._encode_message(MessagePayload(tinytuya.SESS_KEY_NEG_START, LOCAL_NONCE))

# 2. el aparato contesta con su nonce y la firma del nuestro
step2 = device_frame(key, 100, SESS_KEY_NEG_RESP, REMOTE_NONCE + hmac.new(key, LOCAL_NONCE, sha256).digest())

# 3. le devolvemos la firma de su nonce, y de los dos sale la clave de la sesión
rkey = unpack_message(step2, hmac_key=key)
d.seqno = 2
step3 = d._encode_message(d._negotiate_session_key_generate_step_3(rkey))
d._negotiate_session_key_generate_finalize()
session = d.local_key

vectors = []


def add(name, cmd, data):
    d.seqno = 7
    msg = d.generate_payload(cmd, data)
    vectors.append({"name": name, "cmd": msg.cmd, "seqno": 7, "payloadJson": msg.payload.decode(), "hex": d._encode_message(msg).hex()})


add("control_off", CONTROL, {"1": False})
add("control_both", CONTROL, {"1": True, "2": False})
add("dp_query", DP_QUERY, None)

incoming = [
    {"name": "status_push", "cmd": STATUS, "json": '{"protocol":4,"t":1700000000,"data":{"dps":{"1":false}}}',
     "hex": device_frame(session, 50, STATUS, d.version_header + b'{"protocol":4,"t":1700000000,"data":{"dps":{"1":false}}}').hex()},
    {"name": "query_reply", "cmd": DP_QUERY_NEW, "json": '{"dps":{"1":true,"2":false,"19":125}}',
     "hex": device_frame(session, 51, DP_QUERY_NEW, b'{"dps":{"1":true,"2":false,"19":125}}').hex()},
]

out = {
    "key": KEY,
    "devId": DEV,
    "localNonce": LOCAL_NONCE.hex(),
    "remoteNonce": REMOTE_NONCE.hex(),
    "step1": step1.hex(),
    "step2": step2.hex(),
    "step3": step3.hex(),
    "sessionKey": session.hex(),
    "vectors": vectors,
    "incoming": incoming,
}
path = __file__.replace("make_vectors_v34.py", "vectors-v34.json")
json.dump(out, open(path, "w"), indent=2)
print("session", session.hex())
for v in vectors:
    print(v["name"], v["cmd"], v["payloadJson"])
