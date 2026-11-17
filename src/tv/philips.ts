import { TvApp, tvApp } from './apps';
import { castLaunch, TlsConnect } from './cast';
import { loungeNowPlaying, loungePlay } from './lounge';

const DIAL_PORT = 56789;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lo que se puede pedir a la tele. Lo usan la app (con sus sockets) y el puente de casa (con los de Node). */
export type NowOnTv = { app: string; youtube?: string; title?: string } | null;

export function createTv(ip: string, tls: TlsConnect) {
  const dial = (app: string) => `http://${ip}:${DIAL_PORT}/apps/${app}`;

  const dialStatus = async (app: string) => (await (await fetch(dial(app))).text()) || '';

  const dialLaunch = async (name: string, origin: string, body = '') => {
    const r = await fetch(dial(name), { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: origin }, body });
    if (r.status !== 201 && r.status !== 200) throw new Error(`La tele no ha abierto ${name} (${r.status})`);
  };

  const openApp = async (app: TvApp) => ('dial' in app.how ? dialLaunch(app.how.dial, app.how.origin) : castLaunch(tls, ip, app.how.cast));

  return {
    openApp: (key: string) => {
      const app = tvApp(key);
      if (!app) throw new Error('App desconocida');
      return openApp(app);
    },
    /** Un vídeo de YouTube: abre YouTube si hace falta y lo manda por la «sala» (sin selector de cuentas). */
    playYouTube: async (videoId: string) => {
      const yt = tvApp('youtube')!;
      let screen = (await dialStatus('YouTube')).match(/<screenId>([^<]+)/)?.[1];
      if (!screen) {
        await openApp(yt);
        // YouTube tarda unos segundos en arrancar y dar su pantalla
        for (let i = 0; i < 20 && !screen; i++) {
          await wait(700);
          screen = (await dialStatus('YouTube')).match(/<screenId>([^<]+)/)?.[1];
        }
      }
      if (!screen) throw new Error('YouTube no ha arrancado en la tele');
      await loungePlay(screen, videoId);
    },
    /** Lo que se ve ahora: el vídeo de YouTube (con su título) o la app abierta. */
    nowPlaying: async (): Promise<NowOnTv> => {
      const yt = await dialStatus('YouTube');
      const screen = /<state>running/.test(yt) ? yt.match(/<screenId>([^<]+)/)?.[1] : undefined;
      if (screen) {
        const id = await loungeNowPlaying(screen);
        if (id) {
          const o = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)
            .then((r) => r.json())
            .catch(() => ({}));
          return { app: 'youtube', youtube: id, title: o.title };
        }
        return { app: 'youtube' };
      }
      for (const key of ['netflix', 'prime']) {
        const app = tvApp(key)!;
        if ('dial' in app.how && /<state>running/.test(await dialStatus(app.how.dial))) return { app: key };
      }
      return null;
    },
  };
}

export type Tv = ReturnType<typeof createTv>;
