import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FLOAT, T } from '../theme';

type Props = {
  /** 0-100 */
  value: number;
  min?: number;
  onChange: (v: number, commit: boolean) => void;
  /** Color de las marcas al principio y al final del recorrido */
  from: string;
  to: string;
  label: string;
  size?: number;
};

const START = 135; // grados, abajo a la izquierda
const SWEEP = 270; // hasta abajo a la derecha
const TICKS = 46;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (c: number, r: number, deg: number) => [c + r * Math.cos(rad(deg)), c + r * Math.sin(rad(deg))];
const arc = (c: number, r: number, a: number, b: number) => {
  const [x1, y1] = pt(c, r, a);
  const [x2, y2] = pt(c, r, b);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}

/** El dial de las referencias: se arrastra alrededor del botón blanco; las marcas de fuera llevan el color del recorrido. */
export function Dial({ value, min = 0, onChange, from, to, label, size = 248 }: Props) {
  const c = size / 2;
  const box = useRef({ w: size, h: size });
  const last = useRef(value);
  const [dragging, setDragging] = useState(false);
  last.current = value;
  // el gesto se crea una sola vez: si se rehace en cada movimiento, el arrastre se entrecorta
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const minRef = useRef(min);
  minRef.current = min;

  const fromTouch = (x: number, y: number) => {
    let a = (Math.atan2(y - box.current.h / 2, x - box.current.w / 2) * 180) / Math.PI;
    const rel = (((a - START) % 360) + 360) % 360;
    // en el hueco de abajo, al extremo más cercano
    let v = rel <= SWEEP ? rel / SWEEP : rel < SWEEP + (360 - SWEEP) / 2 ? 1 : 0;
    v = Math.round(minRef.current + v * (100 - minRef.current));
    // sin saltos de un extremo al otro al pasar por el hueco
    if (Math.abs(v - last.current) > 60) return null;
    return v;
  };

  const responder = useRef(
    PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          setDragging(true);
          const v = fromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (v !== null) onChangeRef.current(v, false);
        },
        onPanResponderMove: (e) => {
          const v = fromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (v !== null && v !== last.current) onChangeRef.current(v, false);
        },
        onPanResponderRelease: () => {
          setDragging(false);
          onChangeRef.current(last.current, true);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onChangeRef.current(last.current, true);
        },
      }),
  ).current;

  // las marcas sólo cambian con el tamaño o los colores, no con cada movimiento
  const ticks = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, i) => {
        const a = START + (SWEEP * i) / (TICKS - 1);
        return <Path key={i} d={arc(c, c - 6, a - 1.6, a + 1.6)} stroke={mix(from, to, i / (TICKS - 1))} strokeWidth={4} strokeLinecap="round" fill="none" />;
      }),
    [c, from, to],
  );

  const t = (value - min) / (100 - min);
  const angle = START + SWEEP * t;
  const knob = size * 0.58;
  const [dx, dy] = pt(knob / 2, knob * 0.33, angle);

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => (box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max: 100, now: Math.round(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(100, value + (e.nativeEvent.actionName === 'increment' ? 5 : -5))), true)}
      style={{ width: size, height: size, alignSelf: 'center', cursor: 'grab' } as object}
    >
      <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute' }}>
        {ticks}
        <Path d={arc(c, c - 24, START, START + SWEEP)} stroke={T.line} strokeWidth={8} strokeLinecap="round" fill="none" />
        {t > 0.005 && <Path d={arc(c, c - 24, START, angle)} stroke={T.ink} strokeWidth={8} strokeLinecap="round" fill="none" />}
      </Svg>
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: (size - knob) / 2,
            top: (size - knob) / 2,
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            backgroundColor: T.surface,
            transform: [{ scale: dragging ? 0.97 : 1 }],
          },
          FLOAT,
        ]}
      >
        <Svg width={knob} height={knob}>
          <Circle cx={dx} cy={dy} r={5} fill={T.ink} />
        </Svg>
      </View>
    </View>
  );
}
