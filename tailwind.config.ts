import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0f1115',
        'bg-surface': '#171a21',
        'bg-inset': '#0a0c10',
        'border-primary': '#242a35',
        'border-secondary': '#323a48',
        'accent-blue': '#4db6ac',
        'accent-purple': '#9d50bb',
        'text-primary': '#e0e6ed',
        'text-secondary': '#94a3b8',
        'text-tertiary': '#64748b',
      },
      fontFamily: {
        main: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
