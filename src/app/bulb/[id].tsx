import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBulb, useBulbs } from '../../bulbs';
import { Glow } from '../../components/Glow';
import { LightControls } from '../../components/LightControls';
import { PillSwitch } from '../../components/PillSwitch';
import { Txt } from '../../components/Txt';
import { CircleButton, PillButton } from '../../components/ui';
import { lookCss, lookPastel } from '../../look';
import { OBJ } from '../../objects';
import { useApp } from '../../state';
import { T } from '../../theme';

// Alto de las pastillas (Brillo, Blanco, Color) y su separación con el dial: LightControls
const PILLS = 72 + 18;

/** Una bombilla, en una sola pantalla fija: sin scroll, y el dial y la rueda ocupan el mismo hueco. */
export default function BulbScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useApp();
  const bulb = data.bulbs.find((b) => b.id === id);
  const { look, state, error, fx } = useBulb(id ?? '');
  const { change, retry } = useBulbs();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ w: 0, h: 0 });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!bulb) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top + 16, paddingHorizontal: 16, gap: 16 }}>
        <CircleButton icon="arrow-left" label="Volver" onPress={back} />
        <Txt w="bold" size={22}>
          Esta bombilla ya no está
        </Txt>
      </View>
    );
  }

  const lit = state === 'ok' && look.on;
  // el escenario del dial/rueda: lo más grande que quepa en lo que deja la pantalla
  const stage = Math.round(Math.max(170, Math.min(340, area.w, area.h - PILLS)));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* cabecera del color de la luz, como las de habitación de las referencias */}
      <View style={{ backgroundColor: state === 'ok' ? lookPastel(look) : T.off, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingTop: insets.top + 10, paddingBottom: 18, paddingHorizontal: 16, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 14 }}>
            <CircleButton icon="arrow-left" label="Volver" onPress={back} />
            <View>
              <Txt w="black" size={28} numberOfLines={2}>
                {bulb.name}
              </Txt>
              {!!bulb.room && (
                <Txt size={15} color={T.inkSoft}>
                  {bulb.room}
                </Txt>
              )}
            </View>
          </View>
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            {lit && (
              <View style={{ position: 'absolute' }}>
                <Glow color={lookCss(look)} size={200} strength={0.5 + (look.brightness / 100) * 0.4} />
              </View>
            )}
            <Image source={OBJ.bulb} style={{ width: 108, height: 108, opacity: lit ? 1 : 0.4 }} />
          </View>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 16, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        {state === 'error' ? (
          <View style={{ backgroundColor: T.surface, borderRadius: 24, padding: 18, gap: 12 }}>
            <Txt w="bold" size={17}>
              No llego a la bombilla
            </Txt>
            <Txt size={14} color={T.inkSoft}>
              {error || 'No responde.'} Comprueba que está enchufada y en el mismo Wi-Fi.
            </Txt>
            <View style={{ flexDirection: 'row' }}>
              <PillButton text="Reintentar" icon="refresh" onPress={() => retry(bulb.id)} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 }}>
            <Txt w="semi" size={16} style={{ flex: 1 }}>
              {state === 'loading' ? 'Conectando…' : look.on ? 'Encendida' : 'Apagada'}
            </Txt>
            <PillSwitch label={`Encender ${bulb.name}`} disabled={state !== 'ok'} value={look.on} onChange={(on) => change(bulb, { ...look, on }, true)} />
          </View>
        )}

        <View style={{ flex: 1, justifyContent: 'center' }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {area.h > 0 &&
            (lit && fx ? (
              <View style={{ alignItems: 'center', gap: 14 }}>
                <Txt w="bold" size={20}>
                  Está de fiesta
                </Txt>
                <Txt size={15} color={T.inkSoft} style={{ textAlign: 'center' }}>
                  Va cambiando de color sola. Para elegir tú la luz, para la fiesta.
                </Txt>
                <PillButton text="Parar la fiesta" icon="stop" onPress={() => change(bulb, look, true)} />
              </View>
            ) : lit ? (
              <LightControls size={stage} look={look} onChange={(l, commit) => change(bulb, l, commit)} />
            ) : (
              state === 'ok' && (
                <View style={{ alignItems: 'center', gap: 8, opacity: 0.7 }}>
                  <Image source={OBJ.bulb} style={{ width: 72, height: 72, opacity: 0.35 }} />
                  <Txt size={15} color={T.inkSoft}>
                    Enciéndela para elegir brillo y color
                  </Txt>
                </View>
              )
            ))}
        </View>
      </View>
    </View>
  );
}
