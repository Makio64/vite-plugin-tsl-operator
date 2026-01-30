# vite-plugin-tsl-operator

![Experimental](https://img.shields.io/badge/Experimental-true-orange)

A Vite plugin to let you use `+`, `-`, `*`, `/`, `%`, `+=`, `-=`, `*=`, `/=`, `%=`, `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==`, `&&`, `||`, `!`  with TSL Node in your Threejs project making the code more consise and easy to write, modify & read.

### Supported Operators

| Category | Operators |
|----------|-----------|
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Assignment | `+=`, `-=`, `*=`, `/=`, `%=` |
| Comparison | `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==` |
| Logical | `&&`, `\|\|`, `!` |

### Example

Instead of:

```js
Fn(()=>{
	let x = float(1).sub(alpha.mul(color.r))
	x = x.mul(4)
	return x
})
```

You can now write : 
```js
Fn(()=>{
	let x = 1 - ( alpha * color.r )
	x *= 4
	return x
})
```

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [How it works](#how-it-works)
- [TSL Loop Transformation](#tsl-loop-transformation)
- [About TSL](#about-tsl)
- [License](#license)

## Installation 

```bash
pnpm i vite-plugin-tsl-operator
```

## Usage 

Add the plugin to your Vite config :
```js
import { defineConfig } from 'vite'
import tslOperatorPlugin from 'vite-plugin-tsl-operator'

export default defineConfig({
	//...
  plugins: [
		tslOperatorPlugin({logs:false})
		//.. other plugins
	]
})
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `logs` | `false` | Log transformations to terminal |
| `autoImportMissingTSL` | `true` | Automatically add missing TSL imports (`float`, `int`, `Loop`) |
| `importSource` | `'three/tsl'` | Import source for auto-imports |

### Logging

```js
tslOperatorPlugin({ logs: true })                     // log all files
tslOperatorPlugin({ logs: false })                    // no logging (default)
tslOperatorPlugin({ logs: "MyShader.js" })            // log only this file
tslOperatorPlugin({ logs: ["File1.js", "File2.js"] }) // log only these files
tslOperatorPlugin({ logs: /shader/i })                // log files matching regex
```

<img width="593" alt="Screenshot 2025-02-08 at 12 55 26" src="https://github.com/user-attachments/assets/20861ec1-6c75-4d35-87da-61e3ed8a2ba9" />

### Auto Import

The plugin automatically adds missing imports when transformations require TSL types like `float`, `int`, or `Loop`.

```js
// Before transformation (no float import)
import { Fn, uv } from 'three/tsl'
Fn(() => 1 - uv())

// After transformation (float automatically added)
import { Fn, uv, float } from 'three/tsl'
Fn(() => float(1).sub(uv()))
```

To disable auto-import or use a different import source:

```js
tslOperatorPlugin({ autoImportMissingTSL: false })              // disable auto-import
tslOperatorPlugin({ importSource: 'three/webgpu' })   // use different source
```

Note : The transformation happened only when the file is call by the client or during build ( Vite optimization )

## How it works

The plugin walks your source and selectively transforms code.

It **only** looks inside `Fn(() => { ... })` blocks. Code outside is untouched.

```js
const opacity = uniform(0) // Ignored (Plain JS)

Fn(()=>{
  return opacity * 3 // Transformed to opacity.mul(3)
})
```

> **Note**: Files inside `node_modules` are excluded.

### Smart Detection

The plugin automatically detects when to transform operators.

It uses **context-aware logic** to decide if an expression should be TSL or JavaScript.

**Pure numeric expressions are preserved:**
```js
Fn(() => {
  const radius = 0.08
  const halfRadius = radius * 0.5      // Stays as-is (pure JS math)
  return smoothstep(radius, halfRadius, dist)  // dist is TSL, but radius/halfRadius are numbers
})
```

Variables initialized with numeric literals are recognized as plain JavaScript numbers and won't be transformed when used in arithmetic with other numbers.

### Manual Overrides

If you have an edge case which is not cover by the smart-detection you can use `//@tsl` or `//@js` to force the behavior.

- **`//@tsl`** : Force transformation (useful for custom functions or callbacks).
- **`//@js`** : Disable transformation (keep as plain JS).

Directives apply to the **next line** or the **entire Fn** (if placed at the top).

```js
//@tsl
Fn(() => {
  customNode( a > b ) // → customNode( a.greaterThan(b) )
})

Fn(() => {
  //@js
  const test = x + y  // will not transform

  const test = x + y  // will transform to x.add(y)
})
```

### TSL Loop Transformation

Use `//@tsl` before `for`, `while`, or `do...while` loops to transform them into TSL `Loop()` constructs.

**For Loop:**
```js
Fn(() => {
  //@tsl
  for (let i = 0; i < 10; i++) {
    sum += value
  }
})
// Transforms to:
// Loop({ start: int(0), end: int(10), type: "int", condition: "<", name: "i" }, ({ i }) => {
//   sum.addAssign(value)
// })
```

**While Loop:**
```js
Fn(() => {
  //@tsl
  while (x < 10) {
    x += 1
  }
})
// Transforms to:
// Loop(x.lessThan(10), () => {
//   x.addAssign(1)
// })
```

**Do-While Loop:**
```js
Fn(() => {
  //@tsl
  do {
    x += 1
  } while (x < 10)
})
// Transforms to an IIFE (executes body once) + Loop
```

> **Note**: The plugin automatically infers `int` or `float` type based on the loop values.

## About TSL

Official wiki : [Three.js-Shading-Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)

### License

MIT
