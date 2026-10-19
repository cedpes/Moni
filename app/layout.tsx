import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/lib/context/ThemeContext'

// Polices auto-hébergées (servies depuis le même domaine que l'app) :
// aucune requête vers Google Fonts côté navigateur ni au build.
// Fichiers et licences SIL OFL 1.1 dans app/fonts/.
const manrope = localFont({
  src: './fonts/Manrope-latin-wght.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-manrope',
  fallback: ['system-ui', 'sans-serif'],
})

const bricolage = localFont({
  src: './fonts/BricolageGrotesque-latin-wght.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-bricolage',
  fallback: ['system-ui', 'sans-serif'],
})

// Icônes servies comme fichiers statiques (public/), sans paramètre de cache dans l'URL :
// - PNG 192/512 pour Chrome Android (il n'utilise pas les favicons SVG pour l'écran
//   d'accueil et retombe sinon sur une simple lettre « M ») ;
// - apple-touch-icon 180 px opaque pour iOS.
// L'app est sous /moni (basePath) : les URL explicites doivent l'inclure.
const BASE = '/moni'

export const metadata: Metadata = {
  title: 'Moni',
  description: 'Suivi de budget personnel',
  applicationName: 'Moni',
  manifest: `${BASE}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { url: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { url: `${BASE}/favicon.svg`, type: 'image/svg+xml' },
    ],
    apple: [{ url: `${BASE}/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }],
    shortcut: [`${BASE}/icons/icon-192.png`],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Moni',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D0E11',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${bricolage.variable}`}>
      <head>
        {/* Applique le thème clair avant le premier rendu (évite le flash sombre). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('moni-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased overscroll-none">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
