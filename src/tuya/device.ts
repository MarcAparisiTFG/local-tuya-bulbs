import { CMD, TuyaMessage, decodeMessage, encodeMessage, packetLength } from './protocol33';
import { CMD34, decode34, dpsOf, encode34, handshake, keyOf, TuyaMessage34 } from './protocol34';

/** Lo mínimo que necesitamos de un socket TCP; encaja con react-native-tcp-socket y con node:net. */
export interface TcpLike {
  on(event: 'data', cb: (d: Uint8Array) => void): unknown;
  on(event: 'error', cb: (e: Error) => void): unknown;
  on(event: 'close', cb: () => void): unknown;
  write(data: Uint8Array): unknown;
  destroy(): unknown;
}
export type Connect = (host: string, port: number, onConnect: () => void) => TcpLike;

export type Dps = Record<string, string | number | boolean>;

/** Versión del protocolo local: las bombillas hablan 3.3; el enchufe, 3.4 (con clave de sesión). */
export type TuyaVersion = '3.3' | '3.4';

export class TuyaDevice {
  private socket?: TcpLike;
  private buf = new Uint8Array(0);
  private seqno = 1;
  private waiters: { cmd: number; resolve: (m: TuyaMessage) => void }[] = [];
  private heartbeat?: ReturnType<typeof setInterval>;
  /** 3.4: la clave de la sesión, negociada al conectar */
  private session?: Uint8Array;
  private handshakeReply?: (packet: Uint8Array) => void;
  onStatus?: (dps: Dps) => void;
  onClose?: () => void;

  constructor(
    readonly devId: string,
    readonly host: string,
    private readonly localKey: string,
    private readonly connectFn: Connect,
    readonly version: TuyaVersion = '3.3',
  ) {}

  private get v34() {
    return this.version === '3.4';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = this.connectFn(this.host, 6668, () => {
        clearTimeout(timer);
        (this.v34 ? this.negotiate() : Promise.resolve()).then(
          () => {
            this.heartbeat = setInterval(() => this.send(CMD.HEART_BEAT, '{}').catch(() => {}), 9000);
            resolve();
          },
          (e: Error) => {
            s.destroy();
            reject(e);
          },
        );
      });
      s.on('data', (d) => this.onData(d));
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error('No llego a la bombilla (¿está encendida y en el mismo Wi-Fi?)'));
      }, 4000);
      s.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
        this.onClose?.();
      });
      s.on('close', () => {
        clearTimeout(timer);
        clearInterval(this.heartbeat);
        this.onClose?.();
      });
      this.socket = s;
    });
  }

  close() {
    clearInterval(this.heartbeat);
    this.socket?.destroy();
  }

  /** 3.4: los tres pasos de la clave de sesión (protocol34.ts). Hasta que acaba, todo va con la local_key. */
  private negotiate(): Promise<void> {
    const hs = handshake(this.localKey);
    this.session = undefined;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handshakeReply = undefined;
        reject(new Error('El aparato no contesta a la clave'));
      }, 4000);
      this.handshakeReply = (packet) => {
        clearTimeout(timer);
        this.handshakeReply = undefined;
        try {
          const { packet: out, sessionKey } = hs.finish(packet, this.seqno++);
          this.socket?.write(out);
          this.session = sessionKey;
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      this.socket?.write(hs.start(this.seqno++));
    });
  }

  /** Estado actual del aparato (todos sus DPS). */
  async getStatus(): Promise<Dps> {
    if (this.v34) return dpsOf((await this.send(CMD34.DP_QUERY_NEW, '{}')).payload) ?? {};
    const body = JSON.stringify({ gwId: this.devId, devId: this.devId, uid: this.devId, t: this.now() });
    const m = await this.send(CMD.DP_QUERY, body);
    return JSON.parse(m.payload).dps ?? {};
  }

  /** Cambia uno o varios DPS, p. ej. { '20': true }. */
  async setDps(dps: Dps): Promise<void> {
    if (this.v34) {
      await this.send(CMD34.CONTROL_NEW, JSON.stringify({ protocol: 5, t: Number(this.now()), data: { dps } }));
      return;
    }
    const body = JSON.stringify({ devId: this.devId, uid: this.devId, t: this.now(), dps });
    await this.send(CMD.CONTROL, body);
  }

  private now() {
    return String(Math.floor(Date.now() / 1000));
  }

  private send(cmd: number, json: string, timeoutMs = 5000): Promise<TuyaMessage> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Sin conexión'));
      const waiter = {
        cmd,
        resolve: (m: TuyaMessage) => {
          clearTimeout(timer);
          resolve(m);
        },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error('La bombilla no responde'));
      }, timeoutMs);
      this.waiters.push(waiter);
      this.socket.write(
        this.v34 ? encode34(this.session ?? keyOf(this.localKey), cmd, this.seqno++, json) : encodeMessage(this.localKey, cmd, this.seqno++, json),
      );
    });
  }

  private onData(chunk: Uint8Array) {
    const joined = new Uint8Array(this.buf.length + chunk.length);
    joined.set(this.buf);
    joined.set(chunk, this.buf.length);
    this.buf = joined;

    for (let n = packetLength(this.buf); n !== null; n = packetLength(this.buf)) {
      const packet = this.buf.slice(0, n);
      this.buf = this.buf.slice(n);
      if (this.handshakeReply) {
        this.handshakeReply(packet);
        continue;
      }
      let msg: TuyaMessage;
      try {
        msg = this.v34 ? this.decode34(packet) : decodeMessage(this.localKey, packet);
      } catch {
        continue;
      }
      if (msg.cmd === CMD.STATUS && msg.payload) {
        try {
          const dps = this.v34 ? dpsOf(msg.payload) : JSON.parse(msg.payload).dps;
          if (dps) this.onStatus?.(dps);
        } catch {}
      }
      const i = this.waiters.findIndex((w) => w.cmd === msg.cmd);
      if (i >= 0) this.waiters.splice(i, 1)[0].resolve(msg);
    }
  }

  private decode34(packet: Uint8Array): TuyaMessage34 {
    const m = decode34(this.session ?? keyOf(this.localKey), packet);
    if (!m.crcOk) throw new Error('Firma incorrecta');
    return m;
  }
}
