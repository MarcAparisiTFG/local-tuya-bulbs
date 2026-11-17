import { Dps } from './device';
import { Link, LinkTarget } from './link';

// Bombillas simuladas para el modo demostración (navegador y Expo Go).
const state = new Map<string, Dps>();
// (los DPS 1 y 2 son las tomas de los enchufes simulados)
const initial = (): Dps => ({ '1': false, '2': false, '20': true, '21': 'white', '22': 800, '23': 400, '24': '001e03e803e8' });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function createSimLink(b: LinkTarget): Promise<Link> {
  await wait(150);
  if (!state.has(b.id)) state.set(b.id, initial());
  const link: Link = {
    getStatus: async () => ({ ...state.get(b.id)! }),
    setDps: async (dps) => {
      await wait(80);
      state.set(b.id, { ...state.get(b.id)!, ...dps });
      // como las bombillas reales, avisa de lo que ha cambiado
      link.onStatus?.(dps);
    },
    close() {},
  };
  return link;
}
