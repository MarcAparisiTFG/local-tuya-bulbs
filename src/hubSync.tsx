import { useEffect, useRef } from 'react';
import { useApp } from './state';
import { getBridgeUrl, getMode } from './tuya/mode';

const post = (hub: string, path: string, body: object) =>
  fetch(`${hub}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});

/**
 * Lo que comparten todos los aparatos a través del puente de casa: los modos (para HomeKit) y los sitios.
 * Los sitios se leen primero del puente: así la tablet y el iPhone tienen los mismos.
 */
export function HubSync() {
  const { data, setPlaces } = useApp();
  const scenes = JSON.stringify(data.scenes);
  const places = JSON.stringify(data.places ?? []);
  const pulled = useRef(false);
  // aunque la app haya arrancado sin el puente, si sabe dónde está lo intenta
  const hub = getMode() === 'bridge' ? getBridgeUrl() : data.hub ? `http://${data.hub}:8787` : null;

  useEffect(() => {
    if (!hub) return;
    // un momento de margen: al editar un modo, cada letra cambia la lista
    const t = setTimeout(() => post(hub, '/modes', { scenes: data.scenes }), 800);
    return () => clearTimeout(t);
  }, [scenes]);

  useEffect(() => {
    if (!hub) return;
    fetch(`${hub}/places`)
      .then((r) => r.json())
      .then((j) => {
        if (j.places?.length) setPlaces(j.places);
        else if (data.places?.length) post(hub, '/places', { places: data.places });
      })
      .catch(() => {})
      .finally(() => (pulled.current = true));
  }, []);

  useEffect(() => {
    if (!hub || !pulled.current) return;
    post(hub, '/places', { places: data.places ?? [] });
  }, [places]);

  return null;
}
