import { Text, TextProps } from 'react-native';
import { FONT, T } from '../theme';

type Props = TextProps & { w?: keyof typeof FONT; size?: number; color?: string };

/** Todo el texto propio de la app, en Urbanist. */
export function Txt({ w = 'regular', size = 15, color = T.ink, style, ...p }: Props) {
  return <Text {...p} style={[{ fontFamily: FONT[w], fontSize: size, lineHeight: Math.round(size * 1.25), color }, style]} />;
}
