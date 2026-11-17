"""Prueba: abrir un vídeo de YouTube en la tele por Google Cast. Uso: python tools/tv_youtube_test.py IP VIDEO_ID"""
import sys
import time

import pychromecast
from pychromecast.controllers.youtube import YouTubeController

ip, video = sys.argv[1], sys.argv[2]
cast = pychromecast.get_chromecast_from_host((ip, 8009, None, None, None))
cast.wait(timeout=10)
print("Tele:", cast.cast_info.friendly_name, "|", cast.cast_info.model_name, "|", cast.cast_info.manufacturer)
print("App ahora:", cast.status.display_name if cast.status else None)
yt = YouTubeController()
cast.register_handler(yt)
t = time.time()
yt.play_video(video)
time.sleep(4)
print(f"Pedido en {time.time() - t:.1f}s · app ahora:", cast.status.display_name if cast.status else None)
mc = cast.media_controller
print("Reproduciendo:", mc.status.title, "|", mc.status.player_state)
cast.disconnect()
