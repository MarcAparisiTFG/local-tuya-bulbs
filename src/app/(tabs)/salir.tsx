import { useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertsBar, Appear, ClockSun, FuelCard, PowerCard, SeaCard, WeatherCard } from '../../components/home/HomeCards';
import { PlacesStrip } from '../../components/PlacesStrip';
import { Pad, Screen } from '../../components/ui';
import { FLOAT, T } from '../../theme';
import { useTrips } from '../../useTrips';
import { useDashboard } from '../../dashboard/useDashboard';

/** Lo que se mira un momento antes de salir de casa: el sol, el tiempo, cuánto se tarda, el mar, la luz y la gasolina. */
export default function Salir() {
  const dash = useDashboard();
  const trips = useTrips();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  // pide el tráfico de ahora mismo y vuelve a mirar el resto de datos
  const refresh = async () => {
    setLoading(true);
    trips.refresh(true);
    await dash.reload();
    setLoading(false);
  };
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  // a lo grande en la tablet; en el móvil, algo más que en el inicio pero sin salirse
  const k = wide ? 1.6 : 1.15;
  return (
    <View style={{ flex: 1 }}>
    <Screen>
      <Pad style={{ gap: 10 }}>
        {dash.alerts.length > 0 && (
          <Appear>
            <AlertsBar alerts={dash.alerts} />
          </Appear>
        )}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10 }}>
          <Appear delay={0} style={{ flex: wide ? 1 : undefined }}>
            <ClockSun big={k} sunrise={dash.weather?.sunrise} sunset={dash.weather?.sunset} style={{ flex: 1 }} />
          </Appear>
          <Appear delay={90} style={{ flex: wide ? 1.5 : undefined }}>
            <WeatherCard big={k} w={dash.weather} style={{ flex: 1 }} />
          </Appear>
        </View>
        <Appear delay={180}>
          <PlacesStrip scale={wide ? 1.25 : 1} wide={wide} data={trips} />
        </Appear>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Appear delay={270} style={{ flexBasis: wide ? 0 : '100%', flexGrow: 1 }}>
            <SeaCard big={k} sea={dash.sea} w={dash.weather} style={{ flex: 1 }} />
          </Appear>
          <Appear delay={330} style={{ flexBasis: wide ? 0 : '100%', flexGrow: 1 }}>
            <PowerCard big={k} power={dash.power} energy={dash.energy} style={{ flex: 1 }} />
          </Appear>
          <Appear delay={390} style={{ flexBasis: wide ? 0 : '100%', flexGrow: 1 }}>
            <FuelCard big={k} fuel={dash.fuel} style={{ flex: 1 }} />
          </Appear>
        </View>
      </Pad>
    </Screen>
      {/* actualizar, flotando arriba a la derecha (la pantalla no tiene cabecera) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Actualizar"
        onPress={refresh}
        disabled={loading}
        style={({ pressed }) => [{ position: 'absolute', top: insets.top + 6, right: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] }, FLOAT]}
      >
        {loading || trips.loading ? <ActivityIndicator color="#fff" size="small" /> : <MaterialCommunityIcons name="refresh" size={22} color="#fff" />}
      </Pressable>
    </View>
  );
}
