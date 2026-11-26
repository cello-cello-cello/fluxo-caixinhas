export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1E3A5F',
          soft: '#E9EFF5',
          dark: '#0F2942',
        },
        moss: {
          DEFAULT: '#4A6B53',
          soft: '#EAF1EC',
          dark: '#3A5743',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -20px rgba(15, 23, 42, 0.22)',
        lift: '0 18px 45px -28px rgba(15, 23, 42, 0.42)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
