import { getBridgeUrl } from '../tuya/mode';
import type { AmbilightConfig, AmbilightPreset } from './jointspace';
import type { NowOnTv } from './philips';

export type TvClient = {
  openApp: (key: string) => Promise<void>;
  playYouTube: (videoId: string) => Promise<void>;
  nowPlaying: () => Promise<NowOnTv>;
  /** Cómo está el Ambilight ahora (para devolverlo así al quitar un modo) */
  ambilight: () => Promise<AmbilightConfig | null>;
  setAmbilight: (cfg: AmbilightConfig | { preset: AmbilightPreset }) => Promise<void>;
};

/** Sin sockets propios (Expo Go, navegador), la tele se pide al puente de casa, como las bombillas. */
export function bridgeTv(): TvClient {
  const call = async (path: string, init?: RequestInit) => {
    const base = getBridgeUrl();
    if (!base) throw new Error('Para la tele hace falta la app compilada o el puente de casa');
    const r = await fetch(base + path, init ?? { method: 'POST' });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? 'La tele no responde');
    return body;
  };
  return {
    openApp: (key) => call(`/tv/app/${encodeURIComponent(key)}`),
    playYouTube: (id) => call(`/tv/youtube/${encodeURIComponent(id)}`),
    nowPlaying: async () => (await call('/tv/now', { method: 'GET' })).now as NowOnTv,
    ambilight: async () => (await call('/tv/ambilight', { method: 'GET' })).config as AmbilightConfig | null,
    setAmbilight: (cfg) => call('/tv/ambilight', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg) }),
  };
}
