# Changelog

All notable changes to this project will be documented in this file.

## [1.10.0] - 2026-04-25

### Added
- Added `AGENT.md` with project structure, command, implementation, and release guidance for coding agents.
- Added regression coverage for plain ternary `//@tsl` transforms such as `flag ? a : b`.

### Changed
- Rewrote the README to make installation, setup, supported operators, directives, auto-imports, loop transforms, testing, and related plugin usage clearer.
- Bumped the package minor version to `1.10.0`.
- Changed the plugin's default `logs` option to `false`, matching the documented default and reducing transform noise.

### Improved
- Replaced the broad operator preflight regex with a lightweight source scan that skips quoted strings, comments, and arrow `=>`, avoiding unnecessary Babel work for `Fn()` files without transformable operators.
- Reduced Vitest browser startup noise by pre-including Three.js dependencies and disabling plugin transform logs in tests.
- Updated runtime tests so assignment-operator examples are valid JavaScript before Vite applies the plugin transform.
- Cleaned npm package contents so development-only files, ignored builds, benchmarks, and agent notes are not included in the published tarball.

## [1.9.0] - 2026-04-16

### Added
- **Power operator (`**`)**: `a ** b` transforms to `a.pow(b)` inside `Fn()` blocks. Pure-numeric exponents are preserved.
- **Update expressions (`++`, `--`) under `//@tsl`**: `i++` / `--i` transform to `i.addAssign(1)` / `i.subAssign(1)` only when the statement is annotated with `//@tsl`. Plain JS iterators (`let i = 0; i++`) are preserved.
- **Ternary `a ? b : c` to `select(a, b, c)` under `//@tsl`**: opt-in conditional-to-select transformation. `select` is added to the auto-import set.
- **TypeScript type-wrapper transparency**: `TSAsExpression`, `TSTypeAssertion`, `TSSatisfiesExpression`, `TSNonNullExpression` are now recursed through, so `(a + b) as const` correctly transforms the inner arithmetic.
- **Source maps**: plugin now returns a proper source map via Babel's `sourceMaps: true` + `sourceFileName`.

### Improved
- **Performance**: `do...while` `//@tsl` transform no longer double-traverses the body (one transform, one cloneNode of the result). Redundant `cloneNode` calls in `for`/`while` TSL-loop transforms were dropped.
- **Parser plugin gating**: `typescript` / `jsx` parser plugins are now enabled only for the matching file extension, cutting parse overhead on plain `.js` files.
- **Early exit**: transforms now also bail when no arithmetic/comparison/logical operator is present in the source.
- Large-scenario benchmark improved ~10% end-to-end (pre-sourcemap); net improvement ~5% after enabling source maps.

### Refactored
- Extracted `applyDirective(directive, current)` helper to centralize the `//@tsl` / `//@js` override logic used in `transformExpression` and `transformBody`.
- Added JSDoc on the 5 top-level functions (`isPureNumeric`, `containsTSLOperation`, `transformExpression`, `transformBody`, `TSLOperatorPlugin`).

### Tests
- 301 unit tests (up from 261).
- New coverage: Vite-style IDs (`?raw`, `#frag`), idempotency, TypeScript constructs, optional chaining / nullish coalescing, source map output, auto-import edge cases (aliased, namespace, custom `importSource`, `autoImportMissingTSL: false`), multi-line directive scoping, and all new operators.

## [1.8.2] - 2026-02-21

### Fixed
- `//@js` directive now also suppresses arithmetic operator transformation (`+`, `-`, `*`, `/`, `%`) on the annotated line, in addition to the already-guarded comparison, logical, and unary operators. Previously, `aa/2` on a `//@js`-annotated line would still be transformed to `aa.div(2)`, causing a runtime error when `aa` held a plain JS value (e.g. result of `Math.floor`).

## [1.8.1] - 2026-02-07

### Fixed
- `containsTSLOperation` and `shouldTransformToTSL` now receive `scope` and `pureVars`, fixing incorrect TSL transformations of comparison/logical operators involving pure-numeric variables

### Improved performance

## [1.8.0] - 2026-01-30

### Added
- **Auto-import TSL types**: Plugin now automatically adds missing imports for `float`, `int`, and `Loop` when transformations use them
  - Prevents runtime errors like `THREE.TSL: ReferenceError: float is not defined`
  - Adds to existing `three/tsl` or `three/webgpu` imports when present
  - Creates new import statement if no TSL import exists
- New plugin options:
  - `autoImportMissingTSL` (default: `true`) - Enable/disable automatic import injection
  - `importSource` (default: `'three/tsl'`) - Specify the import source for new imports

### Example
```js
// Input (no float import)
import { Fn, uv } from 'three/tsl'
Fn(() => {
  const coord = 1 - uv()
  return coord
})

// Output (float automatically added)
import { Fn, uv, float } from 'three/tsl'
Fn(() => {
  const coord = float(1).sub(uv())
  return coord
})
```

## [1.7.2] - 2026-01-30

### Fixed
- Pure numeric expressions involving variables now stay untransformed (e.g., `const radius = 0.08; radius * 0.5` stays as-is instead of becoming `float(radius).mul(0.5)`)
- Variables initialized with numeric literals are now recognized as pure numeric values throughout the Fn() scope

### Added
- Extended `isPureNumeric()` to track variable bindings and detect pure numeric identifiers
- Test cases for pure numeric variable detection (tests 208-215)

## [1.7.1] - 2026-01-15

### Added
- Browser runtime tests use operator syntax (non-TSL) to validate plugin transforms in WebGL/WebGPU runs.

### Changed
- Vitest projects now apply the plugin directly with `logs: true`, making transform diffs visible in test output.

### Fixed
- Plugin now handles file ids with query/hash suffixes (e.g. `?v=`) to ensure transforms run in Vite/Vitest browser builds.


## [1.7.0] - 2026-01-15

### Added
- **TSL Loop transformation**: `for`, `while`, and `do...while` loops marked with `//@tsl` now transform to TSL `Loop()` constructs
  - For loops: `for (let i = 0; i < 10; i++)` → `Loop({ start, end, type, condition, name }, ({ i }) => {})`
  - While loops: `while (x < 10)` → `Loop(x.lessThan(10), () => {})`
  - Do-while loops: Transform to IIFE + Loop pattern
  - Automatic `int`/`float` type inference based on loop values

### Enhancement
- Transformation speed improved by ~30%

## [1.6.2] - 2026-01-15

### Added
- Switch statement support: operators inside `switch` cases are now transformed (e.g., `finalColor *= pattern` → `finalColor.mulAssign(pattern)`)

## [1.6.1] - 2026-01-15

### Added
- File-specific logging: `logs` option now accepts string, array, or regex to filter which files log transformations

## [1.6.0] - 2026-01-13

### Added
- **Comparison & Logical operators**: `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==`, `&&`, `||`, `!` now map to TSL methods (e.g. `a > b` → `a.greaterThan(b)`, `a && b` → `a.and(b)`).
- **Context-aware transformation**: Operators transform only in TSL contexts (`return`, `select`, `If`/`ElseIf`, `mix`), preserving standard JS control flow (`if`, `for`).
- **Directive control**: `//@tsl` and `//@js` comments to force or disable transformation on lines or functions.
- Expanded test suite (102 → 216 tests).

### Fixed
- Correct transformation for `mix()` (3rd arg) and chained `.ElseIf()` calls.
- `for`/`while` loop bodies are now properly transformed.


## [1.5.1] - 2026-01-13

### Fixed
- Plugin now correctly returns transformed output when `logs: false`

### Added
- Regression tests for `logs: false` transformation behavior

## [1.5.0] - 2025-01-13

### Fixed
- Multiline code without arithmetic operators is no longer unnecessarily reformatted
- Plugin now returns `null` when no transformation is needed, preventing misleading log output
- Arrays, objects, function calls, and other expressions without operators preserve their original formatting

### Changed
- Expression handlers now return original AST nodes when no transformation occurred, avoiding Babel regeneration artifacts

## [1.4.5] - 2025-12-29

### Fixed
- Pure numeric `(x * y) % z` expressions in function calls are now preserved (e.g., `vec3((1 * 2) % 3)` stays unchanged)
- Standalone numeric literals in arrays, objects, and ternary expressions are no longer wrapped in `float()` (e.g., `[1, 2, 3]` stays as-is, `cond ? 1 : 2` stays as-is)

### Added
- Test cases for numeric literals in arrays, objects, and ternary expressions

## [1.4.4] - 2025-12-28

### Fixed
- Pure numeric expressions inside function calls are now preserved (e.g., `vec3(1.0 / 3.0)` stays as-is instead of becoming `vec3(float(1.0).div(3.0))`)
- Negative numeric literals inside `mat3`/`vec3` calls are now preserved (e.g., `mat3(1.0, -0.5, 0.3)` stays as-is instead of wrapping negatives in `float()`)

### Added
- Test cases for pure numeric expressions in function calls
- Test cases for multiline `mat3` with negative numbers

## [1.4.3] - 2025-01-23
- exclude unecessary file from npm

## [1.4.2] - 2025-01-23

### Fixed
- Fixed incorrect transformation of template literal expressions - simple variables like `inc` in template literals are now preserved without wrapping in `float()`
- Template literals like `` `lms${inc}` `` now correctly remain as-is instead of becoming `` `lms${float(inc)}` ``

### Added
- Added comprehensive test cases for template literal transformations

## [1.4.1] - Previous release

### Fixed
- Added early return optimization if code doesn't include "Fn(" to improve performance
- Updated test suite to account for early return behavior

## [1.4.0] - Previous release

### Added
- Support for if/else statement transformations
- Support for TSL's If/Else constructs
- Comprehensive test coverage for conditional statements

## Previous versions

For changes in earlier versions, please refer to the git commit history.