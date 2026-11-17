import { Image, Pressable, View } from 'react-native';
import { OBJ } from '../objects';
import { T } from '../theme';
import { PillSwitch } from './PillSwitch';
import { Txt } from './Txt';

/** La primera tarjeta de las luces: todas a la vez. Encendida, en negro; tocarla entera también vale. */
export function AllLightsTile({ width, onCount, total, onChange }: { width: number; onCount: number; total: number; onChange: (on: boolean) => void }) {
  const anyOn = onCount > 0;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Todas las luces"
      accessibilityState={{ checked: anyOn }}
      onPress={() => onChange(!anyOn)}
      style={({ pressed }) => ({ width, height: width * 1.18, borderRadius: 28, padding: 16, backgroundColor: anyOn ? T.ink : T.surface, opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt w="semi" size={13} color={anyOn ? '#CFC6E6' : T.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
          {anyOn ? `${onCount} de ${total} encendida${onCount === 1 ? '' : 's'}` : 'Todo apagado'}
        </Txt>
        <PillSwitch label="Todas las luces" value={anyOn} onChange={onChange} />
      </View>
      <Txt w="bold" size={19} color={anyOn ? '#fff' : T.ink} style={{ marginTop: 10 }}>
        Todas
      </Txt>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Image source={OBJ.bulb} style={{ width: Math.min(110, width * 0.5), height: Math.min(110, width * 0.5), opacity: anyOn ? 1 : 0.35 }} resizeMode="contain" />
      </View>
    </Pressable>
  );
}
