import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, View } from 'react-native';
import { OBJ, ObjKey } from '../objects';
import { T } from '../theme';

/** El dibujo de una escena: un objeto 3D, o el icono de apagar sobre un círculo oscuro. */
export function SceneIcon({ icon, size }: { icon: string; size: number }) {
  if (icon === 'off') {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="power" size={size * 0.5} color="#fff" />
      </View>
    );
  }
  const src = OBJ[(icon in OBJ ? icon : 'bulb') as ObjKey];
  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}
