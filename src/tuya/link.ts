import { Dps, TuyaVersion } from './device';

/** Lo que la app necesita de una bombilla conectada. TuyaDevice lo cumple; en la web hay una simulada. */
export interface Link {
  getStatus(): Promise<Dps>;
  setDps(dps: Dps): Promise<void>;
  /** Para lo que se manda mientras se arrastra, si el enlace tiene un camino más rápido (el puente) */
  setLive?(dps: Dps): Promise<void>;
  close(): void;
  onStatus?: (dps: Dps) => void;
  onClose?: () => void;
}

export type LinkTarget = { id: string; ip: string; key: string; version?: TuyaVersion };
