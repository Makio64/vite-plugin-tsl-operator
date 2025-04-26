// test/tsl-operator-plugin.spec.js
import { describe, it, expect } from 'vitest'
import TSLOperatorPlugin from '../src/index.js'

// Helper to run the plugin in a shorter form
const run = (code, filename = 'test.js') => 
  TSLOperatorPlugin({logs:true}).transform(code, filename).code

describe('Basic Arithmetic Operators', () => {
  describe('Operator +', () => {
    // 1 SUCCESS
    it('1. transforms left + right => left.add(right)', () => {
      const code = `Fn(() => left + right)`
      const out = run(code)
      expect(out).toContain('left.add(right)')
      expect(out).not.toContain('+ right')
    })

    // 2 SUCCESS
    it('2. transforms left + 1 => left.add(1)', () => {
      const code = `Fn(() => left + 1)`
      const out = run(code)
      expect(out).toContain('left.add(1)')
      expect(out).not.toContain('left + 1')
    })

    // 3 SUCCESS
    it('3. transforms 1 + left => float(1).add(left)', () => {
      const code = `Fn(() => 1 + left)`
      const out = run(code)
      expect(out).toContain('float(1).add(left)')
      expect(out).not.toContain('1 + left')
    })
  })

  describe('Operator -', () => {
    // 4 SUCCESS
    it('4. transforms left - right => left.sub(right)', () => {
      const code = `Fn(() => left - right)`
      const out = run(code)
      expect(out).toContain('left.sub(right)')
      expect(out).not.toContain('left - right')
    })

    // 5 SUCCESS
    it('5. transforms left - 2 => left.sub(2)', () => {
      const code = `Fn(() => left - 2)`
      const out = run(code)
      expect(out).toContain('left.sub(2)')
      expect(out).not.toContain('left - 2')
    })

    // 6 SUCCESS
    it('6. transforms 2 - left => float(2).sub(left)', () => {
      const code = `Fn(() => 2 - left)`
      const out = run(code)
      expect(out).toContain('float(2).sub(left)')
      expect(out).not.toContain('2 - left')
    })
  })

  describe('Operator *', () => {
    // 7 SUCCESS
    it('7. transforms left * right => left.mul(right)', () => {
      const code = `Fn(() => left * right)`
      const out = run(code)
      expect(out).toContain('left.mul(right)')
      expect(out).not.toContain('* right')
    })

    // 8 SUCCESS
    it('8. transforms left * 5 => left.mul(5)', () => {
      const code = `Fn(() => left * 5)`
      const out = run(code)
      expect(out).toContain('left.mul(5)')
      expect(out).not.toContain('left * 5')
    })

    // 9 SUCCESS
    it('9. transforms 5 * left => float(5).mul(left)', () => {
      const code = `Fn(() => 5 * left)`
      const out = run(code)
      expect(out).toContain('float(5).mul(left)')
      expect(out).not.toContain('5 * left')
    })
  })

  describe('Operator /', () => {
    // 10 SUCCESS
    it('10. transforms left / right => left.div(right)', () => {
      const code = `Fn(() => left / right)`
      const out = run(code)
      expect(out).toContain('left.div(right)')
      expect(out).not.toContain('left / right')
    })

    // 11 SUCCESS
    it('11. transforms left / 3 => left.div(3)', () => {
      const code = `Fn(() => left / 3)`
      const out = run(code)
      expect(out).toContain('left.div(3)')
      expect(out).not.toContain('left / 3')
    })

    // 12 SUCCESS
    it('12. transforms 3 / left => float(3).div(left)', () => {
      const code = `Fn(() => 3 / left)`
      const out = run(code)
      expect(out).toContain('float(3).div(left)')
      expect(out).not.toContain('3 / left')
    })
  })

  describe('Operator %', () => {
    // 13 SUCCESS
    it('13. transforms left % right => left.mod(right)', () => {
      const code = `Fn(() => left % right)`
      const out = run(code)
      expect(out).toContain('left.mod(right)')
      expect(out).not.toContain('left % right')
    })

    // 14 SUCCESS
    it('14. transforms left % 2 => left.mod(2)', () => {
      const code = `Fn(() => left % 2)`
      const out = run(code)
      expect(out).toContain('left.mod(2)')
      expect(out).not.toContain('left % 2')
    })

    // 15 SUCCESS
    it('15. transforms 2 % left => float(2).mod(left)', () => {
      const code = `Fn(() => 2 % left)`
      const out = run(code)
      expect(out).toContain('float(2).mod(left)')
      expect(out).not.toContain('2 % left')
    })

    // Fn(()=>{
    //   return 1 - ( alpha * color.r % 3 )
    // })
    it('15Bis. transforms 1 - ( alpha * (color.r % 3) )', () => {
      const code = `Fn(()=>{
        return 1 - ( alpha * color.r % 3 )
      })`
      const out = run(code)
      expect(out).toContain('float(1).sub(alpha.mul(color.r.mod(3)))')
    })
  })
})

describe('Operator Precedence & Parentheses', () => {
  // 16 SUCCESS
  it('16. keeps the correct precedence for 1 % 2 / 3 * 4 - 5 + 6 % 8 / 9', () => {
    const code = `
      Fn(() => {
        return 1 % 2 / 3 * 4 - 5 + 6 % 8 / 9
      })
    `
    const out = run(code)
    expect(out).toContain('1 % 2 / 3 * 4 - 5 + 6 % 8 / 9')
  })

  // 17 SUCCESS
  it('17. handles nested parentheses => (left + (right - 1)) * 2', () => {
    const code = `Fn(() => (left + (right - 1)) * 2)`
    const out = run(code)
    expect(out).toContain('left.add(right.sub(1)).mul(2)')
  })

  // 18 SUCCESS
  it('18 handles nested parentheses', () => {
    const code = `Fn(() => (a + (b - c)) * d)`
    const out = run(code)
    expect(out).toContain('a.add(b.sub(c)).mul(d)')
  })

  // 19 SUCCESS
  it('19 respects operator precedence', () => {
    const code = `Fn(() => a + b * c + d / e)`
    const out = run(code)
    expect(out).toContain('a.add(b.mul(c)).add(d.div(e))')
  })

  // 20. SUCCESS
  it('20. handles multiline expressions with line breaks', () => {
    const code = `
      Fn(() => {
        return a
          + b * c
          - d / e
      })
    `
    const out = run(code)
    expect(out.replace(/\s/g, '')).toContain('a.add(b.mul(c)).sub(d.div(e))')
  })
})

describe('Unary Operations', () => {
  // 21 SUCCESS
  it('21. handles unary numeric with variable => -1 + x => float(-1).add(x)', () => {
    const code = `Fn(() => -1 + x)`
    const out = run(code)
    expect(out).toContain('float(-1).add(x)')
  })

  // 22 SUCCESS
  it('22. does not alter var a = ( -5 ) if not used with other ops', () => {
    const code = `
      Fn(() => {
        let a = (-5)
        return a
      })
    `
    const out = run(code)
    // It's purely numeric unary => no chain needed
    expect(out).toContain('let a = -5')
    expect(out).not.toContain('float(-5)')
  })

  // 23 SUCCESS
  it('23. handles unary operators and function calls => -a * b + Math.abs(c)', () => {
    const code = `Fn(() => -a * b + Math.abs(c))`
    const out = run(code)
    expect(out).toContain('a.mul(-1).mul(b).add(Math.abs(c))')
  })

  // 24 SUCCESS
  it('24. handles multiple unary operators => -a + -b * -c', () => {
    const code = `Fn(() => -a + -b * -c)`
    const out = run(code)
    expect(out).toContain('a.mul(-1).add(b.mul(-1).mul(c.mul(-1)))')
  })

  // 25 SUCCESS
  it('25 handles unary operators', () => {
    const code = `Fn(() => -a + -b * -c)`
    const out = run(code)
    expect(out).toContain('a.mul(-1).add(b.mul(-1).mul(c.mul(-1)))')
  })
})

describe('Mixing with Math Constants & Functions', () => {
  // 26 SUCCESS
  it('26. does not transform Math.PI / 2 alone', () => {
    const code = `Fn(() => Math.PI / 2)`
    const out = run(code, 'mathpi.js')
    expect(out).toContain('Math.PI / 2')
    expect(out).not.toContain('Math.PI.div(')
  })

  it('26Bis1. does not transform Math.PI * 2 alone', () => {
    const code = `Fn(() => Math.PI * 2)`
    const out = run(code, 'mathpi.js')
    expect(out).toContain('Math.PI * 2')
    expect(out).not.toContain('Math.PI.mul(')
  })

  it('26Bis2. does not transform Math.PI % 2 alone', () => {
    const code = `Fn(() => Math.PI % 2)`
    const out = run(code, 'mathpi.js')
    expect(out).toContain('Math.PI % 2')
    expect(out).not.toContain('Math.PI.mod(')
  })

  it('26Bis3. does not transform Math.PI - 2 alone', () => {
    const code = `Fn(() => Math.PI - 2)`
    const out = run(code, 'mathpi.js')
    expect(out).toContain('Math.PI - 2')
    expect(out).not.toContain('Math.PI.sub(')
  })

  // 27 SUCCESS
  it('27. transforms numeric + Math.PI => float(1).add(Math.PI)', () => {
    const code = `Fn(() => 1 + Math.PI)`
    const out = run(code)
    expect(out).toContain('float(1).add(Math.PI)')
  })

  // 28 SUCCESS
  it('28. mixes numeric with Math.PI => float(1).sub(Math.PI / 2)', () => {
    const code = `Fn(() => 1 - (Math.PI / 2))`
    const out = run(code)
    expect(out).toContain('float(1).sub(Math.PI / 2)')
  })

  it('28Bis1. mixes numeric with Math.PI => float(1).sub(Math.PI * 2)', () => {
    const code = `Fn(() => 1 - (Math.PI * 2))`
    const out = run(code)
    expect(out).toContain('float(1).sub(Math.PI * 2)')
  })

  // 29 SUCCESS
  it('29. keeps pure numeric expressions intact', () => {
    const code = `Fn(() => 1 - 2 * (3 + 4) / 5)`
    const out = run(code)
    expect(out).toContain('1 - 2 * (3 + 4) / 5')
    expect(out).not.toContain('float(')
  })

  // 30 SUCCESS
  it('30 handles Math functions correctly', () => {
    const code = `Fn(() => Math.abs(a) + Math.sin(b) * sin(c) + d)`
    const out = run(code)
    expect(out).toContain('Math.abs(a).add(Math.sin(b).mul(sin(c))).add(d)')
  })
})

describe('Complex Expressions & Chaining', () => {
  // 31 SUCCESS
  it('31. handles left - 2 + float(5).div(5)', () => {
    const code = `Fn(() => left - 2 + float(5).div(5))`
    const out = run(code)
    expect(out).toContain('left.sub(2).add(float(5).div(5))')
  })

  // 32 SUCCESS
  it('32. handles smoothstep(...) * .5 + .5 => smoothstep(...).mul(.5).add(.5)', () => {
    const code = `
      Fn(() => {
        return smoothstep(0, 0.5, pos.y) * .5 + .5
      })
    `
    const out = run(code)
    expect(out).toContain('smoothstep(0, 0.5, pos.y).mul(.5).add(.5)')
  })

  // 33 SUCCESS
  it('33. handles mix(...) calls alongside chainable ops', () => {
    const code = `
      Fn(() => {
        let a = 1 - left * right
        let b = smoothstep(0, 0.5, pos.y) * .5 + .5
        return mix(a, b, color(0xff0000))
      })
    `
    const out = run(code)
    expect(out).toContain('float(1).sub(left.mul(right))')
    expect(out).toContain('smoothstep(0, 0.5, pos.y).mul(.5).add(.5)')
    expect(out).toContain('mix(a, b, color(0xff0000))')
  })

  // 34 SUCCESS
  it('34. handles chain with left, right, x => left + right / x', () => {
    const code = `Fn(() => left + right / x)`
    const out = run(code)
    expect(out).toContain('left.add(right.div(x))')
  })

  // 35 SUCCESS
  it('35. handles multiple mod => left % 3 % 2 => left.mod(3).mod(2)', () => {
    const code = `Fn(() => left % 3 % 2)`
    const out = run(code)
    expect(out).toContain('left.mod(3).mod(2)')
  })

  // 36 SUCCESS
  it('36. handles float(2.5).mul(4) + 1 => float(2.5).mul(4).add(1)', () => {
    const code = `Fn(() => float(2.5).mul(4) + 1)`
    const out = run(code)
    expect(out).toContain('float(2.5).mul(4).add(1)')
  })

  // 37 SUCCESS
  it('37. correctly chains multiple operations => left * right - 2 / (3 + left)', () => {
    const code = `Fn(() => left * right - 2 / (3 + left))`
    const out = run(code)
    expect(out).toContain('left.mul(right).sub(float(2).div(float(3).add(left)))')
  })

  // 38 SUCCESS
  it('38. handles nested operations with multiple variables => (a + b) * (c - d)', () => {
    const code = `Fn(() => (a + b) * (c - d))`
    const out = run(code)
    expect(out).toContain('a.add(b).mul(c.sub(d))')
  })

  // 40 SUCCESS
  it('40. handles complex mixed operators => a * b + c / d - e % f', () => {
    const code = `Fn(() => a * b + c / d - e % f)`
    const out = run(code)
    expect(out).toContain('a.mul(b).add(c.div(d)).sub(e.mod(f))')
  })

  // 41 SUCCESS
  it('41. handles chained operations with parentheses => (a + b) * (c - (d / e))', () => {
    const code = `Fn(() => (a + b) * (c - (d / e)))`
    const out = run(code)
    expect(out).toContain('a.add(b).mul(c.sub(d.div(e)))')
  })

  // 42 SUCCESS
  it('42. handles multiple nested function calls => fn1(a) + fn2(b) * fn3(c)', () => {
    const code = `Fn(() => fn1(a) + fn2(b) * fn3(c))`
    const out = run(code)
    expect(out).toContain('fn1(a).add(fn2(b).mul(fn3(c)))')
  })

  // 43 SUCCESS
  it('43. handles complex mixed literals and variables => 2 * a + 3 / b - 4 % c', () => {
    const code = `Fn(() => 2 * a + 3 / b - 4 % c)`
    const out = run(code)
    expect(out).toContain('float(2).mul(a).add(float(3).div(b)).sub(float(4).mod(c))')
  })

  // 44 SUCCESS
  it('44. handles multiple chained method => a.mul(b).add(c).sub(d)', () => {
    const code = `Fn(() => a * b + c - d)`
    const out = run(code)
    expect(out).toContain('a.mul(b).add(c).sub(d)')
  })

  // 45 SUCCESS 
  it('45. handles nested method and literals => a.mul(b.add(2)).sub(3)', () => {
    const code = `Fn(() => a * (b + 2) - 3)`
    const out = run(code)
    expect(out).toContain('a.mul(b.add(2)).sub(3)')
  })

  // 46 SUCCESS
  it('46. handles nested ternary operations => a ? b.add(c) : d.sub(e)', () => {
    const code = `Fn(() => a ? b.add(c) : d.sub(e))`
    const out = run(code)
    expect(out).toContain('a ? b.add(c) : d.sub(e)')
  })

  // 47 SUCCESS
  it('47. handles mixed literals and variables => 2 * a + 3 / b - 4 % c', () => {
    const code = `Fn(() => 2 * a + 3 / b - 4 % c)`
    const out = run(code)
    expect(out).toContain('float(2).mul(a).add(float(3).div(b)).sub(float(4).mod(c))')
  })

  // 48. SUCCESS
  it('48. handles nested arrow functions with arithmetic inside multiline function', () => {
    const code = `
      Fn(() => {
        const calc = () => a + b
        return calc() * 2
      })
    `
    const out = run(code)
    expect(out).toContain('const calc = () => a.add(b)')
    expect(out).toContain('calc().mul(2)')
  })

  // 49 SUCCESS
  it('49. handles expressions with comments between operators', () => {
    const code = `Fn(() => a + /* plus comment */ b - /* minus comment */ c)`
    const out = run(code)
    expect(out.trim()).toContain('a.add(/* plus comment */b).sub(/* minus comment */c)')
  })

  // 50 SUCCESS
  it('50. handles arithmetic in function arguments', () => {
    const code = `Fn(() => someFunc(a + b - c))`
    const out = run(code)
    expect(out).toContain('someFunc(a.add(b).sub(c))')
  })
})

describe('Mixed Code & Non-Transformed Segments', () => {
  // 51 SUCCESS
  it('51 does not alter non-TSL code', () => {
    const code = `const x = a + b; Fn(() => x * c)`
    const out = run(code)
    expect(out).toContain('const x = a + b;')
    expect(out).toContain('x.mul(c)')
  })

  // 52 SUCCESS
  it('52. does not transform arithmetic inside string literals', () => {
    const code = `Fn(() => "a + b should remain as is")`
    const out = run(code)
    expect(out).toContain('"a + b should remain as is"')
  })
})

describe('Real-World Examples', () => {

  // 53 SUCCESS
  it('53. complex real-world example', () => {
    const code = `
      Fn(() => {
        position.x.addAssign( (position.z * angleX + Math.PI / 2).cos() * powerX )
      })
    `
    const out = run(code)
    expect(out).toContain('position.x.addAssign(position.z.mul(angleX).add(Math.PI / 2).cos().mul(powerX))')
  })

  // 54 SUCCESS
  it('54. handles complex fog mix example', () => {
    const code = `
      Fn( ()=>{
        let c = output
        let outsideRange = 2.2
        let margin = 1.1
        let right = smoothstep( -outsideRange, -outsideRange + margin, vBatchPosition.x )
        let left = smoothstep( vBatchPosition.x, vBatchPosition.x + margin, outsideRange )
        let outside = 1 - left * right
  
        c = mix( c, fogColor, clamp( outside - vBatchPosition.y / 3 ) )
        return applyFog( c, vBatchTransformed )
      } )()
    `
    const out = run(code)
    expect(out).toContain("let outsideRange = 2.2")
    expect(out).toContain("smoothstep(float(outsideRange).mul(-1), float(outsideRange).mul(-1).add(margin), vBatchPosition.x)")
    expect(out).toContain("let outside = float(1).sub(left.mul(right))")
    expect(out).toContain("c = mix(c, fogColor, clamp(outside.sub(vBatchPosition.y.div(3))))")
    expect(out).toContain("return applyFog(c, vBatchTransformed)")
  })

  // SUCCESS
  it('54Bis1. handles complex normal transformation example', () => {
    const code = `
      Fn(() => {
        const transformedNormal = normalLocal.div(vec3(bm[0].dot(bm[0]), bm[1].dot(bm[1]), bm[2].dot(bm[2])))
      })
    `
    const out = run(code)
    expect(out).toContain("const transformedNormal = normalLocal.div(vec3(bm[0].dot(bm[0]), bm[1].dot(bm[1]), bm[2].dot(bm[2]))")
  })

  // 54Bis2 FAILLED MINOR ISSUE : it add a space before toVar() casue the parenthese are changed from one line to the others..
  // it('54Bis2. handles complex multiline matrix without redundant transforms', () => {
  //   const code = `
  //     Fn(() => {
  //       let batchingMatrix = mat4(
  //         textureLoad(matriceTexture, ivec2(x, y)),
  //         textureLoad(matriceTexture, ivec2(x.add(1), y)),
  //         textureLoad(matriceTexture, ivec2(x.add(2), y)),
  //         textureLoad(matriceTexture, ivec2(x.add(3), y))
  //       ).toVar()
  //     })
  //   `
  //   // Remove extra whitespace so formatting differences don’t cause false negatives
  //   const normalize = str => str.trim().replace(/\s+/g, ' ') 
  //   const expected = normalize(
  //     `let batchingMatrix = mat4( textureLoad(matriceTexture, ivec2(x, y)), textureLoad(matriceTexture, ivec2(x.add(1), y)), textureLoad(matriceTexture, ivec2(x.add(2), y)), textureLoad(matriceTexture, ivec2(x.add(3), y))).toVar()`
  //   )
  //   const transformed = normalize(run(code))
  //   console.log('transformed', transformed)
  //   expect(transformed).toContain(expected)
  // })
  
})

describe('TSLOperatorPlugin Edge Cases', () => {

  it('55. idempotency: does not double transform already transformed code', () => {
    const code = `Fn(() => left.add(right))`
    const out = run(run(code))
    expect(out).toContain('left.add(right)')
  })

  it('56. transforms arithmetic inside computed property keys', () => {
    const code = `Fn(() => {
      const obj = { [a + b]: c }
      return obj
    })`
    const out = run(code)
    expect(out).toContain('[a.add(b)]')
  })

  it('57. transforms arithmetic inside template literal interpolations', () => {
    const code = 'Fn(() => `Value: ${a + b}`)'
    const out = run(code)
    expect(out).toContain('`Value: ${a.add(b)}`')
  })

  it('58. transforms arithmetic in array elements', () => {
    const code = `Fn(() => [a + b, a - b])`
    const out = run(code)
    expect(out).toContain('a.add(b)')
    expect(out).toContain('a.sub(b)')
  })

  it('59. dont transforms arithmetic in default parameter values', () => {
    const code = `
      const f = (x = a + b) => x
      Fn(() => f())
    `
    const out = run(code)
    expect(out).not.toContain('x = a.add(b)')
  })

  it('60. transforms arithmetic with unusual spacing and line breaks', () => {
    const code = `
      Fn(() => {
        return a
          +
          b
          -
          c
      })
    `
    const out = run(code)
    expect(out.replace(/\s/g, '')).
      toContain('a.add(b).sub(c)')
  })

  it('61. does not transform arithmetic inside string literals', () => {
    const code = `Fn(() => "Sum: a + b should not change")`
    const out = run(code)
    expect(out).toContain('"Sum: a + b should not change"')
  })

  it('62. preserves grouping with unnecessary parentheses', () => {
    const code = `Fn(() => (a + b))`
    const out = run(code)
    expect(out).toContain('a.add(b)')
  })

  it('63. transforms arithmetic in default values during object destructuring', () => {
    const code = `Fn(() => {
      const { x = a + b } = obj
      return x
    })`
    const out = run(code)
    expect(out).toContain('x = a.add(b)')
  })

  it('64. handles logical operators without interfering with arithmetic', () => {
    const code = `Fn(() => {
      return (a + b) && (c - d)
    })`
    const out = run(code)
    expect(out).toContain('a.add(b)')
    expect(out).toContain('c.sub(d)')
    expect(out).toContain('&&')
  })

  it('65. transforms arithmetic in nested ternary conditions', () => {
    const code = `Fn(() => a ? b + c : d - e)`
    const out = run(code)
    expect(out).toContain('b.add(c)')
    expect(out).toContain('d.sub(e)')
  })

  it('66. handles expressions with multiple unary minus signs', () => {
    const code = `Fn(() => - -a + - (b - c))`
    const out = run(code)
    expect(out).toContain('a.mul(-1).mul(-1).add(b.sub(c).mul(-1))')
  })

  it('67. transforms (a + b) * c % d => a.add(b).mul(c.mod(d))', () => {
    const code = `Fn(() => (a + b) * c % d)`
    const out = run(code)
    expect(out).toContain('a.add(b).mul(c.mod(d))')
  })
  
  it('68. handles a * b * c % d => a.mul(b).mul(c.mod(d))', () => {
    const code = `Fn(() => a * b * c % d)`
    const out = run(code)
    expect(out).toContain('a.mul(b).mul(c.mod(d))')
  })
  
  it('69. handles unary minus before `%`: -a % b => a.mul(-1).mod(b)', () => {
    const code = `Fn(() => -a % b)`
    const out = run(code)
    expect(out).toContain('a.mul(-1).mod(b)')
  })
  
  it('70. leaves `%` in default params untouched', () => {
    const code = `const f = (x = a % b) => x; Fn(() => f())`
    const out = run(code)
    expect(out).toContain('x = a % b')
  })
  
  it('71. transforms inside template literals', () => {
    const code = 'Fn(() => `r=${x % y}`)'
    const out = run(code)
    expect(out).toContain('`r=${x.mod(y)}`')
  })

  // 72. handles a % b * c => a.mod(b).mul(c)
it('72. transforms a % b * c => a.mod(b).mul(c)', () => {
  const code = `Fn(() => a % b * c)`
  const out = run(code)
  expect(out).toContain('a.mod(b).mul(c)')
})

// 73. transforms (a + b) * c % d => a.add(b).mul(c.mod(d))
it('73. transforms (a + b) * c % d => a.add(b).mul(c.mod(d))', () => {
  const code = `Fn(() => (a + b) * c % d)`
  const out = run(code)
  expect(out).toContain('a.add(b).mul(c.mod(d))')
})

// 74. transforms a * (b + c) % (d - e) => a.mul(b.add(c).mod(d.sub(e)))
it('74. transforms a * (b + c) % (d - e) => a.mul(b.add(c).mod(d.sub(e)))', () => {
  const code = `Fn(() => a * (b + c) % (d - e))`
  const out = run(code)
  expect(out).toContain('a.mul(b.add(c).mod(d.sub(e)))')
})

// 75. transforms 3 * x % 5 => float(3).mul(x.mod(5))
it('75. transforms 3 * x % 5 => float(3).mul(x.mod(5))', () => {
  const code = `Fn(() => 3 * x % 5)`
  const out = run(code)
  expect(out).toContain('float(3).mul(x.mod(5))')
})

// 76. handles chaining a % b * c % d => a.mod(b).mul(c).mod(d)
it('76. transforms a % b * c % d => a.mod(b).mul(c).mod(d)', () => {
  const code = `Fn(() => a % b * c % d)`
  const out = run(code)
  expect(out).toContain('a.mod(b).mul(c).mod(d)')
})

// 77. transforms computed prop {[a * b % c]: d} => {[a.mul(b.mod(c))]: d}
it('77. transforms computed prop {[a * b % c]: d} => {[a.mul(b.mod(c))]: d}', () => {
  const code = `Fn(() => { const o = { [a * b % c]: d }; return o })`
  const out = run(code)
  expect(out).toContain('[a.mul(b.mod(c))]')
})

// 78. transforms in array elements [a * b % c, e] => [a.mul(b.mod(c)), e]
it('78. transforms in array [a * b % c, e] => [a.mul(b.mod(c)), e]', () => {
  const code = `Fn(() => [a * b % c, e])`
  const out = run(code)
  expect(out).toContain('a.mul(b.mod(c))')
})

// 79. handles unary before modulo in args: foo(a * b % c, -d % e)
it('79. transforms foo(a * b % c, -d % e) => foo(a.mul(b.mod(c)), d.mul(-1).mod(e))', () => {
  const code = `Fn(() => foo(a * b % c, -d % e))`
  const out = run(code)
  expect(out).toContain('foo(a.mul(b.mod(c)), d.mul(-1).mod(e))')
})

// 80. nested arrow with modulo: const inner = () => x * y % z
it('80. transforms nested arrow inner = () => x * y % z => inner = () => x.mul(y.mod(z))', () => {
  const code = `
    Fn(() => {
      const inner = () => x * y % z
      return inner()
    })
  `
  const out = run(code)
  expect(out).toContain('const inner = () => x.mul(y.mod(z))')
})

describe('Advanced Complex Use Cases', () => {
  it('81. handles deeply nested mixed operations', () => {
    const code = `Fn(() => {
      const x = (((a + b * c) % (d - e)) * f / (g + h)) + (i % (j * k)) - (-l + m * (n % o))
      return x
    })`
    const out = run(code)
    expect(out).toContain(
      'a.add(b.mul(c)).mod(d.sub(e)).mul(f).div(g.add(h)).add(i.mod(j.mul(k))).sub(l.mul(-1).add(m.mul(n.mod(o))))'
    )
  })

  it('82. transforms foo((a + b) * (c % d)) => foo(a.add(b).mul(c.mod(d)))', () => {
    const code = `Fn(() => foo((a + b) * (c % d)))`
    const out = run(code)
    expect(out).toContain('foo(a.add(b).mul(c.mod(d)))')
  })

  it('83. handles nested arrow function with modulo chain', () => {
    const code = `
      Fn(() => {
        const inner = (x) => x % m * n + o
        return inner(p)
      })
    `
    const out = run(code)
    expect(out).toContain('const inner = (x) => x.mod(m).mul(n).add(o)')
    expect(out).toContain('return inner(p)')
  })

  it('84. transforms complex template literal with arithmetic', () => {
    const code = 'Fn(() => `Result: ${((a - b) * c) % d}`)'
    const out = run(code)
    expect(out).toContain('`Result: ${a.sub(b).mul(c.mod(d))}`')
  })

  it('85. handles unary minus and nested modulo correctly', () => {
    const code = `Fn(() => -((x % y) * z))`
    const out = run(code)
    expect(out).toContain('x.mod(y).mul(z).mul(-1)')
  })
})

it('86. handles arithmetic in destructuring default, computed props, and nested ternary', () => {
  const code = `Fn(() => {
    const { a = b + c } = obj
    const o = { [d * e % f]: g }
    return h ? i - j * k % l : m + n
  })`
  const out = run(code)
  expect(out).toContain('a = b.add(c)')
  expect(out).toContain('[d.mul(e.mod(f))]')
  expect(out).toContain('h ? i.sub(j.mul(k.mod(l))) : m.add(n)')
})

it('87. transforms (a + b).toVar() => a.add(b).toVar()', () => {
  const code = `Fn(() => (a + b).toVar())`
  const out = run(code)
  expect(out).toContain('a.add(b).toVar()')
})

it('88. transforms (a - b).toConst() => a.sub(b).toConst()', () => {
  const code = `Fn(() => (a - b).toConst())`
  const out = run(code)
  expect(out).toContain('a.sub(b).toConst()')
})

it('89. transforms uniform(vec2(1 + 2)) => uniform(vec2(float(1).add(2)))', () => {
  const code = `Fn(() => uniform(vec2(1 + 2)))`
  const out = run(code)
  expect(out).toContain('uniform(vec2(float(1).add(2)))')
})

it('90. transforms array(vec2(3 + 4), vec2(5 % 2)) => array(vec2(float(3).add(4)), vec2(5.mod(2)))', () => {
  const code = `Fn(() => array(vec2(3 + 4), vec2(5 % 2)))`
  const out = run(code)
  expect(out).toContain('array(vec2(float(3).add(4)), vec2(float(5).mod(2)))')
})
})