# Momotoran

Android-first group touring app built with Expo, React Native, TypeScript, and Supabase.

## MVP scope
- Email/password registration and login
- Create a touring group
- Join with a six-character invite code
- See group members on a map in real time
- Explicitly start and stop foreground location sharing

## Local setup
1. Create a Supabase project.
2. Run `supabase/migrations/202609130001_initial_schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.
4. Run `npm install` and `npm start`.
5. Open the project in Expo Go on Android for foreground location testing.

Never use a `service_role` key in the mobile app. The first milestone tracks location while the app is open, every eight seconds or after roughly 20 meters. Background tracking requires an Expo development build and is deliberately deferred until foreground tracking is verified on real devices.

## Backend verification (2026-09-13)

The initial schema is deployed to the connected Momotoran Supabase project; do not rerun it there. All four tables have RLS enabled. Transactional tests passed for group/profile/location isolation, denied outsider writes, joining by code, and denied updates to another member's location. Test accounts were rolled back.

The security advisor flags `join_touring_group` as an authenticated SECURITY DEFINER RPC. This is intentional: it validates the caller and invitation code, and inserts only that caller's membership. Internal helpers are in the private schema. Invitation attempt rate limiting remains a production hardening task.

Local configuration uses a publishable key in the existing `EXPO_PUBLIC_SUPABASE_ANON_KEY` variable for compatibility. No actual configuration values are committed. Mobile login, confirmation emails, two-device GPS/Realtime, and background tracking still require device verification; database tests are not an end-to-end app test.
