import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/barcode.ts',
    'src/qr.ts',
    'src/datamatrix.ts',
    'src/pdf417.ts',
    'src/aztec.ts',
    'src/cli.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
})
