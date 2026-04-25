# Agent Guide

This repository contains a Vite plugin that rewrites JavaScript operators inside Three.js TSL `Fn()` blocks into TSL node method calls.

## Project Shape

- Main implementation: `src/index.js`
- Unit transform tests: `test/index.test.js`
- Browser/runtime tests: `test/runtime.test.js`
- Benchmark helper: `bench/profile.js`
- Release notes: `CHANGELOG.md`

## Common Commands

```bash
pnpm install
pnpm test
pnpm test:unit
pnpm test:browser
node bench/profile.js
```

`npm run build` copies `src/index.js` to `dist/index.js`, but the package currently points `main` at `src/index.js`.

## Implementation Notes

- Transform only direct `Fn(() => ...)` calls.
- Keep non-TSL JavaScript untouched unless a `//@tsl` directive opts in.
- Respect `//@js` as an escape hatch for the next statement.
- Preserve pure numeric math and `Math.*` expressions where possible.
- Add tests for both transformed output and idempotency when changing transform behavior.
- Keep the fast early-return path cheap; most files in a Vite app should return `null`.

## Release Checklist

1. Update `package.json` version.
2. Add a top entry to `CHANGELOG.md`.
3. Run `pnpm test:unit`.
4. Run `pnpm test` before release when browser dependencies are available.
5. Run `npm pack --dry-run` and inspect included files.
