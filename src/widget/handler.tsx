import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { toggleModeOnHub, widgetData } from './data';
import { HomeWidget } from './HomeWidget';

/** Lo que hace el widget con la app cerrada: dibujarse, actualizar el tiempo y poner o quitar modos. */
export async function widgetTaskHandler({ widgetAction, clickAction, clickActionData, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const width = widgetInfo.width;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'MODE' && typeof clickActionData?.id === 'string') {
    await toggleModeOnHub(clickActionData.id);
    // las bombillas tardan un instante en contar su nuevo estado
    await new Promise((r) => setTimeout(r, 600));
  }
  renderWidget(<HomeWidget {...await widgetData(width, { forceWeather: clickAction === 'REFRESH' })} />);
}
