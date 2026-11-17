import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Input } from 'panelui-native';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteMap } from '../../components/RouteMap';
import { Txt } from '../../components/Txt';
import { PillButton } from '../../components/ui';
import { ROUTE_COLORS } from '../../mapPage';
import { Found, mapsUrl, searchPlaces, Trip, tripText } from '../../places';
import { useApp } from '../../state';
import { FLOAT, T } from '../../theme';
import { Place } from '../../types';
import { useTrips } from '../../useTrips';

// lo que tapan los paneles: arriba la cabecera; abajo las tarjetas y la barra de pestañas
const TOP_PANEL = 60;
const BOTTOM_PANEL = 210;

/** El mapa a pantalla completa con la ruta a cada sitio; encima, flotando, la cabecera y los tiempos. */
export default function Places() {
  const insets = useSafeAreaInsets();
  const { addPlace, removePlace } = useApp();
  const { places, trips, shapes, mapKey, loading, refresh } = useTrips();
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState('');

  const color = (i: number) => ROUTE_COLORS[i % ROUTE_COLORS.length];
  const routes = places.map((p, i) => ({ name: p.name, lat: p.lat, lon: p.lon, shape: shapes[p.id], color: color(i), label: trips[p.id] ? tripText(trips[p.id]!) : '…', logo: p.logo }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <RouteMap routes={routes} tomtomKey={mapKey} pad={{ top: insets.top + TOP_PANEL + 30, bottom: insets.bottom + BOTTOM_PANEL + 20 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* cabecera flotante */}
      <View style={[{ position: 'absolute', top: insets.top + 12, right: 16, backgroundColor: T.surface, borderRadius: 30, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }, FLOAT]}>
        {/* pedir el tráfico de ahora mismo (TomTom tiene un límite diario: el resto del tiempo va solo y con calma) */}
        {places.length > 0 && <PillButton text="Actualizar" icon="refresh" kind="secondary" loading={loading} onPress={() => refresh(true)} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={adding ? 'Cerrar' : 'Añadir un sitio'}
          onPress={() => setAdding(!adding)}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          <MaterialCommunityIcons name={adding ? 'close' : 'plus'} size={24} color="#fff" />
        </Pressable>
      </View>

      {adding && <AddPlace top={insets.top + TOP_PANEL + 20} onAdd={(f) => (addPlace({ name: f.name, detail: f.detail, lat: f.lat, lon: f.lon }), setAdding(false))} />}

      {/* los tiempos, flotando sobre el mapa, encima de la barra de pestañas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 96 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}
      >
        {places.length === 0 && (
          <View style={[{ backgroundColor: T.surface, borderRadius: 24, padding: 18 }, FLOAT]}>
            <Txt w="bold" size={16}>
              Añade vuestros sitios con el +
            </Txt>
          </View>
        )}
        {places.map((p, i) => (
          <PlaceCard
            key={p.id}
            p={p}
            color={color(i)}
            trip={trips[p.id]}
            confirming={confirm === p.id}
            onLongPress={() => setConfirm(confirm === p.id ? '' : p.id)}
            onRemove={() => {
              removePlace(p.id);
              setConfirm('');
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function AddPlace({ top, onAdd }: { top: number; onAdd: (f: Found) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  // busca mientras se escribe, con un respiro para no preguntar a cada letra
  useEffect(() => {
    const t = setTimeout(() => searchPlaces(q).then(setFound).catch(() => setFound([])), 400);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <View style={[{ position: 'absolute', top, left: 16, right: 16, maxWidth: 560, backgroundColor: T.surface, borderRadius: 26, padding: 16, gap: 6 }, FLOAT]}>
      <Input label="Añadir un sitio" value={q} placeholder="Busca un lugar o una dirección" autoCorrect={false} autoFocus onChangeText={setQ} />
      {found.map((f, i) => (
        <Pressable
          key={`${f.lat},${f.lon},${i}`}
          accessibilityRole="button"
          accessibilityLabel={`Añadir ${f.name}`}
          onPress={() => onAdd(f)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.line, opacity: pressed ? 0.6 : 1 })}
        >
          <MaterialCommunityIcons name="map-marker-plus-outline" size={22} color={T.accent} />
          <View style={{ flex: 1 }}>
            <Txt w="semi" size={16} numberOfLines={1}>
              {f.name}
            </Txt>
            {!!f.detail && (
              <Txt size={13} color={T.inkSoft} numberOfLines={1}>
                {f.detail}
              </Txt>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function PlaceCard({ p, color, trip, confirming, onLongPress, onRemove }: { p: Place; color: string; trip: Trip | null | undefined; confirming: boolean; onLongPress: () => void; onRemove: () => void }) {
  const jam = !!trip?.delay && trip.delay >= 2;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.name}${trip ? `, ${tripText(trip)} en coche` : ''}. Mantén para quitarlo`}
      onPress={() => Linking.openURL(mapsUrl(p))}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [{ width: 210, backgroundColor: T.surface, borderRadius: 24, padding: 16, gap: 6, transform: [{ scale: pressed ? 0.97 : 1 }] }, FLOAT]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* el color de su ruta en el mapa */}
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        {!!p.logo && <Image source={{ uri: p.logo }} style={{ width: 24, height: 24, borderRadius: 6 }} resizeMode="contain" />}
        <Txt w="bold" size={16} numberOfLines={1} style={{ flex: 1 }}>
          {p.name}
        </Txt>
      </View>
      {confirming ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${p.name}`} onPress={onRemove} style={{ backgroundColor: T.danger, borderRadius: 18, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Txt w="bold" size={14} color="#fff">
            Quitar
          </Txt>
        </Pressable>
      ) : (
        <>
          <Txt w="black" size={30}>
            {trip ? tripText(trip) : trip === null ? '—' : '…'}
          </Txt>
          <Txt w={jam ? 'bold' : undefined} size={13} color={jam ? T.warn : T.inkSoft}>
            {trip ? (jam ? `+${trip.delay} min de atasco` : `${trip.km} km${trip.traffic ? ' · sin atascos' : ''}`) : ' '}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
