import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../theme';
type Props = TextInputProps & { label: string };
export function FormInput({ label, ...props }: Props) { return <View style={styles.group}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#8B938E" selectionColor={colors.orange} style={styles.input} /></View>; }
const styles = StyleSheet.create({ group: { gap: 7 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' }, input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: 16, fontSize: 16 } });
