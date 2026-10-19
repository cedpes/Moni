import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'

// Origine de l'API PocketBase (ex. https://hacpe.duckdns.org/moni-api → https://hacpe.duckdns.org).
// Ajoutée à connect-src si elle diffère de l'origine de l'app.
function pocketbaseOrigin(): string {
  try { return new URL(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? '').origin } catch { return '' }
}

// Pas de "upgrade-insecure-requests" ni de HSTS ici : l'app reste joignable en HTTP sur le LAN.
// HSTS se configure au niveau du reverse proxy (Nginx Proxy Manager) pour le domaine public.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${pocketbaseOrigin()}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

const nextConfig: NextConfig = {
  basePath: '/moni',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
