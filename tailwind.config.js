/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F14',
        surface: '#141A22',
        surface2: '#1B232D',
        amber: '#F4A623',
        amberDim: '#4A3A1C',
        green: '#3DD68C',
        greenDim: '#16332A',
        text: '#E8EBEF',
        textDim: '#6B7684',
        border: '#232C37',
        danger: '#E5594B',
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
    },
  },
  plugins: [],
};
