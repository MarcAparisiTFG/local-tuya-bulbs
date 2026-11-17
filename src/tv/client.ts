import { HAS_TCP } from '../tuya/sockets';
import type { Data } from '../types';
import { bridgeTv, TvClient } from './bridgeTv';
import type { TlsConnect } from './cast';
import { createAmbilight } from './jointspace';
import { createTv } from './philips';

export type { TvClient };

/** En la app compilada, directo a la tele por el Wi-Fi: sin puente. */
export function tvClient(tv: Data['tv']): TvClient {
  if (!HAS_TCP) return bridgeTv();
  // se carga aquí: sin el módulo nativo (Expo Go), sólo importarlo ya rompe la app
  const TcpSocket = require('react-native-tcp-socket');
  // la tele usa un certificado propio, no de una autoridad: se acepta sólo para ella, en casa
  const tls: TlsConnect = (host, port, onConnect) => TcpSocket.createConnection({ host, port, tls: true, tlsCheckValidity: false }, onConnect);
  const ip = tv?.ip ?? '';
  const ambi = tv?.user && tv.pass ? createAmbilight(tls, { ip, user: tv.user, pass: tv.pass }) : null;
  const noAmbi = () => Promise.reject(new Error('Falta emparejar el Ambilight: trae los datos del puente en Ajustes'));
  return {
    ...createTv(ip, tls),
    ambilight: () => (ambi ? ambi.get() : noAmbi()),
    setAmbilight: (cfg) => (ambi ? ('preset' in cfg ? ambi.preset(cfg.preset) : ambi.set(cfg)) : noAmbi()),
  };
}
