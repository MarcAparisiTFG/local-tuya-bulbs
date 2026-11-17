'use no memo';
import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';
import { HOME } from '../home';
import { OBJ, ObjKey } from '../objects';
import { mapsUrl, Trip, tripText } from '../places';
import type { Place } from '../types';
import type { Sky, Weather } from './weather';

// El widget de la tablet de la pared: el tiempo en casa, la semana y los modos a un toque.
// Los widgets de Android no son React Native: sólo estas piezas (FlexWidget, TextWidget, ImageWidget).

const C = { bg: '#F4F0FA', card: '#FFFFFF', ink: '#17131F', soft: '#6E6680', accent: '#5B2EC4', lavender: '#E6DDF7' } as const;
const F = { medium: 'Urbanist_500Medium', semi: 'Urbanist_600SemiBold', bold: 'Urbanist_700Bold', black: 'Urbanist_800ExtraBold' };

const SKY: Record<Sky, number> = {
  sun: require('../../assets/weather/sun.png'),
  moon: require('../../assets/weather/moon.png'),
  'sun-cloud': require('../../assets/weather/sun-cloud.png'),
  cloud: require('../../assets/weather/cloud.png'),
  fog: require('../../assets/weather/fog.png'),
  'sun-rain': require('../../assets/weather/sun-rain.png'),
  rain: require('../../assets/weather/rain.png'),
  storm: require('../../assets/weather/storm.png'),
  snow: require('../../assets/weather/snow.png'),
};

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const dayName = (iso: string) => DAYS[new Date(`${iso}T12:00:00`).getDay()];
const hhmm = (t: number) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: HOME.timeZone });

export type WidgetMode = { id: string; name: string; icon: string };
export type WidgetPlace = { place: Place; trip: Trip | null };
export type HomeWidgetProps = {
  weather: Weather | null;
  modes: WidgetMode[];
  active: string[];
  places: WidgetPlace[];
  /** con el puente de casa, el modo se pone sin abrir la app; sin él, se abre la app en ese modo */
  hub: boolean;
  width: number;
};

function Today({ w }: { w: Weather }) {
  return (
    <FlexWidget style={{ backgroundColor: C.card, borderRadius: 24, padding: 16, width: 'match_parent', height: 'match_parent' }} clickAction="REFRESH">
      <TextWidget text={w.place} style={{ fontFamily: F.semi, fontSize: 14, color: C.soft }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <ImageWidget image={SKY[w.now.sky] as never} imageWidth={64} imageHeight={64} />
        <TextWidget text={`${w.now.temp}°`} style={{ fontFamily: F.black, fontSize: 48, color: C.ink, marginLeft: 8 }} />
      </FlexWidget>
      <TextWidget text={w.now.word} style={{ fontFamily: F.bold, fontSize: 16, color: C.ink, marginTop: 4 }} />
      <TextWidget
        text={`${w.today.max}° / ${w.today.min}°${w.today.rain >= 20 ? ` · lluvia ${w.today.rain}%` : ''}`}
        style={{ fontFamily: F.medium, fontSize: 14, color: C.soft, marginTop: 2 }}
      />
    </FlexWidget>
  );
}

function Week({ w }: { w: Weather }) {
  return (
    <FlexWidget style={{ backgroundColor: C.card, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: 'match_parent', height: 'match_parent' }} clickAction="REFRESH">
      {w.week.map((d) => (
        <FlexWidget key={d.date} style={{ alignItems: 'center' }}>
          <TextWidget text={dayName(d.date)} style={{ fontFamily: F.semi, fontSize: 13, color: C.soft }} />
          <ImageWidget image={SKY[d.sky] as never} imageWidth={34} imageHeight={34} style={{ marginVertical: 6 }} />
          <TextWidget text={`${d.max}°`} style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }} />
          <TextWidget text={`${d.min}°`} style={{ fontFamily: F.medium, fontSize: 13, color: C.soft }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

function ModeButton({ m, on, hub }: { m: WidgetMode; on: boolean; hub: boolean }) {
  const icon = (m.icon in OBJ ? m.icon : 'bulb') as ObjKey;
  const click = hub ? { clickAction: 'MODE', clickActionData: { id: m.id } } : { clickAction: 'OPEN_URI', clickActionData: { uri: `marsianapp://modo/${m.id}` } };
  return (
    <FlexWidget style={{ alignItems: 'center', width: 76 }} {...click} accessibilityLabel={`Modo ${m.name}${on ? ', puesto' : ''}`}>
      {/* puesto: aro negro, como en la app */}
      <FlexWidget
        style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: on ? C.lavender : C.card, borderWidth: 3, borderColor: on ? C.ink : C.card, alignItems: 'center', justifyContent: 'center' }}
      >
        <ImageWidget image={OBJ[icon] as never} imageWidth={36} imageHeight={36} />
      </FlexWidget>
      <TextWidget text={m.name} maxLines={1} truncate="END" style={{ fontFamily: on ? F.bold : F.semi, fontSize: 12, color: on ? C.ink : C.soft, marginTop: 4 }} />
    </FlexWidget>
  );
}

const CAR = require('../../assets/weather/car.png');

function PlaceChip({ p }: { p: WidgetPlace }) {
  return (
    <FlexWidget
      style={{ flex: 1, backgroundColor: C.card, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: mapsUrl(p.place) }}
      accessibilityLabel={`${p.place.name}${p.trip ? `, ${tripText(p.trip)} en coche` : ''}`}
    >
      <ImageWidget image={CAR as never} imageWidth={30} imageHeight={30} />
      <FlexWidget style={{ flex: 1, marginLeft: 10 }}>
        <TextWidget text={p.place.name} maxLines={1} truncate="END" style={{ fontFamily: F.semi, fontSize: 13, color: C.soft }} />
        <TextWidget text={p.trip ? tripText(p.trip) : '—'} style={{ fontFamily: F.black, fontSize: 20, color: C.ink }} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function HomeWidget({ weather, modes, active, places, hub, width }: HomeWidgetProps) {
  const fit = Math.max(1, Math.floor((width - 32) / 80));
  return (
    <FlexWidget style={{ backgroundColor: C.bg, borderRadius: 28, padding: 16, width: 'match_parent', height: 'match_parent' }}>
      <FlexWidget style={{ flexDirection: 'row', flex: 1, width: 'match_parent' }}>
        {/* sin fragmentos: el árbol del widget sólo admite sus propias piezas */}
        {weather && (
          <FlexWidget style={{ flex: 2, height: 'match_parent' }}>
            <Today w={weather} />
          </FlexWidget>
        )}
        {weather && (
          <FlexWidget style={{ flex: 5, height: 'match_parent', marginLeft: 12 }}>
            <Week w={weather} />
          </FlexWidget>
        )}
        {!weather && (
          <FlexWidget style={{ backgroundColor: C.card, borderRadius: 24, padding: 16, width: 'match_parent', height: 'match_parent', justifyContent: 'center' }} clickAction="REFRESH">
            <TextWidget text="Sin datos del tiempo · toca para reintentar" style={{ fontFamily: F.semi, fontSize: 15, color: C.soft }} />
          </FlexWidget>
        )}
      </FlexWidget>

      {/* en coche a vuestros sitios: tocar uno abre la ruta en Google Maps */}
      {places.length > 0 && (
        <FlexWidget style={{ flexDirection: 'row', marginTop: 12, width: 'match_parent' }}>
          {places.slice(0, 4).map((p) => (
            <PlaceChip key={p.place.id} p={p} />
          ))}
        </FlexWidget>
      )}

      <FlexWidget style={{ flexDirection: 'row', marginTop: 14, width: 'match_parent', justifyContent: 'space-between', alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row' }}>
          {modes.slice(0, fit).map((m) => (
            <ModeButton key={m.id} m={m} on={active.includes(m.id)} hub={hub} />
          ))}
        </FlexWidget>
      </FlexWidget>
      {weather && (
        <TextWidget text={`Actualizado a las ${hhmm(weather.at)}`} style={{ fontFamily: F.medium, fontSize: 11, color: C.soft, marginTop: 6 }} clickAction="REFRESH" />
      )}
    </FlexWidget>
  );
}
