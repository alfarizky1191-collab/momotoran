import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './src/screens/AuthScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { TourScreen } from './src/screens/TourScreen';
import { colors } from './src/theme';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import type { TouringGroup } from './src/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeGroup, setActiveGroup] = useState<TouringGroup | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setActiveGroup(null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <View style={styles.centered}><StatusBar style="dark" /><Text style={styles.eyebrow}>MOMOTORAN</Text><Text style={styles.title}>Hubungkan Supabase untuk mulai.</Text><Text style={styles.body}>Salin .env.example menjadi .env, lalu isi URL dan anon key project Supabase.</Text></View>;
  }
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={colors.orange} /></View>;

  return <><StatusBar style="dark" />{!session ? <AuthScreen /> : activeGroup ? <TourScreen group={activeGroup} userId={session.user.id} onBack={() => setActiveGroup(null)} /> : <GroupsScreen session={session} onOpenGroup={setActiveGroup} />}</>;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.sand },
  eyebrow: { color: colors.orange, fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12 },
});
