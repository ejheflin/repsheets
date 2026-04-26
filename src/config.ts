export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? ''
export const SCOPES = 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata'
// Increment when SCOPES changes so existing sessions get re-consented
export const SCOPE_VERSION = 2
export const THEME_COLOR = '#1a1a2e'
export const AUTH_WORKER_URL = import.meta.env.VITE_AUTH_WORKER_URL ?? ''
export const TEMPLATE_SHEET_ID = '18HbgU-OME4_XUDrmku_3Kr33USunYGH2JOZS2kySixg'
