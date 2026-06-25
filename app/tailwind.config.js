/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)', bg2: 'var(--c-bg2)', card: 'var(--c-card)',
        ink: 'var(--c-ink)', ink2: 'var(--c-ink2)', ink3: 'var(--c-ink3)', line: 'var(--c-line)',
        accent: 'var(--c-accent)', done: 'var(--c-done)', late: 'var(--c-late)', urgent: 'var(--c-urgent)',
      },
      borderRadius: { card: 'var(--r-card)', pill: 'var(--r-pill)' },
      fontFamily: { display: ['var(--f-display)'], body: ['var(--f-body)'] },
    },
  },
  plugins: [],
}
