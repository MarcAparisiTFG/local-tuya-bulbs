import { Tabs } from 'expo-router';
import { NavPill } from '../../components/NavPill';
import { T } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <NavPill {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: T.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="house" options={{ title: 'Casa' }} />
      <Tabs.Screen name="scenes" options={{ title: 'Modos' }} />
      <Tabs.Screen name="salir" options={{ title: 'Para salir' }} />
      <Tabs.Screen name="places" options={{ title: 'Sitios' }} />
    </Tabs>
  );
}
