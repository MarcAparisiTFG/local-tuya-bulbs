// Tokens de DESIGN.md. Los colores vivos de cada tarjeta salen de su bombilla (look.ts).
export const T = {
  bg: '#F4F0FA',
  surface: '#FFFFFF',
  ink: '#17131F',
  inkSoft: '#6B6577',
  line: '#E8E2F0',
  off: '#ECE9F1',
  accent: '#5B2EC4',
  ok: '#2FB36B',
  danger: '#D93D42',
  warn: '#C2560A',
};

export const FONT = {
  regular: 'Urbanist_500Medium',
  semi: 'Urbanist_600SemiBold',
  bold: 'Urbanist_700Bold',
  black: 'Urbanist_800ExtraBold',
} as const;

/** La única sombra: para lo que flota (barra, botón del dial, botón principal). */
export const FLOAT = { boxShadow: '0px 8px 24px rgba(40, 20, 80, 0.12)' } as const;

export const GUTTER = 16;
export const GAP = 12;
