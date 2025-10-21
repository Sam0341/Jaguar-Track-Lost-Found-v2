
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ubBlue: '#003A70',
        ubGold: '#FDB813'
      },
        borderRadius: {
          '2xl': '1.25rem'
        }
    },
  },
  plugins: [],
}
export default config
