import '../global.css';
import {
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/urbanist';
import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { PanelUIProvider, PanelUITheme } from 'panelui-native';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { BulbsProvider } from '../bulbs';
import { HubSync } from '../hubSync';
import { ModeShortcuts } from '../quickActions';
import { SiriBridge } from '../siri';
import { AppProvider, useApp } from '../state';
import { T } from '../theme';
import { discover } from '../tuya/discovery';
import { WidgetSync } from '../widget/WidgetSync';

// Tema claro de las referencias (DESIGN.md)
PanelUITheme.setTheme('light');

function Shell() {
  const { updateIps } = useApp();
  const { width } = useWindowDimensions();
  const kiosk = Platform.OS === 'android' && width >= 700;

  // Al abrir, busca las bombillas en la red por si alguna ha cambiado de IP
  useEffect(() => {
    discover(5000).then((found) => found.length && updateIps(found));
  }, []);

  return (
    <>
      {/* la tablet de la pared, a pantalla completa: sin las barras de Android (se asoman deslizando desde el borde) */}
      <StatusBar style="dark" hidden={kiosk} />
      {kiosk && <NavigationBar hidden />}
      <SiriBridge />
      <ModeShortcuts />
      <HubSync />
      <WidgetSync />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }} />
    </>
  );
}

export default function Layout() {
  const [fonts] = useFonts({ Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold });
  if (!fonts) return null;
  return (
    // Los datos por fuera: las capas de PanelUI (avisos, rueda) se pintan en su propio portal
    <AppProvider>
      <BulbsProvider>
        <PanelUIProvider>
          <Shell />
        </PanelUIProvider>
      </BulbsProvider>
    </AppProvider>
  );
}
