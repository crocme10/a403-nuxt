/*
 ** TailwindCSS Configuration File
 **
 ** Docs: https://tailwindcss.com/docs/configuration
 ** Default: https://github.com/tailwindcss/tailwindcss/blob/master/stubs/defaultConfig.stub.js
 */
module.exports = {
  theme: {
    fontFamily: {
      display: ['ZillaSlab', 'sans-serif'],
      body: ['ZillaSlab', 'sans-serif'],
      mono: ['Iosevka', 'mono']
    },
    borderWidth: {
      default: '1px',
      0: '0',
      2: '2px',
      4: '4px'
    },
    extend: {
      colors: {
        cyan: '#9cdbff'
      },
      spacing: {
        96: '24rem',
        128: '32rem'
      },
      height: {
        84: '22rem'
      },
      width: {
        '3/2': '150%',
        '4/2': '200%',
        '1/2-screen': '50vw'
      },
      margin: {
        '-fullh': '-100vh'
      }
    }
  },
  variants: {},
  plugins: []
}
