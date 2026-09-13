# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Momotoran project rules
- Never commit credentials, `.env` values, API secrets, service-role keys, passwords, signing keys, or private certificates.
- Only public client configuration may use `EXPO_PUBLIC_`. Never expose a Supabase service-role key to the app.
- Enforce group access with Supabase RLS. Client-side filtering is not a security boundary.
- Location sharing must be explicit, visible, and easy to stop.
- Prefer clear mobile UI with large touch targets and restrained visual effects.
- Update relevant documentation when architecture, setup, security, or behavior changes.
