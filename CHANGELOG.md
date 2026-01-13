# Changelog

All notable changes to this project will be documented in this file.

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