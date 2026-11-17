import { NativeModules } from 'react-native';

// Los sockets son código nativo que sólo existe en el development build.
// En Expo Go no están: la app funciona entonces en modo demostración, con bombillas simuladas.
export const HAS_TCP = NativeModules.TcpSockets != null;
export const HAS_UDP = NativeModules.UdpSockets != null;
export const DEMO_MODE = !HAS_TCP;
