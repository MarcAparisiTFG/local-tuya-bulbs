import * as AppIntents from 'expo-app-intents';
import { useEffect, useRef } from 'react';
import { sceneActive, sceneTargets, useBulbs } from './bulbs';
import { useApp } from './state';
import { Bulb } from './types';

/**
 * Siri en el iPhone (app-intents/*.swift): le cuenta qué modos hay y hace lo que Siri le deja encargado.
 * «Oye Siri, pon Chimenea en MarsianApp» abre la app y el encargo llega aquí. En Android y web no hace nada.
 */
export function SiriBridge() {
  const app = useApp();
  const api = useBulbs();
  const latest = useRef(app);
  latest.current = app;

  // los nombres de los modos, para que Siri los entienda; se vuelve a mandar cuando cambian
  const catalog = app.data.scenes.map((s) => `${s.id}:${s.name}`).join('|');
  useEffect(() => {
    if (!AppIntents.isAvailable()) return;
    AppIntents.setEntityCatalogAsync(
      'modo',
      app.data.scenes.map((s) => ({ id: s.id, title: s.name, synonyms: [`modo ${s.name}`, `la ${s.name}`, `el ${s.name}`] })),
    ).catch(() => {});
  }, [catalog]);

  // recién abierta, las bombillas tardan un momento en contestar; sin su estado no se sabe qué hay puesto
  const settled = async (bulbs: Bulb[]) => {
    for (let t = 0; t < 25 && bulbs.some((b) => api.live(b.id).state === 'loading'); t++) await new Promise((r) => setTimeout(r, 200));
  };

  AppIntents.useAppIntents(async (pending) => {
    for (const inv of pending) {
      const { data, flash } = latest.current;
      try {
        if (inv.name === 'luces') {
          await api.setPower(data.bulbs, inv.params.on === true);
        } else if (inv.name === 'ponerModo' || inv.name === 'quitarModo') {
          const scene = data.scenes.find((s) => s.id === inv.params.modoId);
          if (!scene) flash('Ese modo ya no existe');
          else {
            const targets = sceneTargets(scene, data.bulbs);
            await settled(targets);
            const on = sceneActive(scene, data.bulbs, api.live);
            // poner y quitar en vez de alternar: repetir la orden no deshace lo hecho
            if (inv.name === 'ponerModo' ? !on : on) await api.toggleScene(scene);
            else flash(inv.name === 'ponerModo' ? `${scene.name} ya está puesto` : `${scene.name} no estaba puesto`);
          }
        }
        // también lo desconocido (de una versión anterior): si no, se quedaría esperando para siempre
        await AppIntents.removePendingInvocationAsync(inv.id);
      } catch (e) {
        console.warn('Siri: el encargo queda pendiente', inv.id, e);
      }
    }
  });

  return null;
}
