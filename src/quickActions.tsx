import * as QuickActions from 'expo-quick-actions';
import { RouterAction, useQuickActionRouting } from 'expo-quick-actions/router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useApp } from './state';

/**
 * Un atajo por modo al mantener el icono de la app (Android y iPhone). En la tablet se pueden anclar a la
 * pantalla de inicio y Bixby los abre por su nombre. Cada uno abre marsianapp://modo/<id>.
 */
export function ModeShortcuts() {
  const { data } = useApp();
  useQuickActionRouting();

  const list = data.scenes.map((s) => `${s.id}:${s.name}:${s.icon}`).join('|');
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const max = QuickActions.maxCount ?? 4;
    QuickActions.setItems<RouterAction>(
      data.scenes.slice(0, max).map((s) => ({
        id: s.id,
        title: s.name,
        // los dibujos de cada modo (app.json → expo-quick-actions); el de «apagar» es la bombilla
        icon: Platform.OS === 'android' ? `modo_${s.icon === 'off' ? 'bulb' : s.icon}` : 'symbol:sparkles',
        params: { href: `/modo/${s.id}` },
      })),
    ).catch(() => {});
  }, [list]);

  return null;
}
