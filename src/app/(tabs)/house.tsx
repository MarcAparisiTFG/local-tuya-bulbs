import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HousePlan } from '../../components/HousePlan';
import { PillButton } from '../../components/ui';
import { T } from '../../theme';

/** Vuestra casa en grande, sin scroll: tocar una luz la enciende o apaga; mantenerla, sus colores. */
export default function House() {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  return (
    // abajo deja sitio a la barra flotante
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96, paddingHorizontal: 16, gap: 10 }}>

      <View style={{ flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {area.w > 0 && <HousePlan width={area.w} height={area.h} editing={editing} />}
        {/* sin cabecera: «Colocar» flota en la esquina del plano */}
        <View style={{ position: 'absolute', top: 0, right: 0 }}>
          <PillButton text={editing ? 'Listo' : 'Colocar'} icon={editing ? 'check' : 'cursor-move'} kind={editing ? 'primary' : 'secondary'} onPress={() => setEditing(!editing)} />
        </View>
      </View>
    </View>
  );
}
