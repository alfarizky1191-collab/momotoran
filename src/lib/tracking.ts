import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

const TASK = 'momotoran-background-location-v1';
const ACTIVE = 'momotoran.tracking.active';
const DELETE = 'momotoran.tracking.delete';
type Target = { group: string; user: string };
let sending = false;
let latest: Location.LocationObject | null = null;
let epoch = 0;
let status = '';

export const trackingMessage = () => status;
async function target(): Promise<Target | null> {
  const saved = await AsyncStorage.getItem(ACTIVE);
  return saved ? JSON.parse(saved) : null;
}
export async function trackingActive(group: string) {
  return (await target())?.group === group && await Location.hasStartedLocationUpdatesAsync(TASK);
}

export async function retryLocationDeletion() {
  const saved = await AsyncStorage.getItem(DELETE);
  if (!saved || !supabase) return;
  const item: Target = JSON.parse(saved);
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== item.user) return;
  const { error } = await supabase.from('live_locations').delete()
    .eq('group_id', item.group).eq('user_id', item.user);
  if (error) throw error;
  if (!sending && await AsyncStorage.getItem(DELETE) === saved) await AsyncStorage.removeItem(DELETE);
}

// At most one request plus one newest point. Never replay a route backlog.
async function publish(point: Location.LocationObject) {
  latest = point;
  if (sending) return;
  sending = true;
  const run = epoch;
  try {
    while (latest && run === epoch) {
      const current = latest;
      latest = null;
      const active = await target();
      if (!active || !supabase) break;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== active.user) {
        await stopTracking();
        break;
      }
      if (run !== epoch) break;
      const { coords } = current;
      const { error } = await supabase.from('live_locations').upsert({
        group_id: active.group, user_id: active.user,
        latitude: coords.latitude, longitude: coords.longitude,
        accuracy: coords.accuracy, speed: coords.speed, heading: coords.heading,
        updated_at: new Date(current.timestamp).toISOString(),
      }, { onConflict: 'group_id,user_id' });
      if (error) throw error;
      status = 'Posisi berhasil dikirim.';
    }
  } catch {
    status = 'Posisi belum terkirim. Periksa koneksi internet.';
    latest = null;
  } finally {
    sending = false;
    // A stopped session must clean up even if its last request finished late.
    if (run !== epoch) await retryLocationDeletion().catch(() => {});
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error) { status = 'GPS bermasalah. Buka aplikasi untuk memeriksa izin lokasi.'; return; }
  const newest = data?.locations?.reduce<Location.LocationObject | null>(
    (best, item) => !best || item.timestamp > best.timestamp ? item : best, null);
  if (newest) await publish(newest);
});

export async function startTracking(group: string, user: string) {
  if (!await TaskManager.isAvailableAsync()) throw new Error('Gunakan build Android Momotoran; tracking background tidak tersedia di sini.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Aktifkan GPS di pengaturan HP.');
  if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') throw new Error('Izin lokasi diperlukan.');
  if ((await Location.requestBackgroundPermissionsAsync()).status !== 'granted') throw new Error('Pilih izin lokasi sepanjang waktu agar tracking berjalan saat layar terkunci.');
  if (await target()) await stopTracking();
  if (sending) throw new Error('Pengiriman sebelumnya sedang diselesaikan. Coba lagi sebentar.');
  await retryLocationDeletion();
  epoch += 1;
  await AsyncStorage.setItem(ACTIVE, JSON.stringify({ group, user }));
  try {
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, distanceInterval: 0,
      deferredUpdatesInterval: 10000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Momotoran — lokasi dibagikan',
        notificationBody: 'Touring tetap dilacak saat layar terkunci. Buka aplikasi untuk berhenti.',
        notificationColor: '#245C45',
        killServiceOnDestroy: true,
      },
    });
    status = 'Tracking aktif, termasuk saat layar terkunci.';
  } catch (error) { await AsyncStorage.removeItem(ACTIVE); throw error; }
}

export async function stopTracking() {
  const active = await target();
  epoch += 1;
  latest = null;
  // Persist deletion intent first so it survives a restart.
  if (active) await AsyncStorage.setItem(DELETE, JSON.stringify(active));
  await AsyncStorage.removeItem(ACTIVE);
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  status = 'Tracking berhenti.';
  try { await retryLocationDeletion(); }
  catch { status = 'GPS berhenti. Hapus posisi akan dicoba lagi saat tersambung.'; }
}
