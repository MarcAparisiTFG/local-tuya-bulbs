import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { sceneActive, sceneTargets, useBulbs } from '../../bulbs';
import { Txt } from '../../components/Txt';
import { useApp } from '../../state';
import { T } from '../../theme';
import { norm } from '../../voice/commands';

/**
 * marsianapp://modo/<nombre> pone ese modo y vuelve al inicio: la puerta para Siri, los atajos y el asistente
 * del sistema. Vale el id o el nombre, sin tildes ni mayúsculas.
 */
export default function ModeLink() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data } = useApp();
  const { applyScene, live } = useBulbs();
  const wanted = norm(decodeURIComponent(name ?? ''));
  const scene = data.scenes.find((s) => s.id === wanted || norm(s.name) === wanted || norm(s.name).replace(/ /g, '-') === wanted);

  useEffect(() => {
    let gone = false;
    (async () => {
      if (scene) {
        // recién abierta, espera a saber cómo están las bombillas: así quitar el modo luego las deja como estaban
        const targets = sceneTargets(scene, data.bulbs);
        for (let t = 0; t < 25 && targets.some((b) => live(b.id).state === 'loading'); t++) await new Promise((r) => setTimeout(r, 200));
        if (!sceneActive(scene, data.bulbs, live)) applyScene(scene);
      }
      if (!gone) router.replace('/');
    })();
    return () => {
      gone = true;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt w="black" size={24}>
        {scene ? scene.name : 'Ese modo no existe'}
      </Txt>
    </View>
  );
}
