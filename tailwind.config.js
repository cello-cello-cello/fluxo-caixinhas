export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#FF385C',
          soft: '#FFF1F3',
          dark: '#E11D48',
        },
        mint: {
          DEFAULT: '#10B981',
          soft: '#ECFDF5',
          dark: '#059669',
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
