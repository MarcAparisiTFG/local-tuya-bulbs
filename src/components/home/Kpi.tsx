import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { T } from '../../theme';
import { Txt } from '../Txt';

/** Una tarjeta-dato del resumen: qué es, el valor grande y una línea debajo. Todas iguales, para que encajen. */
export function Kpi({
  icon,
  label,
  value,
  sub,
  subColor = T.inkSoft,
  onPress,
  a11y,
  flex,
  scale = 1,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  onPress?: () => void;
  a11y?: string;
  flex?: boolean;
  scale?: number;
}) {
  const z = (n: number) => Math.round(n * scale);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11y ?? `${label}: ${value}${sub ? `, ${sub}` : ''}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        minWidth: z(108),
        backgroundColor: T.surface,
        borderRadius: z(18),
        paddingVertical: z(10),
        paddingHorizontal: z(14),
        gap: z(2),
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: z(18) }}>
        {icon}
        <Txt w="semi" size={z(12)} color={T.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </Txt>
      </View>
      <Txt w="black" size={z(22)} numberOfLines={1}>
        {value}
      </Txt>
      <Txt w="semi" size={z(11)} color={subColor} numberOfLines={1}>
        {sub ?? ' '}
      </Txt>
    </Pressable>
  );
}
