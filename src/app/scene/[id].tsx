import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Input } from 'panelui-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sceneTargets, useBulbs } from '../../bulbs';
import { LightControls } from '../../components/LightControls';
import { PillSwitch } from '../../components/PillSwitch';
import { SceneBg } from '../../components/SceneBg';
import { SceneIcon } from '../../components/SceneIcon';
import { Txt } from '../../components/Txt';
import { Choice, CircleButton, IconName, Pad, Panel, PillButton } from '../../components/ui';
import { DEFAULT_LOOK, lookCss, lookFromDps, sceneLookFor, tempWord } from '../../look';
import { OBJ, SCENE_ICONS } from '../../objects';
import { useApp } from '../../state';
import { T } from '../../theme';
import { getStatus } from '../../tuya/pool';
import { TV_APPS, tvApp } from '../../tv/apps';
import { tvClient } from '../../tv/client';
import { Bulb, Look, ModeKind, Scene } from '../../types';

type Draft = Omit<Scene, 'id'> & { id?: string };

const KINDS: { kind: ModeKind; title: string; text: string; icon: IconName }[] = [
  { kind: 'one', title: 'Una luz', text: 'La misma en todas', icon: 'lightbulb-outline' },
  { kind: 'each', title: 'Cada una', text: 'Su luz a cada bombilla', icon: 'lightbulb-group-outline' },
  { kind: 'party', title: 'Fiesta', text: 'Colores al azar', icon: 'party-popper' },
];

const SPEEDS: { v: 1 | 2 | 3; text: string }[] = [
  { v: 1, text: 'Tranquila' },
  { v: 2, text: 'Animada' },
  { v: 3, text: 'Loca' },
];

const describe = (l: Look) => (!l.on ? 'Apagada' : `${l.mode === 'colour' ? 'Color' : tempWord(l.temp)} · ${Math.round(l.brightness)}%`);

export default function ModeEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, upsertScene, removeScene, flash } = useApp();
  const { live, applyScene } = useBulbs();
  const insets = useSafeAreaInsets();
  const existing = data.scenes.find((s) => s.id === id);
  const [draft, setDraft] = useState<Draft>(
    () => existing ?? { name: '', icon: 'sun', owner: '*', kind: 'one', look: { ...DEFAULT_LOOK }, bulbIds: 'all', speed: 3 },
  );
  const [open, setOpen] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copying, setCopying] = useState(false);

  const kind = draft.kind ?? 'one';
  const targets = sceneTargets(draft as Scene, data.bulbs);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/scenes'));

  const toggleBulb = (bid: string) => {
    const cur = draft.bulbIds === 'all' ? data.bulbs.map((b) => b.id) : draft.bulbIds;
    const next = cur.includes(bid) ? cur.filter((x) => x !== bid) : [...cur, bid];
    setDraft({ ...draft, bulbIds: next.length === data.bulbs.length ? 'all' : next });
  };
  // cada toma de enchufe: sin tocar (no está), encendida o apagada
  const setPlug = (pid: string, on: boolean | undefined) =>
    setDraft((d) => {
      const { [pid]: _old, ...rest } = d.plugs ?? {};
      const plugs = on === undefined ? rest : { ...rest, [pid]: on };
      return { ...d, plugs: Object.keys(plugs).length ? plugs : undefined };
    });
  const setBulbLook = (bid: string, look: Look) => setDraft((d) => ({ ...d, perBulb: { ...d.perBulb, [bid]: look } }));
  // la luz que tiene ahora una bombilla (lo que ya hay en pantalla o, si no, se le pregunta)
  const current = (b: Bulb, use: (l: Look) => void) => {
    const l = live(b.id);
    if (l.state === 'ok') return use(l.look);
    getStatus(b)
      .then((dps) => use(lookFromDps(dps)))
      .catch((e: Error) => flash(`${b.name}: ${e.message}`));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 16 }}>
      <SceneBg
        scene={draft as Scene}
        bulbIds={targets.map((b) => b.id)}
        style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingTop: insets.top + 12, paddingBottom: 22, paddingHorizontal: 16, gap: 10 }}
      >
        <CircleButton icon="arrow-left" label="Volver sin guardar" onPress={back} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <SceneIcon icon={draft.icon} size={84} />
          <Txt w="black" size={28} style={{ flex: 1 }} numberOfLines={2}>
            {draft.name.trim() || (existing ? 'Editar modo' : 'Nuevo modo')}
          </Txt>
        </View>
      </SceneBg>

      <Pad style={{ gap: 16 }}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
          {KINDS.map((k) => {
            const on = kind === k.kind;
            return (
              <Pressable
                key={k.kind}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${k.title}: ${k.text}`}
                onPress={() => setDraft({ ...draft, kind: k.kind, icon: k.kind === 'party' && draft.icon === 'sun' ? 'party' : draft.icon })}
                style={({ pressed }) => ({ flex: 1, borderRadius: 24, padding: 14, gap: 6, backgroundColor: on ? T.ink : T.surface, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <MaterialCommunityIcons name={k.icon} size={24} color={on ? '#fff' : T.ink} />
                <Txt w="bold" size={15} color={on ? '#fff' : T.ink}>
                  {k.title}
                </Txt>
                <Txt size={12} color={on ? '#C9C3D3' : T.inkSoft}>
                  {k.text}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        <Panel>
          <Input label="Nombre" value={draft.name} placeholder="Cena, Película, Fiesta…" onChangeText={(name) => setDraft({ ...draft, name })} />
          <Txt w="semi" size={14} color={T.inkSoft}>
            Dibujo
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SCENE_ICONS.map((k) => (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.icon === k }}
                accessibilityLabel={k === 'off' ? 'Apagar' : k}
                onPress={() => setDraft({ ...draft, icon: k })}
                style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.icon === k ? T.bg : 'transparent', borderWidth: 2, borderColor: draft.icon === k ? T.ink : 'transparent' }}
              >
                <SceneIcon icon={k} size={k === 'off' ? 34 : 36} />
              </Pressable>
            ))}
          </View>
        </Panel>

        <Panel title="Bombillas">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Choice text="Todas" selected={draft.bulbIds === 'all'} onPress={() => setDraft({ ...draft, bulbIds: 'all' })} />
            {data.bulbs.map((b) => (
              <Choice key={b.id} text={b.name} selected={draft.bulbIds !== 'all' && draft.bulbIds.includes(b.id)} onPress={() => toggleBulb(b.id)} />
            ))}
          </View>
        </Panel>

        {(data.plugs?.length ?? 0) > 0 && (
          <Panel title="Enchufes">
            {data.plugs!.map((p, i) => {
              const want = draft.plugs?.[p.id];
              return (
                <View key={p.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: T.line, paddingTop: i ? 12 : 0, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Image source={OBJ.plug} style={{ width: 30, height: 30 }} />
                    <Txt w="semi" size={16} style={{ flex: 1 }} numberOfLines={1}>
                      {p.name}
                    </Txt>
                  </View>
                  <View accessibilityLabel={`${p.name} en este modo`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Choice text="No tocar" selected={want === undefined} onPress={() => setPlug(p.id, undefined)} />
                    <Choice text="Encender" selected={want === true} onPress={() => setPlug(p.id, true)} />
                    <Choice text="Apagar" selected={want === false} onPress={() => setPlug(p.id, false)} />
                  </View>
                </View>
              );
            })}
          </Panel>
        )}

        {kind === 'party' && (
          <Panel title="Velocidad">
            <Txt size={14} color={T.inkSoft}>
              Cada bombilla va fundiendo por toda la rueda de color, empezando en un color y un sentido al azar. Lo hace la propia bombilla, así que sigue aunque cierres la app.
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPEEDS.map((sp) => (
                <Choice key={sp.v} text={sp.text} selected={(draft.speed ?? 3) === sp.v} onPress={() => setDraft({ ...draft, speed: sp.v })} />
              ))}
            </View>
          </Panel>
        )}

        {kind === 'one' && (
          <>
            {data.bulbs.length > 0 && (
              <Panel title="Copiar la luz que tiene ahora">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {data.bulbs.map((b) => (
                    <Choice key={b.id} text={b.name} selected={false} onPress={() => current(b, (look) => setDraft((d) => ({ ...d, look })))} />
                  ))}
                </View>
              </Panel>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18 }}>
              <Txt w="semi" size={16} style={{ flex: 1 }}>
                {draft.look.on ? 'Enciende las luces' : 'Apaga las luces'}
              </Txt>
              <PillSwitch label="El modo enciende las luces" value={draft.look.on} onChange={(on) => setDraft({ ...draft, look: { ...draft.look, on } })} />
            </View>
            {draft.look.on && <LightControls look={draft.look} onChange={(look) => setDraft((d) => ({ ...d, look }))} />}
          </>
        )}

        {kind === 'each' && (
          <Panel title="La luz de cada una">
            {targets.length === 0 && (
              <Txt size={14} color={T.inkSoft}>
                Elige arriba alguna bombilla.
              </Txt>
            )}
            {targets.map((b) => {
              const look = sceneLookFor(draft as Scene, b.id);
              const expanded = open === b.id;
              return (
                <View key={b.id} style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={`${b.name}: ${describe(look)}. ${expanded ? 'Cerrar' : 'Elegir su luz'}`}
                      onPress={() => setOpen(expanded ? '' : b.id)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: lookCss(look), borderWidth: 3, borderColor: T.bg }} />
                      <View style={{ flex: 1 }}>
                        <Txt w="semi" size={16}>
                          {b.name}
                        </Txt>
                        <Txt size={13} color={T.inkSoft}>
                          {describe(look)}
                        </Txt>
                      </View>
                      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={T.inkSoft} />
                    </Pressable>
                    <PillSwitch label={`${b.name} encendida en este modo`} value={look.on} onChange={(on) => setBulbLook(b.id, { ...look, on })} />
                  </View>
                  {expanded && look.on && (
                    <View style={{ gap: 12 }}>
                      <LightControls look={look} size={240} chip={T.bg} onChange={(l) => setBulbLook(b.id, l)} />
                      <View style={{ flexDirection: 'row' }}>
                        <Choice text="Copiar la que tiene ahora" selected={false} onPress={() => current(b, (l) => setBulbLook(b.id, l))} />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </Panel>
        )}

        <Panel title={`Tele (${data.tv?.name ?? 'Tele'})`}>
          <Txt size={14} color={T.inkSoft}>
            Al poner el modo, la tele abre una app o un vídeo a la vez que cambian las luces. Para un vídeo: ponlo en la tele como siempre (compartiendo desde YouTube) y cópialo aquí.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Choice text="Nada" selected={!draft.tv?.app && !draft.tv?.youtube} onPress={() => setDraft({ ...draft, tv: draft.tv?.ambilight ? { ambilight: true } : undefined })} />
            {TV_APPS.map((a) => (
              <Choice key={a.key} text={a.name} selected={draft.tv?.app === a.key && !draft.tv?.youtube} onPress={() => setDraft({ ...draft, tv: { app: a.key, ambilight: draft.tv?.ambilight } })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt w="semi" size={15}>
                Ambilight a juego
              </Txt>
              <Txt size={13} color={T.inkSoft}>
                Las luces de detrás de la tele, del color del modo
              </Txt>
            </View>
            <PillSwitch
              label="Ambilight a juego"
              value={!!draft.tv?.ambilight}
              onChange={(ambilight) => setDraft({ ...draft, tv: { ...draft.tv, ambilight } })}
            />
          </View>
          {draft.tv?.youtube && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.bg, borderRadius: 18, padding: 10 }}>
              <Image source={{ uri: `https://i.ytimg.com/vi/${draft.tv.youtube}/mqdefault.jpg` }} style={{ width: 96, height: 54, borderRadius: 10 }} />
              <Txt w="semi" size={14} numberOfLines={2} style={{ flex: 1 }}>
                {draft.tv.title || 'Vídeo de YouTube'}
              </Txt>
            </View>
          )}
          <View style={{ flexDirection: 'row' }}>
            <PillButton
              text={copying ? 'Mirando la tele…' : draft.tv?.youtube ? 'Cambiar por lo que se ve ahora' : 'Usar lo que se ve en la tele'}
              icon="television-play"
              kind="secondary"
              loading={copying}
              onPress={async () => {
                setCopying(true);
                try {
                  const now = await tvClient(data.tv).nowPlaying();
                  if (!now) return flash('La tele no tiene YouTube, Netflix ni Prime Video abiertos');
                  if (now.app === 'youtube' && !now.youtube) return flash('YouTube está abierto pero sin ningún vídeo');
                  setDraft((d) => ({ ...d, tv: { ...(now.youtube ? { youtube: now.youtube, title: now.title } : { app: now.app }), ambilight: d.tv?.ambilight } }));
                  flash(now.youtube ? `Copiado: ${now.title ?? 'vídeo de YouTube'}` : `Copiado: ${tvApp(now.app)?.name}`);
                } catch (e) {
                  flash((e as Error).message);
                } finally {
                  setCopying(false);
                }
              }}
            />
          </View>
        </Panel>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
          <PillButton
            text="Guardar"
            icon="check"
            onPress={() => {
              if (!draft.name.trim()) return flash('Ponle un nombre');
              upsertScene({ ...draft, kind, name: draft.name.trim() });
              back();
            }}
          />
          <PillButton
            text="Probar"
            icon="play-outline"
            kind="secondary"
            onPress={() => {
              if (!targets.length && !Object.keys(draft.plugs ?? {}).length) return flash('Elige alguna bombilla o enchufe');
              applyScene({ ...(draft as Scene), id: draft.id ?? '__prueba', kind, name: draft.name.trim() || 'Prueba' });
            }}
          />
          {existing && (
            <PillButton
              text={confirmDelete ? '¿Seguro? Borrar' : 'Borrar'}
              icon="trash-can-outline"
              kind="plain"
              danger
              onPress={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                removeScene(existing.id);
                back();
              }}
            />
          )}
        </View>
      </Pad>
    </ScrollView>
  );
}
