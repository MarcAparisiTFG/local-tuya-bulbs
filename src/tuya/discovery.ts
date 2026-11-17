import { Found, UdpSocket, discoverWith } from './discoverCore';
import { HAS_UDP } from './sockets';

export type { Found };

export async function discover(ms = 6000): Promise<Found[]> {
  if (!HAS_UDP) return [];
  // Igual que el TCP: se carga sólo si el módulo nativo existe
  const dgram = require('react-native-udp');
  return discoverWith(() => dgram.createSocket({ type: 'udp4' }) as UdpSocket, ms);
}
