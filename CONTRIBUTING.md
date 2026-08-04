# Contributing to etiket

Thanks for helping. This document covers the two things that are specific to
this project: how symbologies are verified, and what the code has to look like.

## Getting started

```sh
pnpm install
pnpm test        # lint + typecheck + the whole suite
pnpm dev         # vitest in watch mode
pnpm build       # obuild
```

`pnpm test` is the gate. It must be green before a pull request is ready.

## The one rule that matters: verify against something else

A barcode encoder can be confidently, silently wrong. It produces a symbol, the
tests assert the symbol has the right number of bars, everything looks fine —
and no scanner in the world reads it. That has happened in this repository more
than once: the RM4SCC bar alphabet was invented, MaxiCode's finder pattern
overwrote its own data, Code 39's space character had the wrong pattern for
years. Every one of those passed a full green suite.

So: **a new or changed encoder needs verification against an implementation that
is not this one.** In order of preference:

1. **Decode it back.** `zxing-wasm` (a devDependency) reads QR, Micro QR, rMQR,
   Data Matrix, PDF417, MicroPDF417, Aztec, MaxiCode, Code 128, EAN, UPC,
   Code 39, Code 93, ITF, Codabar, GS1-128 and every GS1 DataBar variant. If a
   decoder exists for your format, use it — see `test/2d-roundtrip.test.ts` and
   `test/1d-roundtrip.test.ts`.

2. **Compare with bwip-js.** For formats no JavaScript decoder implements,
   `test/_bwip.ts` extracts BWIPP's module data — bar/space widths, module
   grids, 4-state bar heights — and `test/bwip-compare.test.ts` compares ours
   against it. This is how Code 16K, Codablock F, DotCode, Han Xin and the
   postal formats are checked.

3. **Say so.** If neither is possible, the encoder must document that in its own
   JSDoc, the way `encodeJABCode` does. An unverifiable encoder that looks like
   the verified ones is the failure mode this whole discipline exists to
   prevent.

When something genuinely diverges from the reference, add it to the `DIVERGENT`
map in `test/bwip-compare.test.ts` with the issue that tracks it. Those entries
run under `it.fails`, so the suite stays green while the defect is known — and
turns red the moment someone fixes the encoder without updating the list.

### Assert on bytes, not strings

Readers guess character sets. A payload of high-range bytes may come back
decoded as Shift-JIS when you meant Latin-1. Compare the decoded **bytes** —
`decodeBytes` in `test/encoders-modes-roundtrip.test.ts` shows the pattern.

## Code conventions

- Pure ESM, no CJS.
- **Zero runtime dependencies.** The CLI's dependencies are bundled into
  `dist/cli.mjs` by a separate build entry; nothing else may import a package.
- TypeScript strict. `pnpm typecheck` runs `tsc --noEmit`.
- Formatting is oxfmt: double quotes, no semicolons. Run `pnpm lint:fix`.
- Linting is oxlint. Zero warnings.
- Tests live flat in `test/`, named after what they cover.
- Internal modules are prefixed with `_`.
- Exports are explicit in `src/index.ts` — no barrel re-exports.

## Coverage

`vitest.config.ts` sets a floor: 95% statements, 90% branches, 97% functions.
Those are a floor to raise, not a target to relax. If a change cannot meet them,
the change needs tests, not a lower threshold.

## Adding a symbology

1. Encoder in `src/encoders/`, returning bars (1D), a boolean matrix (2D) or
   `FourState[]` (postal). Larger encoders get a directory — see
   `src/encoders/datamatrix/` and `src/encoders/hanxin/`.
2. Wire it into `src/_barcode.ts` or `src/_2d.ts`, `src/_png.ts`, `src/_encode.ts`,
   `src/validators/barcode.ts` and `src/_cli.ts`. `test/api-subpaths.test.ts`
   will tell you if an entry point is out of step.
3. Verification tests, per the rule above.
4. A documentation page under `docs/`, and an entry in the README format table.

## Commits and issues

Semantic lowercase prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
`perf:`, `ci:`. Reference the issue in the subject — `fix(#123): …`.

A commit message should say what was wrong and why the change is right, not
restate the diff. The interesting part is usually the failure it prevents.
