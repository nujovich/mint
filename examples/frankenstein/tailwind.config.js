/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx,vue}',
    './components/**/*.{html,js,jsx,ts,tsx,vue}',
    './pages/**/*.{html,js,jsx,ts,tsx,vue}',
    './app/**/*.{html,js,jsx,ts,tsx,vue}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#1976d2',
          600: '#1565c0',
          700: '#0d47a1',
          800: '#0a3f8f',
          900: '#08357d',
          DEFAULT: '#1976d2'
        },
        error: {
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#e53935',
          600: '#d32f2f',
          700: '#c62828',
          800: '#b71c1c',
          900: '#a01818',
          DEFAULT: '#e53935'
        },
        background: {
          50: '#fefefe',
          100: '#fdfdfd',
          200: '#fafafa',
          300: '#f7f7f7',
          400: '#f6f6f6',
          500: '#f5f5f5',
          600: '#e8e8e8',
          700: '#d4d4d4',
          800: '#c0c0c0',
          900: '#a8a8a8',
          DEFAULT: '#f5f5f5'
        },
        text: {
          50: '#f5f5f5',
          100: '#e0e0e0',
          200: '#bdbdbd',
          300: '#9e9e9e',
          400: '#757575',
          500: '#212121',
          600: '#1e1e1e',
          700: '#1a1a1a',
          800: '#171717',
          900: '#141414',
          DEFAULT: '#212121'
        },
        border: {
          50: '#f9f9f9',
          100: '#f4f4f4',
          200: '#eeeeee',
          300: '#e7e7e7',
          400: '#e2e2e2',
          500: '#dddddd',
          600: '#c7c7c7',
          700: '#a8a8a8',
          800: '#8a8a8a',
          900: '#6c6c6c',
          DEFAULT: '#dddddd'
        },
        surface: {
          50: '#ffffff',
          100: '#ffffff',
          200: '#ffffff',
          300: '#ffffff',
          400: '#ffffff',
          500: '#ffffff',
          600: '#e6e6e6',
          700: '#cccccc',
          800: '#b3b3b3',
          900: '#999999',
          DEFAULT: '#ffffff'
        },
        muted: {
          50: '#f2f2f2',
          100: '#e0e0e0',
          200: '#cccccc',
          300: '#b3b3b3',
          400: '#8c8c8c',
          500: '#666666',
          600: '#5c5c5c',
          700: '#4d4d4d',
          800: '#404040',
          900: '#333333',
          DEFAULT: '#666666'
        }
      },
      fontFamily: {
        display: ['Helvetica Neue', 'sans-serif'],
        body: ['Helvetica Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }]
      },
      fontWeight: {
        bold: '700',
        extrabold: '800'
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '5': '20px',
        '6': '24px'
      },
      borderRadius: {
        sm: '4px',
        md: '8px'
      },
      boxShadow: {
        sm: '0 2px 4px rgba(0,0,0,0.1)'
      }
    }
  },
  safelist: [
    'bg-primary-500',
    'bg-primary-600',
    'bg-error-500',
    'bg-background-500',
    'bg-surface-500',
    'text-primary-500',
    'text-error-500',
    'text-text-500',
    'text-muted-500',
    'border-border-500',
    'border-primary-500',
    'rounded-sm',
    'rounded-md',
    'shadow-sm',
    'p-1',
    'p-2',
    'p-3',
    'p-5',
    'p-6',
    'm-1',
    'm-2',
    'm-3',
    'm-5',
    'm-6',
    'font-bold',
    'font-extrabold'
  ],
  plugins: []
}
