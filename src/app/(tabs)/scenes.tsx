import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { sceneTargets, useActiveScenes, useBulbs } from '../../bulbs';
import { SceneBg } from '../../components/SceneBg';
import { SceneIcon } from '../../components/SceneIcon';
import { Txt } from '../../components/Txt';
import { CircleButton, Pad, Screen } from '../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../state';
import { GAP, GUTTER, T } from '../../theme';
import { Scene } from '../../types';

export default function Modes() {
  const insets = useSafeAreaInsets();
  const { data } = useApp();
  const { toggleScene } = useBulbs();
  const { width } = useWindowDimensions();
  const active = useActiveScenes(data.scenes, data.bulbs);

  const inner = Math.min(width, 1100) - GUTTER * 2;
  const cols = inner >= 860 ? 4 : inner >= 560 ? 3 : 2;
  const tileW = Math.floor((inner - GAP * (cols - 1)) / cols);

  const describe = (s: Scene) => {
    const n = sceneTargets(s, data.bulbs).length;
    const lights = s.bulbIds === 'all' ? 'todas las luces' : n === 0 ? 'sin luces' : n === 1 ? '1 luz' : `${n} luces`;
    const np = Object.keys(s.plugs ?? {}).filter((id) => data.plugs?.some((p) => p.id === id)).length;
    const tv = (np ? ` + ${np} enchufe${np === 1 ? '' : 's'}` : '') + (s.tv?.app || s.tv?.youtube ? ' + tele' : s.tv?.ambilight ? ' + Ambilight' : '');
    if (s.kind === 'party') return `Fiesta en ${lights}${tv}`;
    if (s.kind === 'each') return `Cada una la suya · ${lights}${tv}`;
    return lights[0].toUpperCase() + lights.slice(1) + tv;
  };

  return (
    <View style={{ flex: 1 }}>
    <Screen>

      <Pad style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {data.scenes.map((s) => {
          const on = active.has(s.id);
          return (
            <View key={s.id} style={{ width: tileW, height: tileW * 1.05, borderRadius: 28, borderWidth: 3, borderColor: on ? T.ink : 'transparent', overflow: 'hidden' }}>
              <SceneBg scene={s} bulbIds={sceneTargets(s, data.bulbs).map((b) => b.id)} style={{ flex: 1 }}>
                {/* tocar pone o quita; el lápiz edita. Son hermanos, no un botón dentro de otro */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}${on ? ', puesto. Toca para quitarlo' : ''}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => toggleScene(s)}
                  onLongPress={() => router.push(`/scene/${s.id}`)}
                  style={({ pressed }) => ({ flex: 1, padding: 16, justifyContent: 'space-between', opacity: pressed ? 0.85 : 1 })}
                >
                  <SceneIcon icon={s.icon} size={Math.min(72, tileW * 0.42)} />
                  <View>
                    <Txt w="bold" size={18} numberOfLines={1}>
                      {s.name}
                    </Txt>
                    {on ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="check-circle" size={15} color={T.ink} />
                        <Txt w="bold" size={13}>
                          Puesto · toca para quitar
                        </Txt>
                      </View>
                    ) : (
                      <Txt size={13} color={T.inkSoft} numberOfLines={1}>
                        {describe(s)}
                      </Txt>
                    )}
                  </View>
                </Pressable>
              </SceneBg>
              <View style={{ position: 'absolute', top: 10, right: 10 }}>
                <CircleButton icon="pencil-outline" label={`Editar ${s.name}`} onPress={() => router.push(`/scene/${s.id}`)} />
              </View>
            </View>
          );
        })}
      </Pad>
    </Screen>
      {/* sin cabecera: el «nuevo modo» flota en la esquina */}
      <View style={{ position: 'absolute', right: 16, bottom: insets.bottom + 100 }}>
        <CircleButton icon="plus" label="Nuevo modo" dark onPress={() => router.push('/scene/new')} />
      </View>
    </View>
  );
}
