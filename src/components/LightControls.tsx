import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ColorPicker } from 'panelui-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { colourHex, hexToColour, hsvCss, lookCss, tempCss, tempWord } from '../look';
import { useApp } from '../state';
import { T } from '../theme';
import { Look } from '../types';
import { Dial } from './Dial';
import { Txt } from './Txt';

type Edit = 'brightness' | 'white' | 'colour';
type Props = {
  look: Look;
  onChange: (l: Look, commit: boolean) => void;
  /** Lado del escenario donde van el dial o la rueda; es el mismo en los tres modos, así nada salta al cambiar */
  size?: number;
  /** Fondo de las pastillas y botones sin elegir; dentro de un bloque blanco, lavanda para que se vean */
  chip?: string;
};

const SWATCHES = 44;

/** Dial + las tres pastillas (Brillo, Blanco, Color) de las referencias. Lo usan el detalle y el editor de escenas. */
export function LightControls({ look, onChange, size = 260, chip = T.surface }: Props) {
  const { data, addColor, removeColor, flash } = useApp();
  const [edit, setEdit] = useState<Edit>(look.mode === 'colour' ? 'colour' : 'brightness');
  const set = (patch: Partial<Look>, commit: boolean) => onChange({ ...look, ...patch }, commit);

  // La rueda trabaja con #rrggbb. Mientras el color siga siendo el que ella misma acaba de dar, se le
  // devuelve esa misma cadena: si recibiera una recalculada, recolocaría el tirador en mitad del arrastre.
  const fromWheel = useRef<{ hex: string; hue: number; sat: number } | null>(null);
  const w = fromWheel.current;
  const wheelValue = w && w.hue === look.hue && w.sat === look.sat ? w.hex : colourHex(look.hue, look.sat);
  const lookRef = useRef(look);
  lookRef.current = look;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // estable: así la rueda (memo) no se redibuja con cada color que ella misma produce
  const pick = useCallback((hex: string, commit: boolean) => {
    const c = hexToColour(hex);
    if (!c) return;
    fromWheel.current = { hex, ...c };
    onChangeRef.current({ ...lookRef.current, ...c }, commit);
  }, []);

  return (
    <View style={{ gap: 18 }}>
      <View style={{ height: size, alignItems: 'center', justifyContent: 'center' }}>
      {edit === 'colour' ? (
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Wheel value={wheelValue} size={size - SWATCHES - 14} onPick={pick} />
          {/* una fila de alto fijo; si hay muchos colores guardados, se desliza en horizontal */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: SWATCHES, maxWidth: size, flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
            {data.colors.map((c, i) => (
              <Pressable
                key={`${c.hue}-${c.sat}`}
                accessibilityRole="button"
                accessibilityLabel={`Color guardado ${i + 1}. Mantén pulsado para quitarlo`}
                onPress={() => set({ hue: c.hue, sat: c.sat }, true)}
                delayLongPress={400}
                onLongPress={() => {
                  removeColor(i);
                  flash('Color quitado');
                }}
                style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: chip, backgroundColor: hsvCss(c.hue, c.sat) }}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guardar este color"
              onPress={() => {
                addColor({ hue: look.hue, sat: look.sat });
                flash('Color guardado');
              }}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: chip, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialCommunityIcons name="plus" size={20} color={T.ink} />
            </Pressable>
          </ScrollView>
        </View>
      ) : edit === 'white' ? (
        <Dial label="Temperatura del blanco" size={size} value={look.temp} from="#FFB066" to="#9CC3FF" onChange={(temp, commit) => set({ temp }, commit)} />
      ) : (
        <Dial
          label="Brillo"
          size={size}
          value={look.brightness}
          min={1}
          from="#E2DCEC"
          to={look.mode === 'colour' ? colourHex(look.hue, look.sat) : '#FFB547'}
          onChange={(brightness, commit) => set({ brightness }, commit)}
        />
      )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pill label="Brillo" chip={chip} selected={edit === 'brightness'} onPress={() => setEdit('brightness')}>
          <Value selected={edit === 'brightness'}>{`${Math.round(look.brightness)}%`}</Value>
        </Pill>
        <Pill
          label="Blanco"
          chip={chip}
          selected={edit === 'white'}
          onPress={() => {
            setEdit('white');
            if (look.mode !== 'white') set({ mode: 'white' }, true);
          }}
        >
          <Value selected={edit === 'white'} dot={look.mode === 'white' ? tempCss(look.temp) : undefined}>
            {tempWord(look.temp)}
          </Value>
        </Pill>
        <Pill
          label="Color"
          chip={chip}
          selected={edit === 'colour'}
          onPress={() => {
            setEdit('colour');
            if (look.mode !== 'colour') set({ mode: 'colour' }, true);
          }}
        >
          <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 4, backgroundColor: look.mode === 'colour' ? lookCss(look) : '#D9D3E2' }} />
        </Pill>
      </View>
    </View>
  );
}

function Pill({ label, selected, onPress, children, chip }: { label: string; selected: boolean; onPress: () => void; children: React.ReactNode; chip: string }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? T.ink : chip,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Txt w="semi" size={12} color={selected ? '#C9C3D3' : T.inkSoft}>
        {label}
      </Txt>
      {children}
    </Pressable>
  );
}

function Value({ children, selected, dot }: { children: string; selected: boolean; dot?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
      {dot && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />}
      <Txt w="bold" size={20} color={selected ? '#fff' : T.ink}>
        {children}
      </Txt>
    </View>
  );
}

/**
 * La rueda de PanelUI, aislada: mientras se arrastra, el color que vuelve del padre es el que ella misma dio,
 * así que no se le pasa y no se redibuja; sólo recibe un color nuevo cuando cambia desde fuera (un color
 * guardado, una escena, el estado real de la bombilla).
 */
const Wheel = memo(function Wheel({ value, size, onPick }: { value: string; size: number; onPick: (hex: string, commit: boolean) => void }) {
  const emitted = useRef('');
  const [external, setExternal] = useState(value);
  useEffect(() => {
    if (value !== emitted.current) setExternal(value);
  }, [value]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  return useMemo(
    () => (
      <ColorPicker
        value={external}
        onValueChange={(hex) => {
          emitted.current = hex;
          onPickRef.current(hex, false);
        }}
        onValueCommit={(hex) => {
          emitted.current = hex;
          onPickRef.current(hex, true);
        }}
      >
        <ColorPicker.Wheel size={size} />
      </ColorPicker>
    ),
    [external, size],
  );
});
