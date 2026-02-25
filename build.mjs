import * as esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/index.js',
  sourcemap: true,
  external: [
    // Node built-ins — keep out of bundle
    'fs', 'path', 'os', 'net', 'crypto', 'stream', 'events', 'http', 'https', 'url', 'util',
    'child_process', 'tls', 'zlib', 'assert', 'buffer',
  ],
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete: dist/index.js');
}
