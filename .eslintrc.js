module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    parser: 'babel-eslint'
  },
  extends: [
    '@nuxtjs',
    'standard',
    'plugin:nuxt/recommended'
  ],
  plugins: ['standard'],
  // add your custom rules here
  rules: {}
}
