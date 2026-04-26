# vite-plugin-tsl-operator

![Experimental](https://img.shields.io/badge/Experimental-true-orange)

Use normal JavaScript operators like `+`, `-`, `*`, `/`, `%`, `**`, `+=`, `>`, `&&`, and `!` directly inside Three.js TSL `Fn()` blocks.

`vite-plugin-tsl-operator` is a plug-and-play Vite plugin for Three.js Shading Language (TSL), WebGPU, and shader node projects. It rewrites readable operator syntax to TSL node methods during Vite transforms, so you can write shader logic naturally without hand-chaining `.add()`, `.mul()`, `.greaterThan()`, and friends.

## Operators At A Glance

| Category | Operators |
| --- | --- |
| Arithmetic | `+`, `-`, `*`, `/`, `%`, `**` |
| Assignment | `+=`, `-=`, `*=`, `/=`, `%=` |
| Comparison | `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==` |
| Logical | `&&`, `\|\|`, `!` |
| Opt-in with `//@tsl` | `i++`, `--i`, `a ? b : c` |

## Quick Example

Instead of writing chained TSL methods:

```js
Fn(() => {
  let x = float(1).sub(alpha.mul(color.r))
  x = x.mul(4)
  return x
})
```

you can write normal JavaScript-style math:

```js
Fn(() => {
  let x = 1 - alpha * color.r
  x *= 4
  return x
})
```

The plugin transforms it for you.

```js
import { Fn, float } from 'three/tsl'

const shader = Fn(() => {
  const strength = float(0.8)
  return 1 - strength * color.r
})
```

becomes:

```js
import { Fn, float } from 'three/tsl'

const shader = Fn(() => {
  const strength = float(0.8)
  return float(1).sub(strength.mul(color.r))
})
```

## Install And Use

```bash
pnpm add vite-plugin-tsl-operator
```

```bash
npm install vite-plugin-tsl-operator
```

```bash
yarn add vite-plugin-tsl-operator
```

Add it to `vite.config.js` and start writing operators inside `Fn()` blocks. No Babel config, no runtime setup, and no code changes outside your Vite plugins array.

```js
import { defineConfig } from 'vite'
import tslOperatorPlugin from 'vite-plugin-tsl-operator'

export default defineConfig({
  plugins: [
    tslOperatorPlugin(),
  ],
})
```

## Transform Reference

| Category | Input | Output |
| --- | --- | --- |
| Arithmetic | `a + b` | `a.add(b)` |
| Arithmetic | `a - b` | `a.sub(b)` |
| Arithmetic | `a * b` | `a.mul(b)` |
| Arithmetic | `a / b` | `a.div(b)` |
| Arithmetic | `a % b` | `a.mod(b)` |
| Arithmetic | `a ** b` | `a.pow(b)` |
| Assignment | `a += b` | `a.addAssign(b)` |
| Assignment | `a -= b` | `a.subAssign(b)` |
| Assignment | `a *= b` | `a.mulAssign(b)` |
| Assignment | `a /= b` | `a.divAssign(b)` |
| Assignment | `a %= b` | `a.modAssign(b)` |
| Comparison | `a > b` | `a.greaterThan(b)` |
| Comparison | `a < b` | `a.lessThan(b)` |
| Comparison | `a >= b` | `a.greaterThanEqual(b)` |
| Comparison | `a <= b` | `a.lessThanEqual(b)` |
| Comparison | `a == b`, `a === b` | `a.equal(b)` |
| Comparison | `a != b`, `a !== b` | `a.notEqual(b)` |
| Logical | `a && b` | `a.and(b)` |
| Logical | `a \|\| b` | `a.or(b)` |
| Logical | `!a` | `a.not()` |
| Opt-in with `//@tsl` | `a ? b : c` | `select(a, b, c)` |
| Opt-in with `//@tsl` | `i++`, `--i` | `i.addAssign(1)`, `i.subAssign(1)` |

## Where It Runs

Only code inside direct `Fn(() => ...)` calls is transformed. Regular application code, helper functions outside `Fn()`, files in `node_modules`, and non-JS/TS files are ignored.

```js
const value = a + b // unchanged

Fn(() => {
  return a + b // a.add(b)
})
```

The plugin also exits early when a file does not contain `Fn(` or any candidate operator, so most unrelated files pay almost no transform cost.

## Smart Defaults

The transform is intentionally conservative.

Pure numeric math stays JavaScript:

```js
Fn(() => {
  const radius = 0.08
  const halfRadius = radius * 0.5 // unchanged
  return smoothstep(radius, halfRadius, dist)
})
```

`Math.*` expressions stay JavaScript:

```js
Fn(() => {
  return 1 - Math.PI / 2 // float(1).sub(Math.PI / 2)
})
```

Plain JavaScript control flow stays JavaScript unless you opt in:

```js
Fn(() => {
  if (enabled && !debug) {
    return color * opacity // color.mul(opacity)
  }
})
```

## Directives

Use comments when the automatic context detection needs help.

`//@tsl` forces TSL conversion for the next statement, or for an entire `Fn()` when placed immediately before it:

```js
//@tsl
Fn(() => {
  if (x > y) {
    return a
  }
})
```

`//@js` keeps the next statement as JavaScript:

```js
Fn(() => {
  //@js
  const debugValue = count / 2

  return color / 2 // color.div(2)
})
```

## Auto Imports

By default, the plugin adds missing TSL imports when a transform introduces wrappers such as `float`, `int`, `Loop`, or `select`.

```js
import { Fn, uv } from 'three/tsl'

Fn(() => 1 - uv())
```

becomes:

```js
import { Fn, uv, float } from 'three/tsl'

Fn(() => float(1).sub(uv()))
```

The plugin adds to existing imports from `three/tsl`, `three/webgpu`, or `three/src/nodes/...`. If no TSL import exists, it creates one using `importSource`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `logs` | `false` | Log before/after transform snippets. Accepts `true`, `false`, a filename, an array of filenames, or a `RegExp`. |
| `autoImportMissingTSL` | `true` | Add missing TSL imports required by generated code. |
| `importSource` | `'three/tsl'` | Source used when creating a new import declaration. |

```js
tslOperatorPlugin({ logs: /shader/i })
tslOperatorPlugin({ autoImportMissingTSL: false })
tslOperatorPlugin({ importSource: 'three/webgpu' })
```

## TSL Loops

Annotate loops with `//@tsl` to turn them into `Loop()` calls.

```js
Fn(() => {
  //@tsl
  for (let i = 0; i < 10; i++) {
    sum += value
  }
})
```

becomes:

```js
Fn(() => {
  Loop({ start: int(0), end: int(10), type: 'int', condition: '<', name: 'i' }, ({ i }) => {
    sum.addAssign(value)
  })
})
```

`while` and `do...while` are also supported with `//@tsl`. Loop bounds are wrapped with `int()` or `float()` based on the values used.

## Runtime Coverage

The repository includes two test layers:

- Unit transform tests for operator output, idempotency, TypeScript syntax, source maps, directives, and auto-import behavior.
- Browser runtime tests that compile transformed TSL shaders through Three.js WebGL/WebGPU paths.

```bash
pnpm test
pnpm test:unit
pnpm test:browser
```

## Related Plugin

For production builds, pair this with [`vite-plugin-tsl-optimizer`](https://github.com/makio64/vite-plugin-tsl-optimizer). Run this plugin first, then the optimizer to simplify generated chains such as `.add(0)`, `.mul(1)`, and redundant wrappers.

```js
plugins: [
  tslOperatorPlugin(),
  tslOptimizerPlugin(),
]
```

## About TSL

TSL is Three.js Shading Language. Start with the official [Three.js TSL documentation](https://threejs.org/docs/TSL.html), and use the [TSL reference page](https://threejs.org/docs/pages/TSL.html) for available nodes, helpers, and properties.

## License

MIT
