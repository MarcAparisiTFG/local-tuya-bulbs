import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { sceneSwatches } from '../look';
import { Scene } from '../types';

/** El fondo de un modo: su luz aclarada o, si tiene varias (cada bombilla la suya, fiesta), un degradado de todas. */
export function SceneBg({ scene, bulbIds, style, children }: { scene: Scene; bulbIds: string[]; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const colors = sceneSwatches(scene, bulbIds);
  if (colors.length < 2) return <View style={[style, { backgroundColor: colors[0] }]}>{children}</View>;
  return (
    <LinearGradient colors={colors as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}
