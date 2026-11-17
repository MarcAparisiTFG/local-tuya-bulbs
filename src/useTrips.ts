import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { loadTrips, Shape, Trip } from './places';
import { useApp } from './state';
import { getBridgeUrl, getMode } from './tuya/mode';

/**
 * Los tiempos en coche a vuestros sitios, para el inicio y la pestaña Sitios. Se piden al puente de casa siempre que
 * se sepa dónde está (aunque la app haya arrancado sin él): es quien tiene el tráfico. Mirar es gratis: el puente
 * decide cuándo preguntar de verdad a TomTom.
 */
export function useTrips() {
  const { data, setMapKey } = useApp();
  const places = data.places ?? [];
  const [trips, setTrips] = useState<Record<string, Trip | null>>({});
  const [shapes, setShapes] = useState<Record<string, Shape>>({});
  const [loading, setLoading] = useState(false);
  const hub = getMode() === 'bridge' ? getBridgeUrl() : data.hub ? `http://${data.hub}:8787` : undefined;

  const ids = places.map((p) => `${p.id}@${p.lat},${p.lon}`).join('|');
  const refresh = useCallback(
    (fresh = false) => {
      if (!places.length) return;
      setLoading(fresh);
      loadTrips(places, hub, fresh)
        .then((v) => {
          setTrips(v.trips);
          setShapes(v.shapes);
          if (v.mapKey) setMapKey(v.mapKey);
        })
        .finally(() => setLoading(false));
    },
    [ids, hub],
  );
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  useEffect(() => {
    const t = setInterval(() => refresh(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const withTraffic = Object.values(trips).some((t) => t?.traffic);
  const at = Math.min(...Object.values(trips).map((t) => t?.at ?? Infinity));
  const ago = Number.isFinite(at) ? Math.round((Date.now() - at) / 60000) : null;
  return { places, trips, shapes, mapKey: data.mapKey ?? null, loading, refresh, hub, withTraffic, ago };
}
