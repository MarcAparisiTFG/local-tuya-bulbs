import { memo } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useBulb, useBulbs } from '../bulbs';
import { OBJ } from '../objects';
import { T } from '../theme';
import { Plug } from '../types';
import { PillSwitch } from './PillSwitch';
import { Txt } from './Txt';

/** Tarjeta de una toma de enchufe: no da luz, así que encendida es blanca y apagada, gris. Tocarla la cambia. */
export const PlugTile = memo(function PlugTile({ plug, width }: { plug: Plug; width: number }) {
  const { look, state, error } = useBulb(plug.id);
  const { setPlugs, retry } = useBulbs();
  const on = state === 'ok' && look.on;
  const img = Math.max(48, Math.min(104, width * 0.56));
  const status = state === 'error' ? error || 'No responde' : state === 'loading' ? 'Conectando…' : on ? 'Encendido' : 'Apagado';

  return (
    <View style={{ width, height: width * 1.18, borderRadius: 28, backgroundColor: on ? T.surface : T.off, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${plug.name}, ${status}. ${state === 'error' ? 'Reintentar' : on ? 'Apagar' : 'Encender'}`}
        onPress={() => (state === 'error' ? retry(plug.id) : state === 'ok' && setPlugs([plug], !look.on))}
        style={({ pressed }) => ({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
      />
      <View pointerEvents="box-none" style={{ flex: 1, padding: 16 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Txt pointerEvents="none" w="semi" size={13} color={state === 'error' ? T.danger : T.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
            {status}
          </Txt>
          <PillSwitch label={`Encender ${plug.name}`} disabled={state !== 'ok'} value={look.on} onChange={(v) => setPlugs([plug], v)} />
        </View>
        <Txt pointerEvents="none" w="bold" size={19} numberOfLines={2} style={{ marginTop: 10 }}>
          {plug.name}
        </Txt>
        {state === 'error' && (
          <Txt pointerEvents="none" size={12} color={T.inkSoft}>
            Toca para reintentar
          </Txt>
        )}
        <View pointerEvents="none" style={{ flex: 1, minHeight: 48, marginTop: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Image source={OBJ.plug} style={{ width: img, height: img, opacity: on ? 1 : 0.4 }} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
});
