import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { useApp } from '../state';
import { T } from '../theme';
import { HomeWidget } from '../widget/HomeWidget';
import { getWeather, Weather } from '../widget/weather';

/** Para revisar el widget de la tablet sin compilar (/widget-preview). */
export default function WidgetPreviewScreen() {
  const { data } = useApp();
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    getWeather(true).then(setWeather);
  }, []);
  const modes = data.scenes.map((s) => ({ id: s.id, name: s.name, icon: s.icon }));
  return (
    <ScrollView style={{ backgroundColor: T.bg }} contentContainerStyle={{ padding: 24, gap: 24 }}>
      {[
        { w: 700, h: 400 },
        { w: 520, h: 300 },
      ].map(({ w, h }) => (
        <View key={w}>
          <WidgetPreview renderWidget={() => <HomeWidget weather={weather} modes={modes} active={['chimenea']} places={[]} hub width={w} />} width={w} height={h} />
        </View>
      ))}
    </ScrollView>
  );
}
