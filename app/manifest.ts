import type { MetadataRoute } from 'next'

// L'application est servie sous /moni (basePath dans next.config.ts) :
// les URL du manifeste doivent l'inclure, Next ne les préfixe pas.
const BASE = '/moni'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Moni',
    short_name: 'Moni',
    description: 'Suivi de budget personnel',
    // Page de démarrage qui répond toujours 200 sans redirection (comme l'app
    // domotique, dont l'icône fonctionne) : iOS lit cette page pour trouver l'icône
    // et retombait sur un « M » avec « /moni/ » (308) puis « /moni/budget » (307).
    // Connecté, la page de connexion renvoie aussitôt vers le Budget.
    id: `${BASE}/login`,
    start_url: `${BASE}/login`,
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
