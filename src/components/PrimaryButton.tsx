import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
type Props = { label: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'secondary' | 'quiet'; disabled?: boolean };
export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary' }: Props) {
  const inactive = loading || disabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, inactive && styles.disabled]}>{loading ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.ink} /> : <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.otherLabel]}>{label}</Text>}</Pressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, primary: { backgroundColor: colors.orange }, secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, quiet: { backgroundColor: 'transparent' }, pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 }, label: { fontSize: 16, fontWeight: '700' }, primaryLabel: { color: colors.white }, otherLabel: { color: colors.ink } });
