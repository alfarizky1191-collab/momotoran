import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Momotoran',
  slug: 'al135',
  owner: 'alfa135s-team',
  plugins: [
    ...(config.plugins ?? []),
    ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY ? [
      ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }] as [string, Record<string, string>],
    ] : []),
  ],
});
