import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { T } from '../theme';

type Props = { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string };

const W = 52;
const H = 30;
const KNOB = 22;

/** El interruptor negro de las referencias: lleno cuando está encendido, sólo el contorno cuando no. */
export function PillSwitch({ value, onChange, disabled, label }: Props) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={{
        width: W,
        height: H,
        borderRadius: H / 2,
        borderWidth: 2,
        borderColor: T.ink,
        backgroundColor: value ? T.ink : 'transparent',
        opacity: disabled ? 0.35 : 1,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 2,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: x.interpolate({ inputRange: [0, 1], outputRange: [T.ink, '#FFFFFF'] }),
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, W - KNOB - 8] }) }],
        }}
      />
    </Pressable>
  );
}
