# TSL-operator-vite-plugin

![Experimental](https://img.shields.io/badge/Experimental-true-orange)

A Vite plugin to let you use `+`, `-`, `*`, `/` with TSL Node in your Threejs project making the code more consise and easy to write, re-write & read.

For example instead of:

```js
Fn(()=>{
	opacity = float(1).sub(alpha.mul(color.r))
})
```

You can now write : 
```js
Fn(()=>{
	opacity = 1 - ( alpha * color.r )
})
```

- [Installation](#installation)
- [Usage](#usage)
- [How-it-works](#how-it-works)
- [Limitation](#limitation)
- [About-TSL](#About)
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
		tslOperatorPlugin()
		//.. other plugins
	]
})
```


## How it works

It traverse your code and look for `Fn`, then transform it to methods chaining code ( as if you write TSL without this plugin ) 

## Limitation

It works only inside a `Fn()` to not mess up the rest of your code
```js
const opacity = uniform(0) //will not be parsed

Fn(()=>{
	//will be parsed
	return opacity * 3 * distance( positionLocal ) 

	// similar to
	return opacity.mul(3).mul(distance( positionLocal ))
})
```

## About TSL

Official wiki : [Three.js-Shading-Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)

### License

MIT