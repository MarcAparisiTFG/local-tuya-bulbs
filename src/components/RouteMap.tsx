import { createElement, useMemo } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { mapHtml, MapRoute } from '../mapPage';
import { HOME } from '../places';
import { T } from '../theme';

/** El mapa de la zona con las rutas de casa a cada sitio. La página se hace aquí: no depende de que el puente la sirva. */
export function RouteMap({ routes, tomtomKey, pad, style }: { routes: MapRoute[]; tomtomKey?: string | null; pad?: { top: number; bottom: number }; style?: StyleProp<ViewStyle> }) {
  const html = useMemo(() => mapHtml({ home: HOME, routes, tomtomKey, pad }), [JSON.stringify(routes), tomtomKey, pad?.top, pad?.bottom]);
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: T.off }, style]}>
      {Platform.OS === 'web' ? createElement('iframe', { srcDoc: html, title: 'Mapa de rutas', style: { width: '100%', height: '100%', border: 0, display: 'block' } }) : <NativeMap html={html} />}
    </View>
  );
}

function NativeMap({ html }: { html: string }) {
  const { WebView } = require('react-native-webview');
  // la página pide las teselas por https; el origen da igual
  return <WebView source={{ html, baseUrl: 'https://localhost/' }} originWhitelist={['*']} style={{ flex: 1, backgroundColor: 'transparent' }} scrollEnabled={false} setSupportMultipleWindows={false} />;
}
