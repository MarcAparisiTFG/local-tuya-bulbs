import { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GAP, GUTTER } from '../theme';
import { Bulb, Plug } from '../types';
import { BulbTile } from './BulbTile';
import { PlugTile } from './PlugTile';

/** Ancho de la tarjeta: 2 columnas en móvil, 3 o 4 en tablet. */
export function useTileWidth() {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 1100) - GUTTER * 2;
  const cols = inner >= 860 ? 4 : inner >= 560 ? 3 : 2;
  return { inner, tileW: Math.floor((inner - GAP * (cols - 1)) / cols) };
}

export function BulbGrid({ bulbs, plugs = [], first }: { bulbs: Bulb[]; plugs?: Plug[]; first?: ReactNode }) {
  const { tileW } = useTileWidth();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {first}
      {bulbs.map((b) => (
        <BulbTile key={b.id} bulb={b} width={tileW} />
      ))}
      {plugs.map((p) => (
        <PlugTile key={p.id} plug={p} width={tileW} />
      ))}
    </View>
  );
}
