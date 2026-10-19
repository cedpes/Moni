import type { MetadataRoute } from 'next'

// L'application est servie sous /moni (basePath dans next.config.ts) :
// les URL du manifeste doivent l'inclure, Next ne les préfixe pas.
const BASE = '/moni'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Moni',
    short_name: 'Moni',
    description: 'Suivi de budget personnel',
    // Pas de « /moni/ » : Next le redirige (308) vers « /moni » avec une page vide,
    // et iOS, qui lit la page de démarrage pour trouver l'icône, retombait sur un « M ».
    // /moni/budget répond directement (connecté) ou redirige vers /moni/login avec les
    // balises d'icône dans la réponse (déconnecté).
    id: `${BASE}/budget`,
    start_url: `${BASE}/budget`,
    scope: `${BASE}/`,
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#0D0E11',
    theme_color: '#0D0E11',
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
