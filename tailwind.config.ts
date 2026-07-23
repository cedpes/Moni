import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      colors: {
        apple: {
          green: '#34c759',
          orange: '#ff9f0a',
          red: '#ff3b30',
          blue: '#007aff',
          gray: '#86868b',
          lightgray: '#f5f5f7',
          border: '#d1d1d6',
        },
      },
      borderRadius: {
        apple: '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
    },
  },
}

export default config
