import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormInput } from '../components/FormInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login'); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
  async function submit() {
    if (!supabase || !email.trim() || password.length < 6 || (mode === 'register' && (!name.trim() || name.trim().length > 60))) { setMessage('Lengkapi data. Password minimal 6 karakter.'); return; }
    setLoading(true); setMessage('');
    const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
    setLoading(false); if (result.error) setMessage(result.error.message); else if (mode === 'register' && !result.data.session) setMessage('Cek email untuk konfirmasi akun.');
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.brand}><Text style={styles.wordmark}>MOMOTORAN</Text><Text style={styles.title}>{mode === 'login' ? 'Balik ke rombongan.' : 'Mulai jalan bareng.'}</Text><Text style={styles.subtitle}>Satu peta untuk tahu temanmu masih bersama rombongan.</Text></View><View style={styles.form}>{mode === 'register' && <FormInput label="Nama panggilan" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} />}<FormInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" /><FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{message ? <Text style={styles.message}>{message}</Text> : null}<PrimaryButton label={mode === 'login' ? 'Masuk' : 'Daftar'} onPress={submit} loading={loading} /><PrimaryButton label={mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'} variant="quiet" onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }} /></View></ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.sand }, content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 64 }, brand: { marginBottom: 36 }, wordmark: { color: colors.orange, fontSize: 13, fontWeight: '900', letterSpacing: 2.2, marginBottom: 14 }, title: { color: colors.ink, fontSize: 36, lineHeight: 41, fontWeight: '900', letterSpacing: -1.1 }, subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 340 }, form: { gap: 16 }, message: { color: colors.danger, fontSize: 14, lineHeight: 20 } });
