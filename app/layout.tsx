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

export const metadata: Metadata = {
  title: 'Moni',
  description: 'Suivi de budget personnel',
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
