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

`logs` (`false` by default) : logs the transformations in the `terminal`

```js
tslOperatorPlugin({ logs: true })                     // log all files
tslOperatorPlugin({ logs: false })                    // no logging (default)
tslOperatorPlugin({ logs: "MyShader.js" })            // log only this file
tslOperatorPlugin({ logs: ["File1.js", "File2.js"] }) // log only these files
tslOperatorPlugin({ logs: /shader/i })                // log files matching regex
```

<img width="593" alt="Screenshot 2025-02-08 at 12 55 26" src="https://github.com/user-attachments/assets/20861ec1-6c75-4d35-87da-61e3ed8a2ba9" />

Note : The transformation happened only when the file is call by the client or during build ( Vite optimization )

## How it works

The plugin walks your source and selectively transforms code.

It **only** looks inside `Fn(() => { ... })` blocks. Code outside is untouched.

```js
const opacity = uniform(0) // Ignored (Plain JS)

Fn(()=>{
  return opacity * 3 // Transformed to .mul(3)
})
```

> **Note**: Files inside `node_modules` are excluded.

### Smart Detection

The plugin automatically detects when to transform operators.

It uses **context-aware logic** to decide if an expression should be TSL or JavaScript:

- **TSL contexts**: `return`, `select`, `mix`, `If`, `ElseIf`.
- **JS contexts**: `if`, `for`, `while` (keeps standard JS conditions, great for metaprogramming).


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

## About TSL

Official wiki : [Three.js-Shading-Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)

### License

MIT
