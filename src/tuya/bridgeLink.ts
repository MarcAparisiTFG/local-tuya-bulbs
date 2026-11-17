import { Dps } from './device';
import { Link, LinkTarget } from './link';

// Cada cuánto se pregunta el estado para ver cambios hechos desde fuera (el puente no avisa por sí solo)
const POLL_MS = 3000;

/** Una bombilla a través del puente de casa (tools/bridge.ts). */
export async function createBridgeLink(b: LinkTarget, base: string): Promise<Link> {
  const call = async (path: string, init?: RequestInit) => {
    const r = await fetch(base + path, init);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? 'El puente de casa no responde');
    return body;
  };
  const id = encodeURIComponent(b.id);
  let last = '';
  let timer: ReturnType<typeof setInterval> | undefined;

  const link: Link = {
    getStatus: async () => {
      const dps = (await call(`/status/${id}`)) as Dps;
      last = JSON.stringify(dps);
      return dps;
    },
    setDps: async (dps) => {
      await call(`/dps/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dps) });
    },
    // el puente contesta al momento y se queda sólo con el último: no hay que esperar a la bombilla
    setLive: async (dps) => {
      await call(`/live/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dps) });
    },
    close: () => clearInterval(timer),
  };

  await link.getStatus();
  timer = setInterval(() => {
    call(`/status/${id}`)
      .then((dps: Dps) => {
        const s = JSON.stringify(dps);
        if (s !== last) {
          last = s;
          link.onStatus?.(dps);
        }
      })
      .catch(() => {});
  }, POLL_MS);
  return link;
}
