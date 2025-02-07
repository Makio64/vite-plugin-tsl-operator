// test/index.test.js
import { describe, it, expect } from 'vitest'
import TSLOperatorPlugin from '../src/index.js'

describe('TSLOperatorPlugin', () => {

  it('should transform numeric literals when interacting with variables', () => {
    const code = `
      Fn(() => {
        let outside = 1 - left * right;
        return outside;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = plugin.transform(code, 'mixedVariable.js')
    // Expect the literal 1 to be wrapped as float(1) and the operations become chainable.
    expect(result.code).toContain('float(1).sub(')
    expect(result.code).toContain('.mul(')
  })

  it('should not transform Math.PI / 2', () => {
    const code = `
      Fn(() => {
        return Math.PI / 2;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = plugin.transform(code, 'mathpi.js')
    // When the left-most is Math.PI, the expression should remain unchanged.
    expect(result.code).toContain('Math.PI / 2')
    expect(result.code).not.toContain('Math.PI.div(')
  })
  it('should not transform pure numeric expressions', () => {
    const code = `
      Fn(() => {
        let a = 1 - 2 * (3 + 4) / 5;
        return a;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = plugin.transform(code, 'pureNumeric.js')
    // Pure numeric arithmetic should remain unchanged.
    expect(result.code).toContain('1 - 2 * (3 + 4) / 5')
    expect(result.code).not.toContain('float(')
  })

  it('should transform expressions with Math.PI when mixed with numbers', () => {
    const code = `
      Fn(() => {
        return 1 - (Math.PI / 2);
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = plugin.transform(code, 'mixedMath.js')
    // The literal 1 is converted to float(1) while the Math.PI part remains unchanged.
    expect(result.code).toContain('float(1).sub(Math.PI / 2)')
    expect(result.code).not.toContain('Math.PI.div(')
  })

  it('should transform complex expressions correctly', () => {
    const code = `
      Fn(() => {
        let a = 1 - left * right;
        let b = smoothstep(0, 0.5, pos.y) * .5 + .5;
        let c = mix(a, b, color(0xff0000));
        return c;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = plugin.transform(code, 'complex.js')
    // For a: expect float(1) and chainable .sub(...).mul(...)
    expect(result.code).toContain('float(1).sub(')
    expect(result.code).toContain('.mul(')
    // For b: expect smoothstep() to become chainable (mul then add)
    expect(result.code).toMatch(/smoothstep\(0,\s*0\.5,\s*pos\.y\)\.mul\(\.5\)\.add\(\.5\)/)
    // For c: mix() call should incorporate the transformed expressions.
    expect(result.code).toMatch(/mix\(a,\s*b,\s*color\(0xff0000\)\)/)
  })

  it('should transform unary numeric literals interacting with variables', () => {
    const code = `
      Fn(() => {
        return -1 + x;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = plugin.transform(code, 'unary.js')
    // Expect the literal -1 to be wrapped in float() and the addition to become .add(x)
    expect(result.code).toContain('float(-1).add(x)')
  })

	it('transforms "left * right" into chainable method calls', async () => {
    const code = `
      Fn(() => {
        return left * right;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = await plugin.transform(code, 'case1.js')
    // Expected transformation: "left.mul(right)"
    expect(result.code).toContain("left.mul(right)")
    expect(result.code).not.toContain("*")
  })

  it('transforms "left - 2" into chainable method calls', async () => {
    const code = `
      Fn(() => {
        return left - 2;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = await plugin.transform(code, 'case2.js')
    // Expected transformation: "left.sub(2)"
    expect(result.code).toContain("left.sub(2)")
    expect(result.code).not.toContain("left - 2")
  })

  it('transforms "left - 2 / 3" into chainable method calls', async () => {
    const code = `
      Fn(() => {
        return left - 2 / 3;
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = await plugin.transform(code, 'case2.js')

		console.log(result.code)
    expect(result.code).toContain("left.sub(2 / 3)")
    expect(result.code).not.toContain("left - 2")
  })


  it('transforms "left - 2 + float(5).div(5)" correctly', async () => {
    const code = `
      Fn(() => {
        return left - 2 + float(5).div(5);
      })
    `
    const plugin = TSLOperatorPlugin()
    const result = await plugin.transform(code, 'case3.js')
    // Expected transformation: "left.sub(2).add(float(5).div(5))"
    expect(result.code).toContain("left.sub(2).add(float(5).div(5))")
    expect(result.code).not.toContain("left - 2")
    expect(result.code).not.toContain("+ float(5)")
  })

})
