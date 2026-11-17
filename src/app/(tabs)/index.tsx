import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { sceneTargets, useActiveScenes, useBulbs, useLiveSelect } from '../../bulbs';
import { BulbGrid, useTileWidth } from '../../components/BulbGrid';
import { AlertsBar, Appear, SummaryKpis } from '../../components/home/HomeCards';
import { PlacesStrip } from '../../components/PlacesStrip';
import { useDashboard } from '../../dashboard/useDashboard';
import { AllLightsTile } from '../../components/AllLightsTile';
import { SceneBg } from '../../components/SceneBg';
import { SceneIcon } from '../../components/SceneIcon';
import { Txt } from '../../components/Txt';
import { Pad, PillButton, Screen } from '../../components/ui';
import { OBJ } from '../../objects';
import { useApp } from '../../state';
import { GUTTER, T } from '../../theme';
import { getMode } from '../../tuya/mode';

export default function Home() {
  const { data } = useApp();
  const { setPower, toggleScene } = useBulbs();

  const scenes = data.scenes;
  const onCount = useLiveSelect((get) => data.bulbs.filter((b) => get(b.id).state === 'ok' && get(b.id).look.on).length);
  const anyOn = onCount > 0;
  const active = useActiveScenes(scenes, data.bulbs);
  const dash = useDashboard();
  const wide = useWindowDimensions().width >= 700;
  const { tileW } = useTileWidth();

  return (
    <Screen>
      {/* en la tablet, el resumen: tres datos del día y cuánto se tarda a cada sitio (tocarlos lleva al detalle).
          En el móvil, sólo luces: todo eso está en su pestaña «Para salir» */}
      {wide && (
        <Pad style={{ gap: 8 }}>
          <SummaryKpis dash={dash} onPress={() => router.navigate('/salir')} />
          <PlacesStrip wide={wide} />
        </Pad>
      )}

      {dash.alerts.length > 0 && (
        <Pad>
          <Appear>
            <AlertsBar alerts={dash.alerts} />
          </Appear>
        </Pad>
      )}

      {/* Modos a un toque, como la fila de las referencias; tocar uno puesto lo quita */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 14 }}>
        {scenes.map((s) => {
          const on = active.has(s.id);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Modo ${s.name}${on ? ', puesto. Toca para quitarlo' : ''}`}
              onPress={() => toggleScene(s)}
              style={({ pressed }) => ({ width: 76, alignItems: 'center', gap: 6, transform: [{ scale: pressed ? 0.94 : 1 }] })}
            >
              {/* activa: aro negro, fondo de su luz y una marca; así se ve qué escena hay puesta ahora */}
              <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: on ? T.ink : 'transparent', backgroundColor: T.surface }}>
                <SceneBg scene={s} bulbIds={sceneTargets(s, data.bulbs).map((b) => b.id)} style={{ flex: 1, borderRadius: 33, alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0 }} />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <SceneIcon icon={s.icon} size={s.icon === 'off' ? 44 : 42} />
                </View>
                {on && (
                  <View style={{ position: 'absolute', top: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: T.ink, borderWidth: 2, borderColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                  </View>
                )}
              </View>
              <Txt w={on ? 'bold' : 'semi'} size={13} color={on ? T.ink : T.inkSoft} numberOfLines={1} style={{ textAlign: 'center' }}>
                {s.name}
              </Txt>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Nueva escena" onPress={() => router.push('/scene/new')} style={({ pressed }) => ({ width: 72, alignItems: 'center', gap: 6, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: T.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="plus" size={26} color={T.inkSoft} />
          </View>
          <Txt w="semi" size={13} color={T.inkSoft}>
            Nueva
          </Txt>
        </Pressable>
        {/* los ajustes, a mano pero discretos: al final de la fila */}
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => router.push('/settings')} style={({ pressed }) => ({ width: 72, alignItems: 'center', gap: 6, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="cog-outline" size={26} color={T.inkSoft} />
          </View>
          <Txt w="semi" size={13} color={T.inkSoft}>
            Ajustes
          </Txt>
        </Pressable>
      </ScrollView>

      {data.bulbs.length === 0 && !data.plugs?.length ? (
        <Pad>
          <View style={{ backgroundColor: T.surface, borderRadius: 28, padding: 24, alignItems: 'center', gap: 12 }}>
            <Image source={OBJ.bulb} style={{ width: 96, height: 96 }} />
            <Txt w="bold" size={20}>
              Aún no hay bombillas
            </Txt>
            <Txt size={15} color={T.inkSoft} style={{ textAlign: 'center' }}>
              Pega tu devices.json en Ajustes y aparecerán todas de una vez.
            </Txt>
            <PillButton text="Añadir bombillas" icon="plus" onPress={() => router.navigate('/settings')} />
          </View>
        </Pad>
      ) : (
        <Pad style={{ gap: 16 }}>
          <BulbGrid
            bulbs={data.bulbs}
            plugs={data.plugs}
            first={data.bulbs.length > 0 && <AllLightsTile width={tileW} onCount={onCount} total={data.bulbs.length} onChange={(on) => setPower(data.bulbs, on)} />}
          />
        </Pad>
      )}
    </Screen>
  );
}
