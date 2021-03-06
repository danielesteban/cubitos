import fs from 'fs';
import path from 'path';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';
import wasm from '@rollup/plugin-wasm';
import webWorkerLoader from 'rollup-plugin-web-worker-loader';

const outputPath = path.resolve(__dirname, 'dist');

export default {
  input: path.join(__dirname, 'src', 'module.js'),
  external: ['three'],
  output: {
    file: path.join(outputPath, 'cubitos.js'),
    format: 'esm',
  },
  plugins: [
    copy({
      targets: [
        { src: 'LICENSE', dest: 'dist' },
        { src: 'README.md', dest: 'dist' },
      ],
      copyOnce: !process.env.ROLLUP_WATCH,
    }),
    wasm({
      maxFileSize: Infinity,
    }),
    webWorkerLoader({
      forceInline: true,
      skipPlugins: ['copy', 'wasm'],
    }),
    {
      writeBundle() {
        fs.writeFileSync(path.join(outputPath, 'package.json'), JSON.stringify({
          name: 'cubitos',
          author: 'Daniel Esteban Nombela',
          license: 'MIT',
          module: 'cubitos.js',
          version: '0.0.22',
          repository: {
            type: 'git',
            url: 'https://github.com/danielesteban/cubitos',
          },
          peerDependencies: {
            three: '>=0.142.0',
          },
        }, null, '  '));
      },
    },
    ...(!process.env.ROLLUP_WATCH ? [terser()] : []),
  ],
  watch: { clearScreen: false },
};
