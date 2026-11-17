// La «sala» de YouTube (API de pantallas emparejadas): es como el móvil manda un vídeo a la tele.
// Así no sale el selector de cuentas que aparece al abrir YouTube por DIAL con ?v=.
// Portado de casttube (MIT), que es lo que usa pychromecast.

const BASE = 'https://www.youtube.com/';
const BIND = BASE + 'api/lounge/bc/bind';
const HEADERS = { Origin: BASE, 'Content-Type': 'application/x-www-form-urlencoded' };

const form = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();

/** Entra en la sala de la tele; devuelve sus identificadores y el primer lote de mensajes (estado de la cola). */
async function openLounge(screenId: string) {
  const tokenRes = await fetch(BASE + 'api/lounge/pairing/get_lounge_token_batch', { method: 'POST', headers: HEADERS, body: form({ screen_ids: screenId }) });
  if (!tokenRes.ok) throw new Error(`YouTube no da la sala (${tokenRes.status})`);
  const lounge = (await tokenRes.json()).screens?.[0]?.loungeToken as string | undefined;
  if (!lounge) throw new Error('YouTube no da la sala');

  const headers = { ...HEADERS, 'X-YouTube-LoungeId-Token': lounge };
  const bindData = { device: 'REMOTE_CONTROL', id: 'marsianapp' + Math.random().toString(36).slice(2, 12), name: 'MarsianApp', 'mdx-version': 3, pairing_type: 'cast', app: 'android-phone-13.14.55' };
  const bind = await fetch(`${BIND}?${form({ RID: 0, VER: 8, CVER: 1 })}`, { method: 'POST', headers, body: form(bindData) });
  const text = await bind.text();
  const sid = text.match(/"c","(.*?)","/)?.[1];
  const gsession = text.match(/"S","(.*?)"]/)?.[1];
  if (!bind.ok || !sid || !gsession) throw new Error('YouTube no deja entrar en la sala');
  return { headers, sid, gsession, text };
}

/** El vídeo que tiene puesto la tele ahora mismo, si hay alguno. */
export async function loungeNowPlaying(screenId: string): Promise<string | null> {
  const { text } = await openLounge(screenId);
  const m = text.match(/"nowPlaying",\{[^}]*"videoId":"([\w-]{11})"/) ?? text.match(/"playlistModified",\{[^}]*"videoId":"([\w-]{11})"/);
  return m ? m[1] : null;
}

export async function loungePlay(screenId: string, videoId: string): Promise<void> {
  const { headers, sid, gsession } = await openLounge(screenId);
  const play = await fetch(`${BIND}?${form({ SID: sid, gsessionid: gsession, RID: 1, VER: 8, CVER: 1 })}`, {
    method: 'POST',
    headers,
    // mismos nombres que casttube: req0 + la clave original (_videoId → req0_videoId, __sc → req0__sc)
    body: form({ req0_listId: '', req0__sc: 'setPlaylist', req0_currentTime: 0, req0_currentIndex: -1, req0_audioOnly: 'false', req0_videoId: videoId, count: 1 }),
  });
  if (!play.ok) throw new Error(`YouTube no ha puesto el vídeo (${play.status})`);
}
