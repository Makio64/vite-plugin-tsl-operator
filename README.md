# vite-plugin-tsl-operator

![Experimental](https://img.shields.io/badge/Experimental-true-orange)

A Vite plugin to let you use `+`, `-`, `*`, `/`, `%`, `+=`, `-=`, `*=`, `/=`, `%=` with TSL Node in your Threejs project making the code more consise and easy to write, modify & read.

For example instead of:

```js
Fn(()=>{
	let x = float(1).sub(alpha.mul(color.r))
	x = x.mul(4)
	return x;
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
- [Options](#how-it-works)
- [How-it-works](#how-it-works)
- [Limitation](#limitation)
- [About-TSL](#about-tsl)
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

`logs` (`false` by default) : will log the transformations in the console

<img width="593" alt="Screenshot 2025-02-08 at 12 55 26" src="https://github.com/user-attachments/assets/20861ec1-6c75-4d35-87da-61e3ed8a2ba9" />

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

PS : It doesn't convert inside `node_modules`

## About TSL

Official wiki : [Three.js-Shading-Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)

### License

MIT
