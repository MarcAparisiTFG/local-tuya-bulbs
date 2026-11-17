import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOAT, T } from '../theme';
import { IconName } from './ui';

const ICONS: Record<string, IconName> = { index: 'home-variant-outline', house: 'floor-plan', scenes: 'creation-outline', salir: 'weather-partly-cloudy', places: 'car-outline', settings: 'cog-outline' };

/** La barra flotante en píldora de las referencias: la pestaña activa es un círculo negro. */
export function NavPill({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 14, alignItems: 'center' }}>
      <View style={[{ flexDirection: 'row', gap: 6, padding: 6, borderRadius: 34, backgroundColor: T.surface }, FLOAT]}>
        {state.routes.map((route, i) => {
          // las pestañas ocultas (Ajustes) no salen en la barra
          if ((descriptors[route.key].options as { href?: unknown }).href === null) return null;
          const focused = state.index === i;
          const label = String(descriptors[route.key].options.title ?? route.name);
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              style={({ pressed }) => ({
                width: 54,
                height: 54,
                borderRadius: 27,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? T.ink : 'transparent',
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <MaterialCommunityIcons name={ICONS[route.name] ?? 'circle-outline'} size={24} color={focused ? '#fff' : T.ink} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
