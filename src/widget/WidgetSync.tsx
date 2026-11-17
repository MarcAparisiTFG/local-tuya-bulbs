import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useActiveScenes } from '../bulbs';
import { useApp } from '../state';

/** Con la app abierta en la tablet, el widget se pone al día cuando cambian los modos, los sitios o lo que hay puesto. */
export function WidgetSync() {
  const { data } = useApp();
  const active = useActiveScenes(data.scenes, data.bulbs);
  const key = JSON.stringify([data.scenes.map((s) => [s.id, s.name, s.icon]), data.places, [...active]]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const t = setTimeout(() => {
      // el guardado de la app va un instante por detrás de este efecto
      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { widgetData, WIDGET } = require('./data');
      const { HomeWidget } = require('./HomeWidget');
      requestWidgetUpdate({
        widgetName: WIDGET,
        renderWidget: async (info: { width: number }) => <HomeWidget {...await widgetData(info.width, { active: [...active] })} />,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [key]);

  return null;
}
