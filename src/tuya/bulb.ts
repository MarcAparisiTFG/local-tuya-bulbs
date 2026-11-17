import { Dps, TuyaDevice } from './device';

// Bombillas Tuya "v2": 20 = encendido, 21 = modo, 22 = brillo (10-1000),
// 23 = temperatura (0-1000), 24 = color HSV en hexadecimal.
// Si la tuya usa los DPS 1-5 (v1) lo veremos en getStatus() y se ajusta aquí.
export const DP = { power: '20', mode: '21', bright: '22', temp: '23', colour: '24' } as const;

export const setPower = (d: TuyaDevice, on: boolean) => d.setDps({ [DP.power]: on });

export const setBrightness = (d: TuyaDevice, percent: number) =>
  d.setDps({ [DP.mode]: 'white', [DP.bright]: Math.round(10 + (Math.min(100, Math.max(0, percent)) / 100) * 990) });

export const setWhiteTemp = (d: TuyaDevice, percent: number) =>
  d.setDps({ [DP.mode]: 'white', [DP.temp]: Math.round((Math.min(100, Math.max(0, percent)) / 100) * 1000) });

/** h 0-360, s y v 0-100 */
export function hsvHex(h: number, s: number, v: number): string {
  const hex = (n: number, digits: number) => Math.round(n).toString(16).padStart(digits, '0');
  return hex(h, 4) + hex((s / 100) * 1000, 4) + hex((v / 100) * 1000, 4);
}

export const setColour = (d: TuyaDevice, h: number, s = 100, v = 100): Promise<void> =>
  d.setDps({ [DP.mode]: 'colour', [DP.colour]: hsvHex(h, s, v) });

export const isOn = (dps: Dps) => dps[DP.power] === true;
