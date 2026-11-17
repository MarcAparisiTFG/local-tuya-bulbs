"""Empareja MarsianApp con la tele Philips (API JointSpace 6, puerto 1926), una sola vez.

  1) Con la tele encendida:   TV_IP=192.168.1.x venv/bin/python -I tools/python/tv_pair.py request
     → la tele enseña un PIN de 4 cifras
  2) Con ese PIN:             TV_IP=192.168.1.x venv/bin/python -I tools/python/tv_pair.py grant 1234
     → guarda las credenciales en tv.json (secreto: no subirlo a ningún sitio)

El procedimiento es el de la app oficial de Philips (el mismo que usan pylips y Home Assistant).
"""

import base64
import hashlib
import hmac
import json
import os
import random
import string
import sys
from pathlib import Path

import requests
import urllib3
from requests.auth import HTTPDigestAuth

# la tele usa un certificado propio, no uno de una autoridad: se acepta sólo para su IP de casa
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TV_IP = os.environ.get("TV_IP") or sys.exit("Pon la IP de la tele: TV_IP=192.168.1.x python tools/python/tv_pair.py request")
BASE = f"https://{TV_IP}:1926/6"
HERE = Path(__file__).resolve().parents[2]
PENDING = HERE / "tv-pairing.json"
CREDS = HERE / "tv.json"
# clave pública con la que firma la app oficial de Philips al emparejar
SECRET = base64.b64decode("ZmVay1EQVFOaZhwQ4Kv81ypLAZNczV9sG4KkseXWn1NEk6cXmPKO/MCa9sryslvLCFMnNe4Z4CPXzToowvhHvA==")


def device(device_id: str) -> dict:
    return {
        "device_name": "MarsianApp",
        "device_os": "Android",
        "app_name": "MarsianApp",
        "type": "native",
        "app_id": "app.marsianapp",
        "id": device_id,
    }


def request() -> None:
    device_id = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    r = requests.post(f"{BASE}/pair/request", json={"scope": ["read", "write", "control"], "device": device(device_id)}, verify=False, timeout=10)
    r.raise_for_status()
    body = r.json()
    if body.get("error_id") != "SUCCESS":
        sys.exit(f"La tele no ha aceptado el emparejamiento: {body}")
    PENDING.write_text(json.dumps({"device_id": device_id, "auth_key": body["auth_key"], "timestamp": body["timestamp"]}))
    print(f"Mira la tele: debería enseñar un PIN (tienes {body.get('timeout', 60)} s).")


def grant(pin: str) -> None:
    p = json.loads(PENDING.read_text())
    signature = base64.b64encode(hmac.new(SECRET, f"{p['timestamp']}{pin}".encode(), hashlib.sha1).hexdigest().encode()).decode()
    payload = {
        "auth": {"auth_AppId": "1", "pin": pin, "auth_timestamp": p["timestamp"], "auth_signature": signature},
        "device": device(p["device_id"]),
    }
    r = requests.post(f"{BASE}/pair/grant", json=payload, auth=HTTPDigestAuth(p["device_id"], p["auth_key"]), verify=False, timeout=10)
    if r.status_code != 200:
        sys.exit(f"No ha funcionado ({r.status_code}): {r.text[:200]}")
    CREDS.write_text(json.dumps({"ip": TV_IP, "user": p["device_id"], "pass": p["auth_key"]}, indent=2))
    PENDING.unlink(missing_ok=True)
    print("Emparejada. Credenciales en tv.json")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "request":
        request()
    elif len(sys.argv) >= 3 and sys.argv[1] == "grant":
        grant(sys.argv[2])
    else:
        print(__doc__)
