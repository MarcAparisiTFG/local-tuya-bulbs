import { router } from 'expo-router';
import { Image, ScrollView, View } from 'react-native';
import { ROUTE_COLORS } from '../mapPage';
import { tripText } from '../places';
import { T } from '../theme';
import { useTrips } from '../useTrips';
import { Kpi } from './home/Kpi';

/** Cuánto se tarda ahora a cada sitio, como tarjetas-dato. Tocar una abre el mapa. */
export function PlacesStrip({ wide, scale = 1, data }: { wide: boolean; scale?: number; data?: ReturnType<typeof useTrips> }) {
  const own = useTrips();
  // si la pantalla ya tiene los tiempos (para poder actualizarlos desde ella), usa esos
  const { places, trips } = data ?? own;
  if (!places.length) return null;
  const chips = places.map((p, i) => {
    const t = trips[p.id];
    const jam = !!t?.delay && t.delay >= 2;
    return (
      <Kpi
        key={p.id}
        flex={wide}
        scale={scale}
        // su logo, o el color de su ruta en el mapa si no tiene
        icon={
          p.logo ? (
            <Image source={{ uri: p.logo }} style={{ width: 16 * scale, height: 16 * scale, borderRadius: 4 }} resizeMode="contain" />
          ) : (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
          )
        }
        label={p.name}
        value={t ? tripText(t) : '…'}
        sub={t ? (jam ? `+${t.delay} min de atasco` : t.traffic ? 'sin atascos' : `${t.km} km`) : undefined}
        subColor={jam ? T.warn : T.inkSoft}
        a11y={`${p.name}${t ? `, ${tripText(t)} en coche` : ''}. Abre el mapa`}
        onPress={() => router.navigate('/places')}
      />
    );
  });
  // en la tablet caben todos a lo ancho; en el móvil, se desplazan
  if (wide) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {chips}
    </ScrollView>
  );
}
