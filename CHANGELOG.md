# Changelog

All notable changes to this project will be documented in this file.

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