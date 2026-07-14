import Constants from 'expo-constants';

// Public env (EXPO_PUBLIC_*) are available on native and web
const manifest = Constants?.expoConfig ?? (Constants as any).manifest ?? {};

export const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string) ||
  (manifest?.extra?.apiBaseUrl as string) ||
  'https://zabi5545.app.n8n.cloud';

export const CORS_PROXY_URL: string | undefined =
  (process.env.EXPO_PUBLIC_CORS_PROXY as string) ||
  (manifest?.extra?.corsProxy as string) ||
  undefined;


