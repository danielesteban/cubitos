import path from 'path';
import alias from '@rollup/plugin-alias';
import copy from 'rollup-plugin-copy';
import livereload from 'rollup-plugin-livereload';
import postcss from 'rollup-plugin-postcss';
import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import { terser } from 'rollup-plugin-terser';

const outputPath = path.resolve(__dirname, 'dist');
const production = !process.env.ROLLUP_WATCH;

export default {
  input: path.join(__dirname, 'src', 'app.js'),
  output: {
    dir: outputPath,
    format: 'iife',
  },
  plugins: [
    ...(!production ? [
      alias({
        entries: { 'cubitos': path.join(__dirname, '..', 'dist') },
      }),
    ] : []),
    copy({
      targets: [{ src: 'public/*', dest: 'dist' }],
    }),
    resolve({
      browser: true,
      moduleDirectories: [path.join(__dirname, 'node_modules')],
    }),
    postcss({
      extract: 'app.css',
      minimize: production,
    }),
    ...(production ? [
      terser({ format: { comments: false } }),
    ] : [
      serve({
        contentBase: outputPath,
        port: 8080,
      }),
      livereload({
        watch: outputPath,
        delay: 100,
      }),
    ]),
  ],
  watch: { clearScreen: false },
};
