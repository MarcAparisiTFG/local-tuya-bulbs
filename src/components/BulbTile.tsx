import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useBulb, useBulbs } from '../bulbs';
import { lookCss, lookPastel } from '../look';
import { OBJ } from '../objects';
import { T } from '../theme';
import { Bulb } from '../types';
import { Glow } from './Glow';
import { PillSwitch } from './PillSwitch';
import { Txt } from './Txt';

/** Tarjeta de una bombilla en el inicio: su fondo es la luz que da, aclarada. */
export const BulbTile = memo(function BulbTile({ bulb, width }: { bulb: Bulb; width: number }) {
  const { look, state, error, fx } = useBulb(bulb.id);
  const { change, retry } = useBulbs();
  const lit = state === 'ok' && look.on;
  // la bombilla ocupa el hueco que quede bajo el nombre (en iPhone el nombre puede ir en dos líneas)
  const [space, setSpace] = useState(0);
  const img = Math.max(48, Math.min(110, width * 0.62, space));

  const status =
    state === 'error' ? error || 'No responde' : state === 'loading' ? 'Conectando…' : !look.on ? 'Apagada' : fx ? 'De fiesta' : `${Math.round(look.brightness)}%`;

  return (
    <View style={{ width, height: width * 1.18, borderRadius: 28, backgroundColor: state !== 'ok' ? T.off : fx && look.on ? 'hsl(300, 70%, 90%)' : lookPastel(look), overflow: 'hidden' }}>
      {/* toda la tarjeta abre el detalle; el interruptor va aparte, encima, para no anidar botones */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${bulb.name}, ${status}. Abrir`}
        onPress={() => (state === 'error' ? retry(bulb.id) : router.push(`/bulb/${bulb.id}`))}
        style={({ pressed }) => ({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: pressed ? 0.85 : 1 })}
      />
      <View pointerEvents="box-none" style={{ flex: 1, padding: 16 }}>
        {/* estado e interruptor arriba; el nombre en su propia línea para que no se parta a media palabra */}
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Txt pointerEvents="none" w="semi" size={13} color={state === 'error' ? T.danger : T.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
            {status}
          </Txt>
          <PillSwitch label={`Encender ${bulb.name}`} disabled={state !== 'ok'} value={look.on} onChange={(on) => change(bulb, { ...look, on }, true)} />
        </View>
        <Txt pointerEvents="none" w="bold" size={19} numberOfLines={2} style={{ marginTop: 10 }}>
          {bulb.name}
        </Txt>
        {state === 'error' && (
          <Txt pointerEvents="none" size={12} color={T.inkSoft}>
            Toca para reintentar
          </Txt>
        )}
        <View
          pointerEvents="none"
          onLayout={(e) => setSpace(Math.floor(e.nativeEvent.layout.height))}
          style={{ flex: 1, minHeight: 48, marginTop: 4, alignItems: 'center', justifyContent: 'flex-end' }}
        >
          {lit && (
            <View style={{ position: 'absolute', bottom: -img * 0.35 }}>
              <Glow color={lookCss(look)} size={img * 1.9} strength={0.55 + (look.brightness / 100) * 0.35} />
            </View>
          )}
          <Image source={OBJ.bulb} style={{ width: img, height: img, opacity: lit ? 1 : 0.4 }} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
});
