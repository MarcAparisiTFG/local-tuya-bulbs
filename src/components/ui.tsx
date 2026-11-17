import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOAT, GUTTER, T } from '../theme';
import { Txt } from './Txt';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Pantalla con scroll; deja sitio abajo para la barra flotante. */
export function Screen({ children, top = true }: { children: ReactNode; top?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: top ? insets.top + 16 : 0,
        paddingBottom: insets.bottom + 120,
        gap: 20,
        maxWidth: 1100,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      {children}
    </ScrollView>
  );
}

export const Pad = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ paddingHorizontal: GUTTER }, style]}>{children}</View>
);

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>
);

/** Botón redondo blanco con un icono (atrás, ajustes…). */
export function CircleButton({ icon, label, onPress, dark }: { icon: IconName; label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? T.ink : T.surface,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <MaterialCommunityIcons name={icon} size={22} color={dark ? '#fff' : T.ink} />
    </Pressable>
  );
}

/** Botón en píldora: negro el principal, blanco el secundario. */
export function PillButton({
  text,
  onPress,
  kind = 'primary',
  icon,
  loading,
  danger,
}: {
  text: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'plain';
  icon?: IconName;
  loading?: boolean;
  danger?: boolean;
}) {
  const fg = kind === 'primary' ? '#fff' : danger ? T.danger : T.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 52,
          paddingHorizontal: 22,
          borderRadius: 26,
          backgroundColor: kind === 'primary' ? T.ink : kind === 'secondary' ? T.surface : 'transparent',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        kind === 'primary' && FLOAT,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon && <MaterialCommunityIcons name={icon} size={20} color={fg} />}
      <Txt w="semi" size={16} color={fg}>
        {text}
      </Txt>
    </Pressable>
  );
}

/** Pastilla seleccionable (dueño de una escena, bombillas…). */
export function Choice({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        justifyContent: 'center',
        // casi siempre va dentro de un bloque blanco: sin elegir, lavanda para que se vea que se puede tocar
        backgroundColor: selected ? T.ink : T.bg,
      }}
    >
      <Txt w="semi" size={14} color={selected ? '#fff' : T.ink}>
        {text}
      </Txt>
    </Pressable>
  );
}

/** Grupo blanco de ajustes / formulario. */
export function Panel({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderRadius: 24, padding: 18, gap: 12 }, style]}>
      {title && (
        <Txt w="bold" size={18}>
          {title}
        </Txt>
      )}
      {children}
    </View>
  );
}
