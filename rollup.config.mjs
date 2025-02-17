import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const config = {
  input: 'src/adapter.mjs',
  output: [
    {
      dir: 'dist',
      format: 'esm',
      entryFileNames: 'index.mjs',
      sourcemap: true
    },
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: 'index.cjs.js',
      sourcemap: true
    }
  ],
  plugins: [resolve(), commonjs()],
  external: ['casbin', 'mssql']
}

export default config
