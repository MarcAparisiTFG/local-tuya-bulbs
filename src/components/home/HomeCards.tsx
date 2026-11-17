import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Alert, Fuel, Power, Sea, Weather } from '../../dashboard/sources';
import type { Sky } from '../../dashboard/sky';
import { HOME } from '../../home';
import { T } from '../../theme';
import { Txt } from '../Txt';
import { Kpi } from './Kpi';

// Las tarjetas del inicio de la tablet: datos de un vistazo, con movimiento suave (entran escalonadas, los números
// cuentan hasta su valor, el sol recorre su arco, las olas se mueven).

const SKY: Record<Sky, number> = {
  sun: require('../../../assets/weather/sun.png'),
  moon: require('../../../assets/weather/moon.png'),
  'sun-cloud': require('../../../assets/weather/sun-cloud.png'),
  cloud: require('../../../assets/weather/cloud.png'),
  fog: require('../../../assets/weather/fog.png'),
  'sun-rain': require('../../../assets/weather/sun-rain.png'),
  rain: require('../../../assets/weather/rain.png'),
  storm: require('../../../assets/weather/storm.png'),
  snow: require('../../../assets/weather/snow.png'),
};
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const inHours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);
const num = (n: number, d = 0) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Entra subiendo y apareciendo; `delay` para que las tarjetas lleguen una detrás de otra. */
export function Appear({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** Un número que cuenta hasta su valor cuando llega o cambia. */
function Count({ value, decimals = 0, suffix = '', size, w = 'black', color }: { value: number; decimals?: number; suffix?: string; size: number; w?: 'black' | 'bold'; color?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * e);
      if (k === 1) {
        clearInterval(id);
        from.current = value;
      }
    }, 30);
    return () => clearInterval(id);
  }, [value]);
  return (
    <Txt w={w} size={size} color={color}>
      {num(shown, decimals)}
      {suffix}
    </Txt>
  );
}

const card = { backgroundColor: T.surface, borderRadius: 24, padding: 16 } as const;
/** `big`: en su propia pantalla, a lo grande; en el inicio, pequeño */
const zoom = (big?: boolean | number) => (n: number) => Math.round(n * (typeof big === 'number' ? big : big ? 1.6 : 1));
// las de datos (mar, luz, gasolina) son secundarias: lo principal del inicio son las luces
const small = { backgroundColor: T.surface, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 } as const;

function Title({ icon, text, color = T.inkSoft, big }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; color?: string; big?: boolean | number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <MaterialCommunityIcons name={icon} size={big ? 18 : 14} color={color} />
      <Txt w="semi" size={big ? 15 : 12} color={color}>
        {text}
      </Txt>
    </View>
  );
}

// ——— El resumen de arriba del inicio ———

/** Tres datos para el día: el tiempo, cuándo anochece (o amanece) y la luz. Tocarlos abre «Para salir». */
export function SummaryKpis({ dash, onPress }: { dash: { weather: Weather | null; power: Power | null }; onPress: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const w = dash.weather;
  const nowMin = toMin(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: HOME.timeZone }));
  const day = w ? nowMin >= toMin(w.sunrise) && nowMin < toMin(w.sunset) : true;
  const p = dash.power;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Kpi
        flex
        onPress={onPress}
        icon={w ? <Image source={SKY[w.sky]} style={{ width: 18, height: 18 }} /> : undefined}
        label={w ? w.word : 'El tiempo'}
        value={w ? `${w.temp}°` : '…'}
        sub={w ? `${w.max}° / ${w.min}°${w.rain >= 30 ? ` · lluvia ${w.rain}%` : ''}` : undefined}
      />
      <Kpi
        flex
        onPress={onPress}
        icon={<Txt size={14} color={day ? '#C2860A' : T.accent}>{day ? '☾' : '☀︎'}</Txt>}
        label={day ? 'Anochece' : 'Amanece'}
        value={w ? (day ? w.sunset : w.sunrise) : '…'}
        sub={w ? `en ${inHours(day ? toMin(w.sunset) - nowMin : (toMin(w.sunrise) - nowMin + 1440) % 1440)}` : undefined}
      />
      <Kpi
        flex
        onPress={onPress}
        icon={<MaterialCommunityIcons name="flash" size={15} color="#C2860A" />}
        label="Luz ahora"
        value={p?.now != null ? `${num(p.now, 3)} €` : '…'}
        sub={p?.cheapest ? `mejor a las ${String(p.cheapest.h).padStart(2, '0')}:00` : undefined}
        subColor="#1E8A50"
      />
    </View>
  );
}

// ——— Hora y sol ———


export function ClockSun({ sunrise, sunset, style, big }: { sunrise?: string; sunset?: string; style?: StyleProp<ViewStyle>; big?: boolean | number }) {
  const z = zoom(big);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: HOME.timeZone });
  const d0 = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: HOME.timeZone }).replace(/\./g, '');
  const date = d0.charAt(0).toUpperCase() + d0.slice(1);
  const nowMin = toMin(time);
  const rise = sunrise ? toMin(sunrise) : 0;
  const set = sunset ? toMin(sunset) : 0;
  const day = sunrise && sunset && nowMin >= rise && nowMin < set;
  // dónde va el sol en su arco (de día) o la luna (de noche)
  const k = !sunrise || !sunset ? 0.5 : day ? (nowMin - rise) / (set - rise) : ((nowMin - set + 1440) % 1440) / (1440 - (set - rise));
  const W = z(150);
  const H = z(40);
  const angle = Math.PI * (1 - k);
  const x = W / 2 + (W / 2 - 12) * Math.cos(angle);
  const y = H - (H - 12) * Math.sin(angle);
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: false }), Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: false })])).start();
  }, []);
  const next = !sunrise || !sunset ? '' : day ? `Anochece en ${inHours(set - nowMin)}` : `Amanece en ${inHours((rise - nowMin + 1440) % 1440)}`;
  return (
    <View style={[big ? card : small, { gap: 2, flexDirection: big ? 'column' : 'row', alignItems: big ? 'stretch' : 'center' }, style]}>
      <View style={{ flex: 1 }}>
      <Txt w="black" size={z(30)} style={{ lineHeight: z(34) }}>
        {time}
      </Txt>
      <Txt w="semi" size={z(12)} color={T.inkSoft} numberOfLines={1}>
        {date}
      </Txt>
      </View>
      {!!sunrise && !!sunset && (
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: W, height: H + 6 }}>
          <Svg width={W} height={H + 6}>
            <Defs>
              <LinearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#F7B267" />
                <Stop offset="0.5" stopColor="#F5D06F" />
                <Stop offset="1" stopColor="#8E7CF0" />
              </LinearGradient>
            </Defs>
            <Path d={`M 12 ${H} A ${W / 2 - 12} ${H - 12} 0 0 1 ${W - 12} ${H}`} stroke={day ? 'url(#arc)' : '#CFC6E6'} strokeWidth={3} strokeDasharray="4 6" fill="none" />
            <Circle cx={x} cy={y} r={z(day ? 7 : 6)} fill={day ? '#F5B100' : '#8E7CF0'} />
          </Svg>
          {/* el halo del sol, que respira */}
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', left: x - z(12), top: y - z(12), width: z(24), height: z(24), borderRadius: z(12), backgroundColor: day ? '#F5B100' : '#8E7CF0', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] }) }}
          />
          </View>
          <View style={{ width: W, flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 }}>
            <Txt w="bold" size={z(11)}>
              ☀︎ {sunrise}
            </Txt>
            <Txt w="bold" size={z(11)}>
              {sunset} ☾
            </Txt>
          </View>
          <Txt w="semi" size={z(11)} color={T.accent}>
            {next}
          </Txt>
        </View>
      )}
    </View>
  );
}

// ——— El tiempo ———

function Bob({ children }: { children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true })])).start();
  }, []);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}>{children}</Animated.View>;
}

export function WeatherCard({ w, style, big }: { w: Weather | null; style?: StyleProp<ViewStyle>; big?: boolean | number }) {
  const z = zoom(big);
  if (!w) return <View style={[small, { justifyContent: 'center' }, style]}><Txt size={z(12)} color={T.inkSoft}>Cargando el tiempo…</Txt></View>;
  return (
    <View style={[big ? card : small, { gap: z(6) }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Bob>
          <Image source={SKY[w.sky]} style={{ width: z(38), height: z(38) }} />
        </Bob>
        <Count value={w.temp} suffix="°" size={z(28)} />
        <View style={{ flex: 1 }}>
          <Txt w="bold" size={z(13)} numberOfLines={1}>
            {w.word} · {HOME.name}
          </Txt>
          <Txt size={z(11)} color={T.inkSoft} numberOfLines={1}>
            {w.max}° / {w.min}° · UV {w.uv}
            {w.rain >= 20 ? ` · lluvia ${w.rain}%` : ''}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {w.week.map((d) => (
          <View key={d.date} style={{ alignItems: 'center' }}>
            <Txt w="semi" size={z(10)} color={T.inkSoft}>
              {DAYS[new Date(`${d.date}T12:00:00`).getDay()]}
            </Txt>
            <Image source={SKY[d.sky]} style={{ width: z(18), height: z(18) }} />
            <Txt w="bold" size={z(11)}>
              {d.max}°<Txt size={z(10)} color={T.inkSoft}> {d.min}°</Txt>
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

// ——— Avisos ———

const ALERT_BG = { yellow: '#FFF3C4', orange: '#FFE1C7', red: '#FFD3D3' } as const;
const ALERT_FG = { yellow: '#8A6400', orange: '#A04500', red: '#A31616' } as const;
const ALERT_WORD = { yellow: 'amarillo', orange: 'naranja', red: 'rojo' } as const;

export function AlertsBar({ alerts }: { alerts: Alert[] }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true })])).start();
  }, []);
  if (!alerts.length) return null;
  const worst = alerts.find((a) => a.level === 'red') ?? alerts.find((a) => a.level === 'orange') ?? alerts[0];
  const events = [...new Set(alerts.filter((a) => a.level === worst.level).map((a) => a.event))].join(', ');
  return (
    <View style={{ backgroundColor: ALERT_BG[worst.level], borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Animated.View style={{ opacity: pulse }}>
        <MaterialCommunityIcons name="alert" size={16} color={ALERT_FG[worst.level]} />
      </Animated.View>
      <Txt w="bold" size={12} color={ALERT_FG[worst.level]} style={{ flex: 1 }} numberOfLines={1}>
        Aviso {ALERT_WORD[worst.level]} en {HOME.alerts.label}: {events}
      </Txt>
    </View>
  );
}

// ——— El mar ———

function Waves({ height }: { height: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  const wave = (y: number) => {
    let d = `M 0 ${y}`;
    for (let x = 0; x < 480; x += 40) d += ` q 10 -6 20 0 t 20 0`;
    return d + ` V 40 H 0 Z`;
  };
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
      <Animated.View style={{ width: 480, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }] }}>
        <Svg width={480} height={height}>
          <Path d={wave(12)} fill="#CFE6FF" />
          <Path d={wave(20)} fill="#A9D2FB" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function SeaCard({ sea, w, style, big }: { sea: Sea | null; w: Weather | null; style?: StyleProp<ViewStyle>; big?: boolean | number }) {
  const z = zoom(big);
  return (
    <View style={[big ? card : small, { paddingBottom: z(14), gap: z(1), overflow: 'hidden' }, style]}>
      <Title icon="waves" text={`Mar en ${HOME.name}`} color="#2F6FED" big={big} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        {sea?.water != null ? <Count value={sea.water} decimals={1} suffix="°" size={z(18)} /> : <Txt w="black" size={z(18)}>—</Txt>}
        <Txt size={z(12)} color={T.inkSoft}>
          olas {sea?.waves != null ? `${num(sea.waves, 1)} m` : '—'}
        </Txt>
      </View>
      {w && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {/* la flecha apunta hacia donde va el viento */}
          <MaterialCommunityIcons name="navigation" size={z(12)} color={T.ink} style={{ transform: [{ rotate: `${(w.windDir + 180) % 360}deg` }] }} />
          <Txt size={z(12)} color={T.inkSoft} numberOfLines={1}>
            {w.wind} km/h · rachas {w.gusts}
          </Txt>
        </View>
      )}
      <Waves height={z(10)} />
    </View>
  );
}

// ——— La luz ———

function Bars({ power, height = 12 }: { power: Power; height?: number }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [power.hours.length]);
  const max = Math.max(...power.hours.map((h) => h.price), 0.001);
  const nowH = Number(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', hour12: false, timeZone: HOME.timeZone }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }}>
      {power.hours.map((h) => (
        <Animated.View
          key={h.h}
          style={{
            flex: 1,
            borderRadius: 2,
            height: grow.interpolate({ inputRange: [0, 1], outputRange: [2, Math.max(2, (h.price / max) * height)] }),
            backgroundColor: h.h === nowH ? T.ink : h.h === power.cheapest?.h ? '#2FB36B' : h.h < nowH ? '#E2DCEC' : '#C9B8F2',
          }}
        />
      ))}
    </View>
  );
}

export function PowerCard({ power, energy, style, big }: { power: Power | null; energy: { watts: number; kwh: number; euros: number } | null; style?: StyleProp<ViewStyle>; big?: boolean | number }) {
  const z = zoom(big);
  return (
    <View style={[big ? card : small, { gap: z(3) }, style]}>
      <Title icon="flash" text="Luz ahora" color="#C2860A" big={big} />
      {power?.now != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Count value={power.now} decimals={3} size={z(18)} />
          <Txt w="semi" size={z(12)} color={T.inkSoft}>
            €/kWh
          </Txt>
          {power.cheapest && (
            <Txt w="semi" size={z(12)} color="#1E8A50" numberOfLines={1} style={{ flexShrink: 1 }}>
              · mejor a las {String(power.cheapest.h).padStart(2, '0')}:00
            </Txt>
          )}
        </View>
      ) : (
        <Txt w="black" size={z(18)}>—</Txt>
      )}
      {power && power.hours.length > 0 && <Bars power={power} height={z(12)} />}
      {energy && (
        <Txt size={z(11)} color={T.inkSoft} numberOfLines={1}>
          En casa {num(energy.watts, 1)} W · hoy {num(energy.kwh, 2)} kWh · {num(energy.euros, 2)} €
        </Txt>
      )}
    </View>
  );
}

// ——— Gasolina ———

export function FuelCard({ fuel, style, big }: { fuel: Fuel[]; style?: StyleProp<ViewStyle>; big?: boolean | number }) {
  const z = zoom(big);
  return (
    <View style={[big ? card : small, { gap: z(3) }, style]}>
      <Title icon="gas-station" text={`Más barata en ${HOME.fuelTown?.label ?? HOME.name}`} color="#C2368F" big={big} />
      {fuel.length === 0 && <Txt color={T.inkSoft}>—</Txt>}
      {fuel.map((f) => (
        <View key={f.kind} style={{ flexDirection: big ? 'column' : 'row', alignItems: big ? 'flex-start' : 'baseline', gap: big ? 0 : 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Count value={f.price} decimals={3} suffix=" €" size={z(15)} />
            <Txt w="bold" size={z(12)}>
              {f.kind === 'Gasolina 95' ? '95' : f.kind}
            </Txt>
          </View>
          <Txt size={z(11)} color={T.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
            {f.brand} · {f.place}
          </Txt>
        </View>
      ))}
    </View>
  );
}
