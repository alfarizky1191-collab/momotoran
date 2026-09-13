import { startTracking, stopTracking, trackingActive, trackingMessage, retryLocationDeletion } from '../lib/tracking';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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
  const [currentGroup, setCurrentGroup] = useState(group);
  const starting = useRef(false);
  const alive = useRef(true);
  const map = useRef<MapView | null>(null);
  const centered = useRef(false);

  async function stopSharing() {
    setBusy(true);
    try {
      await stopTracking();
      setSharing(false);
      setMessage(trackingMessage());
    } catch { setMessage('Belum bisa menghentikan layanan GPS. Coba lagi.'); }
    finally { setBusy(false); }
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
        const detail = await client!.from('touring_groups').select('*').eq('id', group.id).maybeSingle();
        if (alive.current && detail.data) setCurrentGroup(detail.data);
        if (!roster.data?.some(member => member.user_id === userId) || detail.data?.status === 'finished') {
          if (await trackingActive(group.id)) await stopTracking();
          if (alive.current) setSharing(false);
        }
      } catch {
        if (alive.current) setMessage('Koneksi terputus. Mencoba lagi otomatis.');
      } finally { fetching = false; }
    }
    void refresh();
    void trackingActive(group.id).then(setSharing).catch(() => {});
    void retryLocationDeletion().catch(() => {});
    const channel = client.channel('tour:' + group.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations',
        filter: 'group_id=eq.' + group.id }, () => { void refresh(); })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void refresh();
      });
    // DELETE events cannot be filtered reliably; reconcile snapshots, including roster.
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      setNow(Date.now());
      void refresh();
      setMessage(trackingMessage());
      void retryLocationDeletion().catch(() => {});
      void trackingActive(group.id).then(setSharing).catch(() => {});
    }, 10000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refresh();
        void trackingActive(group.id).then(setSharing).catch(() => {});
        void retryLocationDeletion().catch(() => {});
      }
    });
    return () => {
      alive.current = false;
      clearInterval(interval);
      appState.remove();
      void client.removeChannel(channel);
    };
  }, [group.id, userId]);

  function startSharing() {
    if (currentGroup.status === 'finished') { setMessage('Touring sudah selesai.'); return; }
    Alert.alert('Bagikan lokasi saat touring',
      'Momotoran akan membagikan lokasi kepada grup meskipun layar terkunci. Pilih izin sepanjang waktu. Notifikasi akan tampil selama tracking aktif.',
      [{ text: 'Batal', style: 'cancel' }, { text: 'Lanjut', onPress: async () => {
        if (starting.current) return;
        starting.current = true;
        setBusy(true);
        try {
          await startTracking(group.id, userId);
          setSharing(true);
          setMessage(trackingMessage());
        } catch (error) { setMessage(error instanceof Error ? error.message : 'GPS belum bisa dimulai.'); }
        finally { starting.current = false; setBusy(false); }
      } }]);
  }

  const nameOf = (id: string) => id === userId ? 'Kamu' :
    members.find(member => member.user_id === id)?.profiles?.display_name ?? 'Anggota';
  const ageOf = (point: LiveLocation) => Math.max(0, Math.floor((now - Date.parse(point.updated_at)) / 1000));
  const visible = locations.filter(point => ageOf(point) <= 120 && members.some(member => member.user_id === point.user_id));

  function manage(action: 'leave' | 'remove' | 'finish' | 'invite', memberId?: string) {
    Alert.alert('Konfirmasi', action === 'remove' ? 'Keluarkan anggota dan ganti kode undangan?' : action === 'finish' ? 'Selesaikan touring dan hapus lokasi grup?' : action === 'invite' ? 'Ganti kode undangan? Kode lama tidak berlaku lagi.' : 'Keluar dari grup?',
      [{ text: 'Batal', style: 'cancel' }, { text: 'Lanjut', onPress: async () => {
        setBusy(true);
        try {
          if (action === 'leave' || action === 'finish') await stopTracking();
          const result = await supabase!.rpc('manage_touring_group', {
            target_group: group.id, action, member_id: memberId ?? userId,
          });
          if (result.error) throw result.error;
          if (action === 'leave' || action === 'finish') onBack();
          else {
            const next = await supabase!.from('touring_groups').select('*').eq('id', group.id).single();
            if (next.data) setCurrentGroup(next.data);
            setMessage('Grup diperbarui.');
          }
        } catch { setMessage('Grup belum berhasil diperbarui. Coba lagi.'); }
        finally { setBusy(false); }
      } }]);
  }

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
        <PrimaryButton label="Kembali" variant="secondary" disabled={busy} onPress={onBack} />
        <View style={styles.label}>
          <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.small}>{members.length} anggota · Kode {currentGroup.invite_code}</Text>
        </View>
      </View>
      <ScrollView style={styles.panel} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
        <Text style={styles.title}>{sharing ? 'GPS aktif' : 'Berbagi lokasi berhenti'}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.small}>{message || 'Lokasimu hanya dibagikan setelah menekan Mulai.'}</Text>
        <ScrollView style={styles.roster}>
          {members.map(member => {
            const point = locations.find(item => item.user_id === member.user_id);
            return <View key={member.user_id} style={styles.member}>
              <Text style={styles.name}>{nameOf(member.user_id)}{member.role === 'leader' ? ' · Leader' : ''}</Text>
              {group.owner_id === userId && member.user_id !== userId &&
                <PrimaryButton label="Keluarkan" variant="quiet" disabled={busy}
                  onPress={() => manage('remove', member.user_id)} />}
              <Text style={styles.small}>{point ? 'Posisi ' + ageOf(point) + ' detik lalu' + (point.accuracy !== null ? ' · ±' + Math.round(point.accuracy) + ' m' : '') : 'Belum membagikan posisi'}</Text>
            </View>;
          })}
        </ScrollView>
        <PrimaryButton label={sharing ? 'Berhenti & hapus posisi' : 'Mulai bagikan lokasi'}
          loading={busy} onPress={sharing ? stopSharing : startSharing} variant={sharing ? 'secondary' : 'primary'} />
        <PrimaryButton label="Bagikan kode grup" variant="quiet" onPress={() => {
          Share.share({ message: 'Gabung touring ' + group.name + ' di Momotoran. Kode: ' + currentGroup.invite_code })
            .catch(() => setMessage('Kode belum bisa dibagikan.'));
        }} />
        {group.owner_id === userId ? <>
          <PrimaryButton label="Ganti kode undangan" variant="quiet" disabled={busy} onPress={() => manage('invite')} />
          <PrimaryButton label="Selesaikan touring" variant="quiet" disabled={busy} onPress={() => manage('finish')} />
        </> : <PrimaryButton label="Keluar grup" variant="quiet" disabled={busy} onPress={() => manage('leave')} />}
        <Text style={styles.small}>Tracking tetap aktif saat layar terkunci. Tekan Berhenti untuk mengakhiri berbagi.</Text>
      </ScrollView>
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
