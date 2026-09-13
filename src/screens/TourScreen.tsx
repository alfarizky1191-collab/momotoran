import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { PrimaryButton } from '../components/PrimaryButton';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import type { LiveLocation, TouringGroup } from '../types';

type Props = { group: TouringGroup; userId: string; onBack: () => void };
type Member = { user_id: string; role: string; profiles: { display_name: string } | null };

export function TourScreen({ group, userId, onBack }: Props) {
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const alive = useRef(true);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const map = useRef<MapView | null>(null);
  const centered = useRef(false);

  // Invalidate pending permission/watcher callbacks immediately on stop.
  function stopLocal() {
    generation.current += 1;
    watcher.current?.remove();
    watcher.current = null;
    if (alive.current) setSharing(false);
  }

  async function stopSharing() {
    stopLocal();
    setBusy(true);
    try {
      // Wait for an already-started upload before deleting the final point.
      await pending.current;
      const result = await supabase?.from('live_locations').delete()
        .eq('group_id', group.id).eq('user_id', userId);
      if (result?.error) throw result.error;
      setLocations(current => current.filter(point => point.user_id !== userId));
      setMessage('Berbagi berhenti. Posisi terakhir telah dihapus.');
    } catch {
      setMessage('GPS berhenti. Posisi terakhir belum terhapus karena koneksi bermasalah.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    alive.current = true;
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const [positions, roster] = await Promise.all([
          client!.from('live_locations').select('*').eq('group_id', group.id),
          client!.from('group_members').select('user_id,role,profiles(display_name)').eq('group_id', group.id),
        ]);
        if (!alive.current) return;
        if (positions.error || roster.error) {
          // Remove cached locations if access was revoked or refresh fails.
          setLocations([]);
          setMembers([]);
          setMessage('Data grup belum bisa diperbarui. Cek koneksi dan keanggotaanmu.');
          return;
        }
        setLocations(positions.data ?? []);
        setMembers((roster.data ?? []) as unknown as Member[]);
      } catch {
        if (alive.current) setMessage('Koneksi terputus. Mencoba lagi otomatis.');
      } finally { fetching = false; }
    }
    void refresh();
    const channel = client.channel('tour:' + group.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations',
        filter: 'group_id=eq.' + group.id }, () => { void refresh(); })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void refresh();
      });
    // DELETE events cannot be filtered reliably; reconcile snapshots, including roster.
    const interval = setInterval(() => { setNow(Date.now()); void refresh(); }, 10000);
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        stopLocal();
        setMessage('Berbagi dijeda saat aplikasi ditutup. Tekan Mulai untuk melanjutkan.');
      } else void refresh();
    });
    return () => {
      alive.current = false;
      stopLocal();
      clearInterval(interval);
      appState.remove();
      void client.removeChannel(channel);
    };
  }, [group.id, userId]);

  async function startSharing() {
    const client = supabase;
    if (!client || starting.current || watcher.current) return;
    starting.current = true;
    setBusy(true);
    const run = ++generation.current;
    try {
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Aktifkan GPS di pengaturan HP.');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Izinkan lokasi agar posisimu terlihat oleh grup.');
      if (!alive.current || run !== generation.current) return;
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 20 },
        position => {
          // Serialize uploads; discard queued points after stop or unmount.
          pending.current = pending.current.then(async () => {
            if (!alive.current || run !== generation.current) return;
            const { coords } = position;
            const point: LiveLocation = {
              group_id: group.id, user_id: userId, latitude: coords.latitude,
              longitude: coords.longitude, accuracy: coords.accuracy,
              speed: coords.speed, heading: coords.heading,
              updated_at: new Date(position.timestamp).toISOString(),
            };
            const { error } = await client.from('live_locations')
              .upsert(point, { onConflict: 'group_id,user_id' });
            if (error) throw error;
            if (!alive.current || run !== generation.current) return;
            setLocations(current => [...current.filter(item => item.user_id !== userId), point]);
            setMessage('Posisi berhasil dikirim ke grup.');
            if (!centered.current) {
              centered.current = true;
              map.current?.animateToRegion({ ...coords, latitudeDelta: 0.025, longitudeDelta: 0.025 });
            }
          }).catch(() => {
            if (alive.current && run === generation.current)
              setMessage('Posisi belum terkirim. Periksa koneksi; pengiriman berikutnya akan dicoba lagi.');
          });
        },
      );
      if (!alive.current || run !== generation.current) { subscription.remove(); return; }
      watcher.current = subscription;
      setSharing(true);
      setMessage('Menunggu posisi GPS...');
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : 'GPS belum bisa dimulai.');
    } finally {
      starting.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const nameOf = (id: string) => id === userId ? 'Kamu' :
    members.find(member => member.user_id === id)?.profiles?.display_name ?? 'Anggota';
  const ageOf = (point: LiveLocation) => Math.max(0, Math.floor((now - Date.parse(point.updated_at)) / 1000));
  const visible = locations.filter(point => members.some(member => member.user_id === point.user_id));

  return (
    <View style={styles.page}>
      <MapView ref={map} style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude: -6.9175, longitude: 107.6191, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        showsUserLocation={sharing}>
        {visible.map(point => <Marker key={point.user_id}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          title={nameOf(point.user_id)}
          description={'Posisi terakhir: ' + new Date(point.updated_at).toLocaleTimeString('id-ID')}
          pinColor={ageOf(point) > 60 ? colors.muted : point.user_id === userId ? colors.orange : colors.green} />)}
      </MapView>
      <View style={styles.top}>
        <PrimaryButton label="Kembali" variant="secondary" disabled={busy} onPress={async () => { await stopSharing(); onBack(); }} />
        <View style={styles.label}>
          <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.small}>{members.length} anggota · Kode {group.invite_code}</Text>
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.title}>{sharing ? 'GPS aktif' : 'Berbagi lokasi berhenti'}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.small}>{message || 'Lokasimu hanya dibagikan setelah menekan Mulai.'}</Text>
        <ScrollView style={styles.roster}>
          {members.map(member => {
            const point = locations.find(item => item.user_id === member.user_id);
            return <View key={member.user_id} style={styles.member}>
              <Text style={styles.name}>{nameOf(member.user_id)}{member.role === 'leader' ? ' · Leader' : ''}</Text>
              <Text style={styles.small}>{point ? 'Posisi ' + ageOf(point) + ' detik lalu' + (point.accuracy !== null ? ' · ±' + Math.round(point.accuracy) + ' m' : '') : 'Belum membagikan posisi'}</Text>
            </View>;
          })}
        </ScrollView>
        <PrimaryButton label={sharing ? 'Berhenti & hapus posisi' : 'Mulai bagikan lokasi'}
          loading={busy} onPress={sharing ? stopSharing : startSharing} variant={sharing ? 'secondary' : 'primary'} />
        <PrimaryButton label="Bagikan kode grup" variant="quiet" onPress={() => {
          Share.share({ message: 'Gabung touring ' + group.name + ' di Momotoran. Kode: ' + group.invite_code })
            .catch(() => setMessage('Kode belum bisa dibagikan.'));
        }} />
        <Text style={styles.small}>GPS dijeda saat aplikasi tidak aktif. Posisi lama berwarna abu-abu setelah 1 menit.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.sand },
  top: { position: 'absolute', top: 48, left: 16, right: 16, flexDirection: 'row', gap: 10, alignItems: 'center' },
  label: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  panel: { position: 'absolute', left: 14, right: 14, bottom: 24, backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 8, maxHeight: '55%' },
  roster: { maxHeight: 100 },
  member: { paddingVertical: 5, borderBottomColor: colors.line, borderBottomWidth: 1 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '600' },
});
