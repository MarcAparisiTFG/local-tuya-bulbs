// Entrada de la app: la de expo-router y, además, el widget de Android, que funciona con la app cerrada.
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  registerWidgetTaskHandler(require('./src/widget/handler').widgetTaskHandler);
}
