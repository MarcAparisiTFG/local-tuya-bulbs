import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Input } from 'panelui-native';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useBulb } from '../bulbs';
import { Txt } from '../components/Txt';
import { Choice, Pad, Panel, PillButton, Screen } from '../components/ui';
import { OBJ } from '../objects';
import { planRoom, ROOMS } from '../plan';
import { useApp } from '../state';
import { T } from '../theme';
import { discover } from '../tuya/discovery';
import { bridgeHost, getMode, importFromMac } from '../tuya/mode';

export default function Settings() {
  const { data, setTv, setHub, upsertBulb, removeBulb, upsertPlug, removePlug, importDevices, updateIps, flash } = useApp();
  const plugs = data.plugs ?? [];
  const [json, setJson] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState('');
  const [newBulb, setNewBulb] = useState({ id: '', name: '', ip: '', key: '' });
  const [mac, setMac] = useState(() => (bridgeHost() === 'localhost' ? '' : bridgeHost()));
  const [code, setCode] = useState('');
  const [bringing, setBringing] = useState(false);

  const bring = async () => {
    if (!mac.trim() || code.trim().length !== 6) return flash('Escribe la IP del puente y el código de 6 cifras');
    setBringing(true);
    try {
      const got = await importFromMac(mac, code);
      const r = importDevices(JSON.stringify(got.bulbs), got.plugs);
      if (got.tv) setTv({ ...data.tv, name: data.tv?.name ?? 'Tele', ...got.tv });
      setHub(mac.trim());
      flash(`${r.added} nuevas · ${r.updated} actualizadas${got.tv ? ' · tele emparejada' : ''}`);
      setCode('');
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBringing(false);
    }
  };
  const plain = { autoCapitalize: 'none', autoCorrect: false } as const;

  const search = async () => {
    setSearching(true);
    const found = await discover(6000);
    setSearching(false);
    const { updated, unknown } = updateIps(found);
    flash(found.length ? `${found.length} vistas · ${updated} IP actualizadas · ${unknown} sin añadir` : 'No he visto ninguna (¿mismo Wi-Fi?)');
  };

  return (
    <Screen>
      {/* Ajustes se abre encima del inicio (con el engranaje): se vuelve con la flecha */}
      <Pad style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver al inicio" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={T.ink} />
        </Pressable>
      </Pad>

      <Pad style={{ gap: 16 }}>
        <Panel title={`Bombillas (${data.bulbs.length})`}>
          <View style={{ flexDirection: 'row' }}>
            <PillButton text="Buscar en la red" icon="radar" kind="secondary" loading={searching} onPress={search} />
          </View>
          {data.bulbs.map((b) => (
            <View key={b.id} style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12, gap: 10 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === b.id }} onPress={() => setOpen(open === b.id ? '' : b.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={OBJ.bulb} style={{ width: 36, height: 36 }} />
                <View style={{ flex: 1 }}>
                  <Txt w="semi" size={16}>
                    {b.name}
                  </Txt>
                  <Txt size={13} color={T.inkSoft} numberOfLines={1}>
                    {[b.room, b.ip].filter(Boolean).join(' · ') || 'Sin IP'}
                  </Txt>
                </View>
                <MaterialCommunityIcons name={open === b.id ? 'chevron-up' : 'chevron-down'} size={22} color={T.inkSoft} />
              </Pressable>
              {open === b.id && (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input label="Nombre" value={b.name} onChangeText={(name) => upsertBulb({ id: b.id, name })} />
                    </View>
                  </View>
                  <Txt w="semi" size={14} color={T.inkSoft}>
                    Habitación
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ROOMS.map((r) => (
                      <Choice key={r.id} text={r.name} selected={planRoom(b.room)?.id === r.id} onPress={() => upsertBulb({ id: b.id, room: r.name, pos: undefined })} />
                    ))}
                    <Choice text="Ninguna" selected={!planRoom(b.room)} onPress={() => upsertBulb({ id: b.id, room: '', pos: undefined })} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input label="IP" value={b.ip} {...plain} onChangeText={(ip) => upsertBulb({ id: b.id, ip })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label="Clave local" value={b.key} secureTextEntry {...plain} onChangeText={(key) => upsertBulb({ id: b.id, key })} />
                    </View>
                  </View>
                  <Txt size={12} color={T.inkSoft} numberOfLines={1}>
                    ID: {b.id}
                  </Txt>
                  <View style={{ flexDirection: 'row' }}>
                    <PillButton
                      text={confirm === b.id ? '¿Seguro? Quitar' : 'Quitar bombilla'}
                      icon="trash-can-outline"
                      kind="plain"
                      danger
                      onPress={() => (confirm === b.id ? (removeBulb(b.id), setConfirm('')) : setConfirm(b.id))}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Panel>

        {plugs.length > 0 && (
          <Panel title={`Enchufes (${plugs.length})`}>
            {[...new Set(plugs.map((p) => p.devId))].map((devId) => (
              <PlugWatts key={devId} devId={devId} names={plugs.filter((p) => p.devId === devId).map((p) => p.name)} />
            ))}
            {plugs.map((p) => (
              <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12, gap: 10 }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === p.id }} onPress={() => setOpen(open === p.id ? '' : p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={OBJ.plug} style={{ width: 36, height: 36 }} />
                  <View style={{ flex: 1 }}>
                    <Txt w="semi" size={16}>
                      {p.name}
                    </Txt>
                    <Txt size={13} color={T.inkSoft} numberOfLines={1}>
                      {[p.room, `toma ${p.dp}`, p.ip].filter(Boolean).join(' · ')}
                    </Txt>
                  </View>
                  <MaterialCommunityIcons name={open === p.id ? 'chevron-up' : 'chevron-down'} size={22} color={T.inkSoft} />
                </Pressable>
                {open === p.id && (
                  <View style={{ gap: 10 }}>
                    <Input label="Nombre" value={p.name} onChangeText={(name) => upsertPlug({ id: p.id, name })} />
                    <Txt w="semi" size={14} color={T.inkSoft}>
                      Habitación
                    </Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {ROOMS.map((r) => (
                        <Choice key={r.id} text={r.name} selected={planRoom(p.room)?.id === r.id} onPress={() => upsertPlug({ id: p.id, room: r.name, pos: undefined })} />
                      ))}
                      <Choice text="Ninguna" selected={!planRoom(p.room)} onPress={() => upsertPlug({ id: p.id, room: '', pos: undefined })} />
                    </View>
                    <Input label="IP del enchufe" value={p.ip} {...plain} onChangeText={(ip) => plugs.filter((x) => x.devId === p.devId).forEach((x) => upsertPlug({ id: x.id, ip }))} />
                    <Txt size={12} color={T.inkSoft} numberOfLines={1}>
                      ID: {p.devId} · protocolo {p.version ?? '3.3'}
                    </Txt>
                    <View style={{ flexDirection: 'row' }}>
                      <PillButton
                        text={confirm === p.id ? '¿Seguro? Quitar' : 'Quitar toma'}
                        icon="trash-can-outline"
                        kind="plain"
                        danger
                        onPress={() => (confirm === p.id ? (removePlug(p.id), setConfirm('')) : setConfirm(p.id))}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </Panel>
        )}

        {/* en la app compilada las claves no van dentro: se traen una vez del puente */}
        {getMode() === 'native' && (
          <Panel title="Traer del puente">
            <Txt size={14} color={T.inkSoft}>
              En el ordenador del puente, ábrelo (npm run bridge): te dice su IP y un código de 6 cifras. Escríbelos aquí y se copian todas las bombillas y enchufes con sus claves.
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 3 }}>
                {/* el teclado decimal en español trae coma y no punto: se usa el de números y signos, y una coma vale como punto */}
                <Input label="IP del puente" value={mac} placeholder="192.168.1.50" keyboardType="numbers-and-punctuation" {...plain} onChangeText={(t) => setMac(t.replace(/,/g, '.'))} />
              </View>
              <View style={{ flex: 2 }}>
                <Input label="Código" value={code} placeholder="000000" keyboardType="number-pad" maxLength={6} {...plain} onChangeText={setCode} />
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <PillButton text="Traer del puente" icon="laptop" loading={bringing} onPress={bring} />
            </View>
          </Panel>
        )}

        <Panel title="Importar bombillas y enchufes">
          <Txt size={14} color={T.inkSoft}>
            Pega el contenido de devices.json: lo crea tinytuya wizard con todas tus bombillas y enchufes de una vez.
          </Txt>
          <Input label="devices.json" value={json} onChangeText={setJson} multiline numberOfLines={5} {...plain} className="min-h-[120px]" />
          <View style={{ flexDirection: 'row' }}>
            <PillButton
              text="Importar"
              icon="tray-arrow-down"
              onPress={() => {
                const r = importDevices(json);
                if (r.skipped === -1) return flash('Eso no es un JSON válido');
                flash(`${r.added} nuevas · ${r.updated} actualizadas · ${r.skipped} descartadas`);
                if (r.added || r.updated) setJson('');
              }}
            />
          </View>
        </Panel>

        <Panel title="Añadir una a mano">
          <Input label="ID de la bombilla" value={newBulb.id} {...plain} onChangeText={(id) => setNewBulb({ ...newBulb, id })} />
          <Input label="Nombre" value={newBulb.name} onChangeText={(name) => setNewBulb({ ...newBulb, name })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input label="IP (opcional)" value={newBulb.ip} {...plain} onChangeText={(ip) => setNewBulb({ ...newBulb, ip })} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Clave local" value={newBulb.key} secureTextEntry {...plain} onChangeText={(key) => setNewBulb({ ...newBulb, key })} />
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <PillButton
              text="Añadir"
              icon="plus"
              kind="secondary"
              onPress={() => {
                if (!newBulb.id.trim() || newBulb.key.length !== 16) return flash('Hace falta el ID y la clave local (16 caracteres)');
                upsertBulb({ ...newBulb, id: newBulb.id.trim(), name: newBulb.name || 'Bombilla' });
                setNewBulb({ id: '', name: '', ip: '', key: '' });
                flash('Añadida');
              }}
            />
          </View>
        </Panel>
      </Pad>
    </Screen>
  );
}

/** Lo que gasta ahora un enchufe entero: lo mide él, para todas sus tomas juntas. */
function PlugWatts({ devId, names }: { devId: string; names: string[] }) {
  const { watts, state } = useBulb(devId);
  if (state !== 'ok' || watts === undefined) return null;
  return (
    <Txt size={14} color={T.inkSoft}>
      {names.join(' + ')}: {watts.toLocaleString('es-ES', { maximumFractionDigits: 1 })} W ahora
    </Txt>
  );
}
