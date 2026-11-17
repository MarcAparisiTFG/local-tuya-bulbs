// Las apps que se abren en la tele Philips (Titan OS) y cómo, comprobado en la tele (2026-11-15):
//  dial → protocolo DIAL (puerto 56789); la tele sólo obedece si la petición dice venir de un cliente conocido (origin)
//  cast → Google Cast, por el identificador de su receptor
// HBO Max falta: no hay un identificador de Cast fiable.
export type TvAppKey = 'youtube' | 'netflix' | 'prime' | 'disney' | 'spotify';

export type TvApp = {
  key: TvAppKey;
  name: string;
  /** color de la marca, para su botón */
  color: string;
  ink: string;
  how: { dial: string; origin: string } | { cast: string };
};

export const TV_APPS: TvApp[] = [
  { key: 'youtube', name: 'YouTube', color: '#FF0033', ink: '#FFFFFF', how: { dial: 'YouTube', origin: 'https://www.youtube.com' } },
  { key: 'netflix', name: 'Netflix', color: '#000000', ink: '#E50914', how: { dial: 'Netflix', origin: 'https://www.netflix.com' } },
  { key: 'prime', name: 'Prime Video', color: '#1A98FF', ink: '#FFFFFF', how: { dial: 'AmazonInstantVideo', origin: 'package:com.google.android.youtube' } },
  { key: 'disney', name: 'Disney+', color: '#0B1C5C', ink: '#FFFFFF', how: { cast: 'C3DE6BC2' } },
  { key: 'spotify', name: 'Spotify', color: '#1ED760', ink: '#000000', how: { cast: 'CC32E753' } },
];

export const tvApp = (key: string) => TV_APPS.find((a) => a.key === key);

/** El id de un vídeo de YouTube a partir de un enlace (watch, youtu.be, live, shorts) o del id tal cual. */
export function youtubeId(text: string): string | null {
  const t = text.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
