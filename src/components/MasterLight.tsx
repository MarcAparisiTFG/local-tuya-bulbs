import { Image, Pressable } from 'react-native';
import { OBJ } from '../objects';
import { FLOAT, T } from '../theme';

/** Arriba del todo: la bombilla encendida apaga todo; apagada, lo enciende. */
export function MasterLight({ anyOn, onPress, disabled, size = 52 }: { anyOn: boolean; onPress: () => void; disabled?: boolean; size?: number }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Todas las luces"
      accessibilityState={{ checked: anyOn, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: anyOn ? T.ink : T.surface,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        anyOn && FLOAT,
      ]}
    >
      <Image source={OBJ.bulb} style={{ width: size * 0.65, height: size * 0.65, opacity: anyOn ? 1 : 0.35 }} />
    </Pressable>
  );
}
