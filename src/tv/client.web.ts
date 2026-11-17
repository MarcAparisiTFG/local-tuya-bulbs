import type { Data } from '../types';
import { bridgeTv, TvClient } from './bridgeTv';

export type { TvClient };
/** En el navegador no se puede hablar con la tele: siempre por el puente de casa. */
export const tvClient = (_tv: Data['tv']): TvClient => bridgeTv();
