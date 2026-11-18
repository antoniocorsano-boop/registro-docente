// CI-only entrypoint: never alter src/main.tsx or the production build.
import {build} from 'vite';
import {resolve} from 'node:path';
import {renameSync} from 'node:fs';
await build({configFile:resolve('vite.config.ts'),build:{outDir:'dist',emptyOutDir:true,rollupOptions:{input:[
  resolve('tests/browser/fixtures/val01-product-session.html'),
  resolve('tests/browser/fixtures/val01-product-native-diagnostics.html')
]}}});
renameSync('dist/tests/browser/fixtures/val01-product-session.html','dist/index.html');
renameSync('dist/tests/browser/fixtures/val01-product-native-diagnostics.html','dist/diagnostic.html');
