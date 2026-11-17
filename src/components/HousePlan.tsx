import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useId, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useBulbs, useLiveSelect } from '../bulbs';
import { lookCss, lookPastel } from '../look';
import { FURNITURE, PLAN_H, PLAN_W, planRoom, roomAt, ROOMS } from '../plan';
import { useApp } from '../state';
import { FLOAT, FONT, T } from '../theme';
import { Bulb, Plug } from '../types';
import { Txt } from './Txt';

const WALL = '#CFC6DE';
// hueco entre habitaciones (las paredes), en puntos
const GAP = 3;
// la bombilla en pantalla, en puntos
const DOT = 34;
// la bandeja de las que aún no están en el plano (sólo en el modo colocar)
const TRAY = 92;

type Box = { x: number; y: number; w: number; h: number };
/** Lo que se pone en el plano: una bombilla o una toma de enchufe */
type Thing = { id: string; name: string; room: string; pos?: { x: number; y: number }; plug?: Plug };

/**
 * La casa vista desde arriba, lo más grande que quepa en `width × height`. Si la pantalla es más alta que ancha,
 * el plano se gira 90° (la casa es apaisada) y los textos siguen derechos.
 * Tocar una luz la enciende o la apaga; mantenerla abre sus colores. Tocar una habitación, todas las suyas.
 * Con `editing`, las luces se arrastran a su sitio; soltarlas en una habitación las asigna a ella.
 * Las tomas de enchufe van igual (un cuadrado con su icono): tocarlas las enciende o apaga.
 */
export function HousePlan({ width, height, editing }: { width: number; height: number; editing: boolean }) {
  const { data, flash, upsertBulb, upsertPlug } = useApp();
  const { live, setPower, setPlugs } = useBulbs();
  const plugs = data.plugs ?? [];
  const things: Thing[] = [...data.bulbs, ...plugs.map((p) => ({ ...p, plug: p }))];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // sólo para redibujar cuando cambia algo que se ve en el plano
  useLiveSelect((get) =>
    data.bulbs
      .map((b) => {
        const l = get(b.id);
        return `${l.state}${l.look.on ? 1 : 0}${l.look.mode}${Math.round(l.look.hue)}${Math.round(l.look.sat)}${Math.round(l.look.brightness)}${Math.round(l.look.temp)}${l.fx ? 1 : 0}`;
      })
      .join('|') + plugs.map((p) => `${live(p.id).state}${live(p.id).look.on ? 1 : 0}`).join(''),
  );

  // ¿girado? el que dé el plano más grande
  const room = editing ? height - TRAY : height;
  const kFlat = Math.min(width / PLAN_W, room / PLAN_H);
  const kRot = Math.min(width / PLAN_H, room / PLAN_W);
  const rot = kRot > kFlat;
  const k = Math.max(kFlat, kRot);
  const planW = (rot ? PLAN_H : PLAN_W) * k;
  const planH = (rot ? PLAN_W : PLAN_H) * k;
  const left = (width - planW) / 2;

  // del plano (unidades del boceto) a la pantalla, y al revés
  const toScreen = (x: number, y: number) => (rot ? { x: left + (PLAN_H - y) * k, y: x * k } : { x: left + x * k, y: y * k });
  const toPlan = (sx: number, sy: number) => (rot ? { x: sy / k, y: PLAN_H - (sx - left) / k } : { x: (sx - left) / k, y: sy / k });
  const box = (r: { x: number; y: number; w: number; h: number }): Box => {
    const a = toScreen(r.x, r.y);
    const b = toScreen(r.x + r.w, r.y + r.h);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  };

  const lit = (b: Bulb) => live(b.id).state === 'ok' && live(b.id).look.on;
  const rooms = ROOMS.map((r) => ({ r, s: box(r), bulbs: data.bulbs.filter((b) => planRoom(b.room)?.id === r.id) }));
  const gid = (b: Bulb) => `${uid}g${b.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  // dónde va cada bombilla, en el plano: la posición que le hayan dado o, si no, en fila en su habitación
  const placeOf = (b: Thing) => {
    if (b.pos) return b.pos;
    const r = planRoom(b.room);
    if (!r) return undefined;
    const mates = things.filter((x) => !x.pos && planRoom(x.room)?.id === r.id);
    const i = mates.findIndex((x) => x.id === b.id);
    return { x: r.x + r.w / 2 + (i - (mates.length - 1) / 2) * 104, y: r.y + r.h / 2 + 34 };
  };
  const unplaced = things.filter((b) => !placeOf(b));
  const screenOf = (b: Thing) => {
    const p = placeOf(b);
    if (p) return toScreen(p.x, p.y);
    const i = unplaced.findIndex((x) => x.id === b.id);
    return { x: 40 + i * 76, y: planH + TRAY / 2 + 8 };
  };

  const drop = (b: Thing, sx: number, sy: number) => {
    const upsert = b.plug ? upsertPlug : upsertBulb;
    if (sy > planH + 4) {
      if (planRoom(b.room) || b.pos) flash(`${b.name}, quitada del plano`);
      return upsert({ id: b.id, room: '', pos: undefined });
    }
    const p = toPlan(sx, sy);
    const pos = { x: Math.max(30, Math.min(PLAN_W - 30, p.x)), y: Math.max(30, Math.min(PLAN_H - 30, p.y)) };
    const r = roomAt(pos.x, pos.y);
    upsert({ id: b.id, pos, room: r?.name ?? '' });
    if (r && r.name !== planRoom(b.room)?.name) flash(`${b.name} → ${r.name}`);
  };

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={planH} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          {rooms.map(({ r, s }) => (
            <ClipPath key={r.id} id={`${uid}c${r.id}`}>
              <Rect x={s.x + GAP} y={s.y + GAP} width={s.w - GAP * 2} height={s.h - GAP * 2} rx={12} />
            </ClipPath>
          ))}
          {data.bulbs.map((b) => (
            <RadialGradient key={b.id} id={gid(b)} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={lookCss(live(b.id).look)} stopOpacity={0.35 + (live(b.id).look.brightness / 100) * 0.5} />
              <Stop offset="1" stopColor={lookCss(live(b.id).look)} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        {/* las paredes son el hueco entre habitaciones */}
        <Rect x={left} y={0} width={planW} height={planH} rx={18} fill={WALL} />

        {rooms.map(({ r, s, bulbs }) => {
          const on = bulbs.filter(lit);
          const fill = on.length ? lookPastel(live(on[0].id).look) : bulbs.length ? T.off : '#F8F5FC';
          return (
            <G key={r.id}>
              <Rect x={s.x + GAP} y={s.y + GAP} width={s.w - GAP * 2} height={s.h - GAP * 2} rx={12} fill={fill} />
              <G clipPath={`url(#${uid}c${r.id})`}>
                {on.map((b) => {
                  const p = placeOf(b);
                  if (!p) return null;
                  const c = toScreen(p.x, p.y);
                  return <Circle key={b.id} cx={c.x} cy={c.y} r={Math.max(s.w, s.h) * 0.8} fill={`url(#${gid(b)})`} />;
                })}
              </G>
            </G>
          );
        })}

        {FURNITURE.map((f, i) => {
          const s = box(f);
          const tall = s.h > s.w;
          return (
            <G key={i}>
              <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={f.r * k} fill={f.name === 'Tele' ? T.ink : 'rgba(23, 19, 31, 0.08)'} />
              {f.name === 'Cama' &&
                [0, 1].map((n) => (
                  <Rect
                    key={n}
                    // las almohadas van en el cabecero: arriba en el plano, a la derecha si está girado
                    x={tall ? s.x + n * (s.w / 2) + 8 : rot ? s.x + s.w - 30 : s.x + 8 + n * (s.w / 2 - 4)}
                    y={tall ? s.y + 8 : rot ? s.y + 8 + n * (s.h / 2 - 4) : s.y + 8}
                    width={tall ? s.w / 2 - 16 : rot ? 22 : s.w / 2 - 12}
                    height={tall ? 22 : rot ? s.h / 2 - 12 : 22}
                    rx={7}
                    fill="rgba(255,255,255,0.8)"
                  />
                ))}
            </G>
          );
        })}

        {rooms.map(({ r, s, bulbs }) => {
          // con el plano girado, los nombres también van de lado, a lo largo de la habitación (si no, no caben)
          const along = rot ? s.h : s.w;
          const size = along < 90 ? 13 : 16;
          const line = (n: number) =>
            rot ? { x: s.x + s.w - 14 - n * 18 - size * 0.75, y: s.y + 12, transform: undefined as string | undefined } : { x: s.x + 12, y: s.y + 24 + n * 18 };
          const t0 = line(0);
          const t1 = line(1);
          return (
            <G key={r.id}>
              <SvgText x={t0.x} y={t0.y} transform={rot ? `rotate(90 ${t0.x} ${t0.y})` : undefined} fontSize={size} fontFamily={FONT.bold} fill={T.ink}>
                {r.name}
              </SvgText>
              {bulbs.length > 0 && (rot ? s.w : s.h) > 70 && (
                <SvgText x={t1.x} y={t1.y} transform={rot ? `rotate(90 ${t1.x} ${t1.y})` : undefined} fontSize={12} fontFamily={FONT.semi} fill={T.inkSoft}>
                  {bulbs.filter(lit).length ? `${bulbs.filter(lit).length} de ${bulbs.length}` : 'Apagada'}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>

      {/* habitaciones tocables: encienden o apagan todas sus luces */}
      {!editing &&
        rooms.map(({ r, s, bulbs }) => {
          const anyOn = bulbs.some(lit);
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={bulbs.length ? `${r.name}: ${anyOn ? 'apagar' : 'encender'} sus luces` : `${r.name}, sin luces`}
              onPress={() => (bulbs.length ? setPower(bulbs, !anyOn) : flash(`${r.name} no tiene luces. Toca «Colocar» para poner una`))}
              style={({ pressed }) => ({
                position: 'absolute',
                left: s.x + GAP,
                top: s.y + GAP,
                width: s.w - GAP * 2,
                height: s.h - GAP * 2,
                borderRadius: 12,
                backgroundColor: pressed ? 'rgba(23, 19, 31, 0.06)' : 'transparent',
              })}
            />
          );
        })}

      {editing && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: planH + 8, height: TRAY - 8, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: WALL, paddingHorizontal: 14, paddingTop: 6 }}>
          <Txt w="semi" size={12} color={T.inkSoft}>
            {unplaced.length ? 'Sin colocar: arrástralas al plano' : 'Suelta aquí una luz para quitarla del plano'}
          </Txt>
        </View>
      )}

      {things.map((t) => {
        const at = screenOf(t);
        if (!editing && !placeOf(t)) return null;
        const on = live(t.id).state === 'ok' && live(t.id).look.on;
        const plug = t.plug;
        return (
          <Marker
            key={`${t.id}-${at.x.toFixed(1)}-${at.y.toFixed(1)}`}
            name={t.name}
            x={at.x}
            y={at.y}
            plug={!!plug}
            on={on}
            color={on && !plug ? lookCss(live(t.id).look) : undefined}
            editing={editing}
            onToggle={() => (plug ? setPlugs([plug], !on) : setPower([t as Bulb], !on))}
            onOpen={plug ? undefined : () => router.push(`/bulb/${t.id}`)}
            onDrop={(x, y) => drop(t, x, y)}
          />
        );
      })}
    </View>
  );
}

type MarkerProps = {
  name: string;
  x: number;
  y: number;
  /** una toma de enchufe: cuadrado con su icono, negro si está encendida */
  plug?: boolean;
  on: boolean;
  color?: string;
  editing: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  onDrop: (x: number, y: number) => void;
};

/** Una luz en el plano: un punto del color que da. Tocar la enciende o apaga; mantener abre sus colores. */
function Marker({ name, x, y, plug, on, color, editing, onToggle, onOpen, onDrop }: MarkerProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);
  const props = useRef({ x, y, onDrop, editing });
  props.current = { x, y, onDrop, editing };

  const responder = useRef(
    PanResponder.create({
      // en el modo colocar, el dedo es de la luz desde el primer momento
      onStartShouldSetPanResponder: () => props.current.editing,
      onMoveShouldSetPanResponder: () => props.current.editing,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        setDragging(false);
        props.current.onDrop(props.current.x + g.dx, props.current.y + g.dy);
        // el sitio nuevo llega con los datos; si no cambia (p. ej. vuelve a la bandeja), que no se quede desplazada
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        pan.setValue({ x: 0, y: 0 });
      },
    }),
  ).current;

  const dot = plug ? (
    <View
      pointerEvents="none"
      style={[
        { width: DOT, height: DOT, borderRadius: 10, borderWidth: 3, borderColor: on ? '#FFFFFF' : T.ink, backgroundColor: on ? T.ink : '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
        FLOAT,
      ]}
    >
      <MaterialCommunityIcons name="power-socket-eu" size={18} color={on ? '#FFFFFF' : T.ink} />
    </View>
  ) : (
    <View
      pointerEvents="none"
      style={[
        { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 3, borderColor: color ? '#FFFFFF' : T.ink, backgroundColor: color ?? '#FFFFFF' },
        FLOAT,
      ]}
    />
  );

  return (
    <Animated.View
      {...(editing ? responder.panHandlers : {})}
      style={{
        position: 'absolute',
        left: x - 32,
        top: y - 32,
        width: 64,
        height: 82,
        alignItems: 'center',
        zIndex: dragging ? 10 : 1,
        transform: [...pan.getTranslateTransform(), { scale: dragging ? 1.2 : 1 }],
        cursor: editing ? 'grab' : 'pointer',
      } as object}
    >
      {/* en el modo colocar no hay botón dentro: se quedaría el gesto y no se podría arrastrar */}
      {editing ? (
        <View accessible accessibilityLabel={`${name}: arrástrala a su sitio`} style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
          {dot}
        </View>
      ) : (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel={name}
          accessibilityHint={onOpen ? 'Toca para encender o apagar; mantén para elegir su color' : 'Toca para encender o apagar'}
          onPress={onToggle}
          onLongPress={onOpen}
          delayLongPress={350}
          style={({ pressed }) => ({ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : 1 }] })}
        >
          {dot}
        </Pressable>
      )}
      <View pointerEvents="none" style={{ marginTop: -12, backgroundColor: editing ? T.ink : 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 110 }}>
        <Txt w="semi" size={11} color={editing ? '#fff' : T.ink} numberOfLines={1}>
          {name}
        </Txt>
      </View>
    </Animated.View>
  );
}
