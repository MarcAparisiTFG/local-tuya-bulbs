// Los códigos del tiempo (WMO) de Open-Meteo, en un dibujo y una palabra. Sin dependencias: lo usa también el puente.
export type Sky = 'sun' | 'moon' | 'sun-cloud' | 'cloud' | 'fog' | 'sun-rain' | 'rain' | 'storm' | 'snow';

/** Los códigos WMO de Open-Meteo, en un dibujo y una palabra. */
export function sky(code: number, day = true): { sky: Sky; word: string } {
  if (code === 0) return { sky: day ? 'sun' : 'moon', word: 'Despejado' };
  if (code <= 2) return { sky: day ? 'sun-cloud' : 'moon', word: 'Poco nuboso' };
  if (code === 3) return { sky: 'cloud', word: 'Nublado' };
  if (code === 45 || code === 48) return { sky: 'fog', word: 'Niebla' };
  if (code >= 51 && code <= 57) return { sky: 'sun-rain', word: 'Llovizna' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { sky: 'rain', word: code >= 80 ? 'Chubascos' : 'Lluvia' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { sky: 'snow', word: 'Nieve' };
  if (code >= 95) return { sky: 'storm', word: 'Tormenta' };
  return { sky: 'cloud', word: 'Nublado' };
}
