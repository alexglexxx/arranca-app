/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--arranca-bg)',
        surface: 'rgba(15, 23, 42, 0.78)',
        surface2: 'rgba(30, 41, 59, 0.92)',
        amber: 'var(--arranca-accent)',
        amberDim: 'rgba(250, 204, 21, 0.14)',
        green: 'var(--arranca-success)',
        greenDim: 'rgba(34, 197, 94, 0.16)',
        text: 'var(--arranca-text)',
        textDim: 'var(--arranca-text-muted)',
        border: 'var(--arranca-border)',
        danger: 'var(--arranca-danger)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        field: '12px',
        btn: '14px',
      },
      height: {
        screen: '100dvh',
      },
      minHeight: {
        screen: '100dvh',
      },
      fontSize: {
        xs: ['13px', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
};
