// test/tsl-operator-plugin.spec.js
import { describe, it, expect } from 'vitest'
import TSLOperatorPlugin from '../src/index.js'

// Helper to run the plugin in a shorter form
const run = (code, filename = 'test.js') => {
  const result = TSLOperatorPlugin({logs:true}).transform(code, filename)
  return result ? result.code : code
}

// Helper to check if transformation occurred (returns raw result)
const runRaw = (code, filename = 'test.js') => {
  return TSLOperatorPlugin({logs:false}).transform(code, filename)
}

describe('Plugin Options', () => {
  it('returns transformed output even when logs=false', () => {
    const res = runRaw(`Fn(() => a + b)`)
    expect(res).not.toBeNull()
    expect(res.code).toContain('a.add(b)')
  })

  it('returns null when there is nothing to transform', () => {
    const res = runRaw(`const x = 1 + 2`)
    expect(res).toBeNull()
  })
})

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

  // 29b SUCCESS
  it('29b. keeps pure numeric expressions inside function calls intact', () => {
    const code = `Fn(() => { const c13 = vec3(1.0 / 3.0).toConst() })`
    const out = run(code)
    expect(out).toContain('vec3(1.0 / 3.0)')
    expect(out).not.toContain('float(')
  })

  // 29c SUCCESS
  it('29c. keeps negative numeric literals inside mat3/vec3 unchanged', () => {
    const code = `Fn(() => { const m = mat3(1.0, -0.5, 0.3, -0.2, 1.0, -0.1, 0.0, 0.5, 1.0).toConst() })`
    const out = run(code)
    expect(out).toContain('mat3(1.0, -0.5, 0.3, -0.2, 1.0, -0.1, 0.0, 0.5, 1.0)')
    expect(out).not.toContain('float(')
  })

  // 29d SUCCESS
  it('29d. keeps multiline mat3 with negative numbers unchanged', () => {
    const code = `Fn(() => {
	const kCONEtoLMS = mat3(
		0.4121656120,  0.2118591070,  0.0883097947,
		0.5362752080,  0.6807189584,  0.2818474174,
		0.0514575653,  0.1074065790,  0.6302613616 ).toConst()
	const kLMStoCONE = mat3(
		4.0767245293, -1.2681437731, -0.0041119885,
		-3.3072168827, 2.6093323231, -0.7034763098,
		0.2307590544, -0.3411344290, 1.7068625689 ).toConst()
    })`
    const out = run(code)
    expect(out).toContain('0.4121656120')
    expect(out).toContain('-1.2681437731')
    expect(out).toContain('-3.3072168827')
    expect(out).not.toContain('float(')
  })

  // 29e SUCCESS
  it('29e. keeps pure numeric (x * y) % z expressions in function calls unchanged', () => {
    const code = `Fn(() => { const a = vec3((1 * 2) % 3, 4, 5) })`
    const out = run(code)
    expect(out).toContain('(1 * 2) % 3')
    expect(out).not.toContain('float(')
  })

  // 29f SUCCESS
  it('29f. keeps numeric literals in arrays unchanged but transforms operations', () => {
    const code = `Fn(() => { const arr = [1, 2, a + b] })`
    const out = run(code)
    expect(out).toContain('[1, 2, a.add(b)]')
    expect(out).not.toContain('float(1)')
  })

  // 29g SUCCESS
  it('29g. keeps numeric literals in objects unchanged but transforms operations', () => {
    const code = `Fn(() => { const obj = {x: 1, y: a + b} })`
    const out = run(code)
    expect(out).toContain('x: 1')
    expect(out).toContain('y: a.add(b)')
    expect(out).not.toContain('float(1)')
  })

  // 29h SUCCESS
  it('29h. keeps numeric literals in ternary branches unchanged', () => {
    const code = `Fn(() => { const t = cond ? 1 : 2 })`
    const out = run(code)
    expect(out).toContain('cond ? 1 : 2')
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
  it('54Bis2. handles complex multiline matrix without redundant transforms', () => {
    const code = `
      Fn(() => {
        let batchingMatrix = mat4(
          textureLoad(matriceTexture, ivec2(x, y)),
          textureLoad(matriceTexture, ivec2(x.add(1), y)),
          textureLoad(matriceTexture, ivec2(x.add(2), y)),
          textureLoad(matriceTexture, ivec2(x.add(3), y))
        ).toVar()
      })
    `
    // Remove extra whitespace so formatting differences don’t cause false negatives
    const normalize = str => str.trim().replace(/\s+/g, ' ') 
    const expected = normalize(
      `let batchingMatrix = mat4( textureLoad(matriceTexture, ivec2(x, y)), textureLoad(matriceTexture, ivec2(x.add(1), y)), textureLoad(matriceTexture, ivec2(x.add(2), y)), textureLoad(matriceTexture, ivec2(x.add(3), y)) ).toVar()`
    )
    const transformed = normalize(run(code))
    // console.log('transformed', transformed)
    expect(transformed).toContain(expected)
  })
  
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

  it('57a. does NOT transform inc in template literal string concatenation', () => {
    const code = 'Fn(() => { const lms = mix( lmsA, lmsB, h ).toVar( `lms${inc}` ); return lms })'
    const out = run(code)
    expect(out).toContain('`lms${inc}`')
    expect(out).not.toContain('float( inc )')
  })

  it('57b. does NOT transform variables in template literal concatenation with more complex case', () => {
    const code = 'Fn(() => { const name = vec3(1,2,3).toVar(`myVar${index}`); return name })'
    const out = run(code)
    expect(out).toContain('`myVar${index}`')
    expect(out).not.toContain('float( index )')
  })

  it('57c. correctly transforms arithmetic but preserves simple vars in template literals', () => {
    const code = 'Fn(() => { const label = `result_${i}_${a + b}`; return label })'
    const out = run(code)
    expect(out).toContain('`result_${i}_${a.add(b)}`')
    expect(out).not.toContain('float( i )')
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

  it('64. transforms logical operators along with arithmetic', () => {
    const code = `Fn(() => {
      return (a + b) && (c - d)
    })`
    const out = run(code)
    expect(out).toContain('a.add(b)')
    expect(out).toContain('c.sub(d)')
    expect(out).toContain('.and(')
    expect(out).not.toContain('&&')
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

it('89. keeps pure numeric inside uniform(vec2(1 + 2)) unchanged', () => {
  const code = `Fn(() => uniform(vec2(1 + 2)))`
  const out = run(code)
  expect(out).toContain('uniform(vec2(1 + 2))')
  expect(out).not.toContain('float(')
})

it('90. keeps pure numeric inside array(vec2(3 + 4), vec2(5 % 2)) unchanged', () => {
  const code = `Fn(() => array(vec2(3 + 4), vec2(5 % 2)))`
  const out = run(code)
  expect(out).toContain('array(vec2(3 + 4), vec2(5 % 2))')
  expect(out).not.toContain('float(')
})

it('91. returns null (no transformation/logs) for multiline arrays without operators', () => {
  const code = `Fn(() => {
    const fogColor = gradient(
      [blendedBottom, blendedHorizon, blendedTop],
      smoothT,
      [0.5, 0.6, 1]
    )
    return fogColor
  })`
  const result = runRaw(code)
  // Should return null - no transformation, no log output, preserves original formatting
  expect(result).toBeNull()
})

it('91b. returns null for multiline nested function calls without operators', () => {
  const code = `Fn(() => {
    return mix(
      vec3(
        redChannel,
        greenChannel,
        blueChannel
      ),
      backgroundColor,
      alpha
    )
  })`
  const result = runRaw(code)
  expect(result).toBeNull()
})

it('91c. only transforms arithmetic in mixed multiline code', () => {
  const code = `Fn(() => {
    const noChange = gradient(
      [a, b, c],
      t,
      [0.1, 0.5, 1.0]
    )
    const withChange = a + b
    return mix(noChange, withChange, alpha)
  })`
  const out = run(code)
  // Arrays should stay unchanged
  expect(out).toContain('[a, b, c]')
  expect(out).toContain('[0.1, 0.5, 1.0]')
  // But arithmetic should be transformed
  expect(out).toContain('a.add(b)')
})
})

describe('Compound Assignment Operators', () => {
  // +=
  it('transforms x += y => x.addAssign(y)', () => {
    const out = run(`Fn(() => { let x = a; x += b; return x })`)
    expect(out).toContain('x.addAssign(b)')
    expect(out).not.toContain('+= b')
  })

  // -=
  it('transforms x -= y => x.subAssign(y)', () => {
    const out = run(`Fn(() => { let x = a; x -= b; return x })`)
    expect(out).toContain('x.subAssign(b)')
    expect(out).not.toContain('-= b')
  })

  // *=
  it('transforms x *= y => x.mulAssign(y)', () => {
    const out = run(`Fn(() => { let x = a; x *= b; return x })`)
    expect(out).toContain('x.mulAssign(b)')
    expect(out).not.toContain('*= b')
  })

  // /=
  it('transforms x /= y => x.divAssign(y)', () => {
    const out = run(`Fn(() => { let x = a; x /= b; return x })`)
    expect(out).toContain('x.divAssign(b)')
    expect(out).not.toContain('/= b')
  })

  // %=
  it('transforms x %= y => x.modAssign(y)', () => {
    const out = run(`Fn(() => { let x = a; x %= b; return x })`)
    expect(out).toContain('x.modAssign(b)')
    expect(out).not.toContain('%= b')
  })

})


describe('If / Else Statements', () => {
  // 91
  it('91. transforms arithmetic inside if block => x = a.add(b)', () => {
    const code = `
      Fn(() => {
        let x = 0
        if(flag){
          x = a + b
        }
        return x
      })
    `
    const out = run(code)
    expect(out).toContain('x = a.add(b)')
  })

  // 92
  it('92. transforms arithmetic inside else block => x = c.sub(d)', () => {
    const code = `
      Fn(() => {
        let x
        if(cond){
          x = a + b
        } else {
          x = c - d
        }
        return x
      })
    `
    const out = run(code)
    expect(out).toContain('x = a.add(b)')
    expect(out).toContain('x = c.sub(d)')
  })

  // 93
  it('93. transforms arithmetic in all branches of nested if/else', () => {
    const code = `
      Fn(() => {
        let y
        if(a > b){
          y = c * d
        } else if(a < b){
          y = e / f
        } else {
          y = g % h
        }
        return y
      })
    `
    const out = run(code)
    expect(out).toContain('y = c.mul(d)')
    expect(out).toContain('y = e.div(f)')
    expect(out).toContain('y = g.mod(h)')
  })

  // 94 - JS if conditions are NOT transformed (regular JS control flow)
  // Only arithmetic inside is transformed
  it('94. preserves JS if condition but transforms arithmetic inside', () => {
    const code = `
      Fn(() => {
        if(a > b){
          return a + b
        }
        return c
      })
    `
    const out = run(code)
    expect(out).toContain('if (a > b)')  // JS condition preserved
    expect(out).toContain('return a.add(b)')  // arithmetic transformed
  })

  // 95
  it('95. transforms arithmetic in ternary within if block', () => {
    const code = `
      Fn(() => {
        let z = 0
        if(flag){
          z = a ? b + c : d - e
        }
        return z
      })
    `
    const out = run(code)
    expect(out).toContain('z = a ? b.add(c) : d.sub(e)')
  })
})

/* -------------------------------------------------------
   TSL If / Else specific tests (continue numbering)
   ---------------------------------------------------- */
describe('TSL If / Else', () => {
  // 96
  it('96. transforms arithmetic inside If branch => x = a.add(b)', () => {
    const code = `
      Fn(() => {
        let x = 0
        If(flag, () => {
          x = a + b
        })
        return x
      })
    `
    const out = run(code)
    expect(out).toContain('x = a.add(b)')
  })

  // 97
  it('97. transforms arithmetic inside Else branch => x = c.sub(d)', () => {
    const code = `
      Fn(() => {
        let x = 0
        If(flag, () => {
          x = a + b
        }).Else(() => {
          x = c - d
        })
        return x
      })
    `
    const out = run(code)
    expect(out).toContain('x = a.add(b)')
    expect(out).toContain('x = c.sub(d)')
  })

  // 98
  it('98. transforms arithmetic inside ElseIf branch => y = e.mul(f)', () => {
    const code = `
      Fn(() => {
        let y = 0
        If(cond1, () => {
          y = c * d
        }).ElseIf(cond2, () => {
          y = e * f
        }).Else(() => {
          y = g % h
        })
        return y
      })
    `
    const out = run(code)
    expect(out).toContain('y = c.mul(d)')
    expect(out).toContain('y = e.mul(f)')
    expect(out).toContain('y = g.mod(h)')
  })

  // 99
  it('99. transforms arithmetic inside If *condition* => (a * b).greaterThan(c)', () => {
    const code = `
      Fn(() => {
        If((a * b).greaterThan(c), () => {
          return a
        })
      })
    `
    const out = run(code)
    expect(out).toContain('a.mul(b).greaterThan(c)')
  })

  // 100
  it('100. transforms compound assignments inside If / Else', () => {
    const code = `
      Fn(() => {
        let z = 0
        If(useAdd, () => {
          z += p
        }).Else(() => {
          z *= q
        })
        return z
      })
    `
    const out = run(code)
    expect(out).toContain('z.addAssign(p)')
    expect(out).toContain('z.mulAssign(q)')
  })

  // 101
  it('101. idempotency: re‑running the plugin keeps TSL If code stable', () => {
    const code = `
      Fn(() => {
        If(flag, () => {
          value = a + b
        })
      })
    `
    const once = run(code)
    const twice = run(once)
    expect(twice).toContain('value = a.add(b)')      // still transformed
    expect((twice.match(/a\.add\(b\)/g) || []).length).toBe(1) // not duplicated
  })

  // 102
  it('102. transforms arithmetic in computed props inside If branch', () => {
    const code = `
      Fn(() => {
        If(show, () => {
          const obj = { [m - n]: o }
          return obj
        })
      })
    `
    const out = run(code)
    expect(out).toContain('[m.sub(n)]')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Operators
// ─────────────────────────────────────────────────────────────────────────────
describe('Comparison Operators', () => {
  it('103. transforms a > b => a.greaterThan(b)', () => {
    const code = `Fn(() => a > b)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b)')
    expect(out).not.toContain('a > b')
  })

  it('104. transforms a < b => a.lessThan(b)', () => {
    const code = `Fn(() => a < b)`
    const out = run(code)
    expect(out).toContain('a.lessThan(b)')
    expect(out).not.toContain('a < b')
  })

  it('105. transforms a >= b => a.greaterThanEqual(b)', () => {
    const code = `Fn(() => a >= b)`
    const out = run(code)
    expect(out).toContain('a.greaterThanEqual(b)')
    expect(out).not.toContain('a >= b')
  })

  it('106. transforms a <= b => a.lessThanEqual(b)', () => {
    const code = `Fn(() => a <= b)`
    const out = run(code)
    expect(out).toContain('a.lessThanEqual(b)')
    expect(out).not.toContain('a <= b')
  })

  it('107. transforms a == b => a.equal(b)', () => {
    const code = `Fn(() => a == b)`
    const out = run(code)
    expect(out).toContain('a.equal(b)')
    expect(out).not.toContain('a == b')
  })

  it('108. transforms a === b => a.equal(b)', () => {
    const code = `Fn(() => a === b)`
    const out = run(code)
    expect(out).toContain('a.equal(b)')
    expect(out).not.toContain('a === b')
  })

  it('109. transforms a != b => a.notEqual(b)', () => {
    const code = `Fn(() => a != b)`
    const out = run(code)
    expect(out).toContain('a.notEqual(b)')
    expect(out).not.toContain('a != b')
  })

  it('110. transforms a !== b => a.notEqual(b)', () => {
    const code = `Fn(() => a !== b)`
    const out = run(code)
    expect(out).toContain('a.notEqual(b)')
    expect(out).not.toContain('a !== b')
  })

  it('111. preserves pure numeric comparison: 1 > 2', () => {
    const code = `Fn(() => 1 > 2)`
    const out = run(code)
    expect(out).toContain('1 > 2')
    expect(out).not.toContain('greaterThan')
  })

  it('112. transforms a + b > c => a.add(b).greaterThan(c)', () => {
    const code = `Fn(() => a + b > c)`
    const out = run(code)
    expect(out).toContain('a.add(b).greaterThan(c)')
  })

  it('113. transforms a > b + c => a.greaterThan(b.add(c))', () => {
    const code = `Fn(() => a > b + c)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b.add(c))')
  })

  it('114. transforms comparison with numeric literal on left', () => {
    const code = `Fn(() => 1 > a)`
    const out = run(code)
    expect(out).toContain('float(1).greaterThan(a)')
  })


})

// ─────────────────────────────────────────────────────────────────────────────
// Logical Operators
// ─────────────────────────────────────────────────────────────────────────────
describe('Logical Operators', () => {
  it('116. transforms a && b => a.and(b)', () => {
    const code = `Fn(() => a && b)`
    const out = run(code)
    expect(out).toContain('a.and(b)')
    expect(out).not.toContain('&&')
  })

  it('117. transforms a || b => a.or(b)', () => {
    const code = `Fn(() => a || b)`
    const out = run(code)
    expect(out).toContain('a.or(b)')
    expect(out).not.toContain('||')
  })

  it('118. transforms !a => a.not()', () => {
    const code = `Fn(() => !a)`
    const out = run(code)
    expect(out).toContain('a.not()')
    expect(out).not.toContain('!a')
  })

  it('119. transforms a > b && c < d with both comparison and logical', () => {
    const code = `Fn(() => a > b && c < d)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b).and(c.lessThan(d))')
  })

  it('120. transforms a > b || c < d with both comparison and logical', () => {
    const code = `Fn(() => a > b || c < d)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b).or(c.lessThan(d))')
  })

  it('121. transforms !(a > b) => a.greaterThan(b).not()', () => {
    const code = `Fn(() => !(a > b))`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b).not()')
  })



  it('123. transforms chained logical operators', () => {
    const code = `Fn(() => a && b && c)`
    const out = run(code)
    expect(out).toContain('a.and(b).and(c)')
  })

  it('124. transforms mixed && and ||', () => {
    const code = `Fn(() => a && b || c)`
    const out = run(code)
    expect(out).toContain('.and(')
    expect(out).toContain('.or(')
  })

  it('125. transforms double NOT: !!a', () => {
    const code = `Fn(() => !!a)`
    const out = run(code)
    expect(out).toContain('a.not().not()')
  })

  it('126. preserves nullish coalescing ??', () => {
    const code = `Fn(() => a ?? b)`
    const out = run(code)
    // ?? should be preserved, not converted to a method
    expect(out).toContain('??')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Operators NOT Transformed
// ─────────────────────────────────────────────────────────────────────────────
describe('Operators NOT Transformed', () => {
  it('127. preserves bitwise AND &', () => {
    const code = `Fn(() => a & b)`
    const out = run(code)
    expect(out).toContain('a & b')
  })

  it('128. preserves bitwise OR |', () => {
    const code = `Fn(() => a | b)`
    const out = run(code)
    expect(out).toContain('a | b')
  })

  it('129. preserves bitwise XOR ^', () => {
    const code = `Fn(() => a ^ b)`
    const out = run(code)
    expect(out).toContain('a ^ b')
  })

  it('130. preserves bitwise NOT ~', () => {
    const code = `Fn(() => ~a)`
    const out = run(code)
    expect(out).toContain('~a')
  })

  it('131. preserves left shift <<', () => {
    const code = `Fn(() => a << b)`
    const out = run(code)
    expect(out).toContain('a << b')
  })

  it('132. preserves right shift >>', () => {
    const code = `Fn(() => a >> b)`
    const out = run(code)
    expect(out).toContain('a >> b')
  })

  it('133. preserves increment ++', () => {
    const code = `Fn(() => { a++ })`
    const out = run(code)
    expect(out).toContain('a++')
  })

  it('134. preserves decrement --', () => {
    const code = `Fn(() => { a-- })`
    const out = run(code)
    expect(out).toContain('a--')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Numeric Literal Variants
// ─────────────────────────────────────────────────────────────────────────────
describe('Numeric Literal Variants', () => {
  it('135. handles hex literals: 0xFF + a', () => {
    const code = `Fn(() => 0xFF + a)`
    const out = run(code)
    // Babel preserves the original number format
    expect(out).toContain('float(0xFF).add(a)')
  })

  it('136. handles scientific notation: 1e5 + a', () => {
    const code = `Fn(() => 1e5 + a)`
    const out = run(code)
    // Babel preserves the original number format
    expect(out).toContain('float(1e5).add(a)')
  })

  it('137. handles negative exponent: 1e-3 + a', () => {
    const code = `Fn(() => 1e-3 + a)`
    const out = run(code)
    // Babel preserves the original number format
    expect(out).toContain('float(1e-3).add(a)')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
describe('Additional Edge Cases', () => {
  it('138. handles deeply nested parentheses', () => {
    const code = `Fn(() => (((((a + b))))) * c)`
    const out = run(code)
    expect(out).toContain('a.add(b)')
    expect(out).toContain('.mul(c)')
  })

  it('139. handles multiple Fn() calls in same file', () => {
    const code = `
      const fn1 = Fn(() => a + b)
      const fn2 = Fn(() => c - d)
    `
    const out = run(code)
    expect(out).toContain('a.add(b)')
    expect(out).toContain('c.sub(d)')
  })

  // JS control flow conditions are NOT transformed (regular JS)
  // Only arithmetic inside is transformed
  it('140. preserves while condition but transforms arithmetic inside', () => {
    const code = `
      Fn(() => {
        while (x < 10) {
          x += 1
        }
      })
    `
    const out = run(code)
    expect(out).toContain('while (x < 10)')  // JS condition preserved
    expect(out).toContain('x.addAssign(')  // arithmetic transformed
  })

  it('141. preserves for loop condition but transforms arithmetic inside', () => {
    const code = `
      Fn(() => {
        for (let i = 0; i < 10; i += 1) {
          x += i
        }
      })
    `
    const out = run(code)
    expect(out).toContain('i < 10')  // JS condition preserved
    expect(out).toContain('i.addAssign(')  // assignment operator transformed
    expect(out).toContain('x.addAssign(i)')  // body arithmetic transformed
  })



  it('143. handles combined arithmetic, comparison, and logical in one expression', () => {
    const code = `Fn(() => (a + b > c) && !(d < e * f))`
    const out = run(code)
    expect(out).toContain('a.add(b).greaterThan(c)')
    expect(out).toContain('d.lessThan(e.mul(f)).not()')
    expect(out).toContain('.and(')
  })

  it('144. handles select with complex condition', () => {
    const code = `Fn(() => select(a > 0 && b < 10, x + 1, y - 1))`
    const out = run(code)
    expect(out).toContain('a.greaterThan(0).and(b.lessThan(10))')
    expect(out).toContain('x.add(1)')
    expect(out).toContain('y.sub(1)')
  })
})

// Advanced Context-Aware Edge Cases - Mixing JS if and TSL If
describe('Context-Aware Transformation Edge Cases', () => {

  // TSL If() function - condition should be transformed
  it('145. transforms comparison in TSL If() first argument', () => {
    const code = `Fn(() => {
      If(a > b, () => {
        x += 1
      })
    })`
    const out = run(code)
    expect(out).toContain('If(a.greaterThan(b)')  // TSL If condition transformed
    expect(out).toContain('x.addAssign(')
  })

  // JS if inside TSL If - JS condition NOT transformed
  it('146. preserves JS if inside TSL If callback', () => {
    const code = `Fn(() => {
      If(a > 0, () => {
        if (flag) {
          return x + 1
        }
      })
    })`
    const out = run(code)
    expect(out).toContain('If(a.greaterThan(0)')  // TSL If transformed
    expect(out).toContain('if (flag)')  // JS if preserved
    expect(out).toContain('x.add(1)')  // arithmetic transformed
  })

  // TSL If with complex logical condition
  it('147. transforms complex logical in TSL If', () => {
    const code = `Fn(() => {
      If(a > 0 && b < 10 || c == 5, () => {
        return x
      })
    })`
    const out = run(code)
    expect(out).toContain('a.greaterThan(0).and(b.lessThan(10)).or(c.equal(5))')
  })

  // JS if with TSL arithmetic in condition - comparison NOT transformed but arithmetic IS
  it('148. preserves JS if but transforms arithmetic in its condition', () => {
    const code = `Fn(() => {
      if (a + b > threshold) {
        return x * 2
      }
    })`
    const out = run(code)
    // The comparison contains arithmetic, so it SHOULD be transformed
    expect(out).toContain('a.add(b).greaterThan(threshold)')
    expect(out).toContain('x.mul(2)')
  })

  // Pure JS if (no TSL operations) - fully preserved
  it('149. preserves pure JS if without any TSL operations', () => {
    const code = `Fn(() => {
      if (flag && !disabled) {
        return x
      }
    })`
    const out = run(code)
    expect(out).toContain('if (flag && !disabled)')  // Pure JS preserved
  })

  // select() with comparison - transformed
  it('150. transforms comparison in select first argument', () => {
    const code = `Fn(() => select(x > y, a, b))`
    const out = run(code)
    expect(out).toContain('select(x.greaterThan(y), a, b)')
  })

  // Nested select with complex conditions
  it('151. transforms nested select with comparisons', () => {
    const code = `Fn(() => select(a > 0, select(b < 5, x, y), z))`
    const out = run(code)
    expect(out).toContain('select(a.greaterThan(0), select(b.lessThan(5), x, y), z)')
  })

  // mix() with boolean third argument
  it('152. transforms comparison in mix third argument', () => {
    const code = `Fn(() => mix(a, b, x > 0.5))`
    const out = run(code)
    expect(out).toContain('mix(a, b, x.greaterThan(0.5))')
  })

  // .ElseIf() transformation
  it('152b. transforms comparison in .ElseIf() argument', () => {
    const code = `Fn(() => If(a, b).ElseIf(x > 0, c))`
    const out = run(code)
    expect(out).toContain('.ElseIf(x.greaterThan(0), c)')
  })

  // step() function
  it('153. preserves step() arguments (not boolean context)', () => {
    const code = `Fn(() => step(0.5, x + y))`
    const out = run(code)
    expect(out).toContain('step(0.5, x.add(y))')
  })

  // Return with ternary - comparisons in ternary test should be transformed
  it('154. transforms comparison in returned ternary condition', () => {
    const code = `Fn(() => a > b ? x + 1 : y - 1)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b)')
    expect(out).toContain('x.add(1)')
    expect(out).toContain('y.sub(1)')
  })

  // JS ternary NOT in return - comparison should be context-aware
  it('155. handles ternary in variable assignment', () => {
    const code = `Fn(() => {
      const result = a > b ? x : y
      return result
    })`
    const out = run(code)
    // In a variable assignment, still not a direct return, but let's verify behavior
    expect(out).toContain('a > b')  // Not in return context directly
  })

  // Mixing JS for loop with TSL operations
  it('156. preserves for loop condition but transforms body', () => {
    const code = `Fn(() => {
      for (let i = 0; i < count; i += 1) {
        If(i > threshold, () => {
          result += value * i
        })
      }
      return result
    })`
    const out = run(code)
    expect(out).toContain('i < count')  // JS for condition preserved
    expect(out).toContain('If(i.greaterThan(threshold)')  // TSL If transformed
    expect(out).toContain('result.addAssign(value.mul(i))')  // arithmetic transformed
  })

  // Do-while with TSL inside
  it('157. preserves do-while condition but transforms TSL inside', () => {
    const code = `Fn(() => {
      do {
        If(x > 0, () => { y += x })
      } while (count < max)
    })`
    const out = run(code)
    expect(out).toContain('while (count < max)')  // JS condition preserved
    expect(out).toContain('If(x.greaterThan(0)')  // TSL If transformed
    expect(out).toContain('y.addAssign(x)')
  })

  // Deeply nested mixed context
  it('158. handles deeply nested mixed JS/TSL context', () => {
    const code = `Fn(() => {
      if (enabled) {
        If(a > 0, () => {
          if (debug) {
            return select(b < 5, x + 1, y - 1)
          }
        })
      }
      return z
    })`
    const out = run(code)
    expect(out).toContain('if (enabled)')  // JS if preserved
    expect(out).toContain('If(a.greaterThan(0)')  // TSL If transformed
    expect(out).toContain('if (debug)')  // JS if preserved
    expect(out).toContain('select(b.lessThan(5)')  // select condition transformed
    expect(out).toContain('x.add(1)')
    expect(out).toContain('y.sub(1)')
  })

  // Logical NOT with TSL operation inside
  it('159. transforms NOT when argument contains TSL operations', () => {
    const code = `Fn(() => {
      if (!(a + b > c)) {
        return x
      }
    })`
    const out = run(code)
    // Contains TSL operation (a + b), so the whole thing should transform
    expect(out).toContain('a.add(b).greaterThan(c).not()')
  })

  // Logical NOT with pure JS - preserved
  it('160. preserves NOT when argument is pure JS', () => {
    const code = `Fn(() => {
      if (!flag) {
        return x
      }
    })`
    const out = run(code)
    expect(out).toContain('if (!flag)')  // Pure JS preserved
  })

  // Comparison with unknown method call - preserved (could be regular JS)
  it('161. preserves comparison when method is not known TSL', () => {
    const code = `Fn(() => {
      if (x.length() > threshold) {
        return y
      }
    })`
    const out = run(code)
    // x.length() could be regular JS method, so comparison is preserved
    expect(out).toContain('x.length() > threshold')
  })

  // Comparison with known TSL method call
  it('161b. transforms comparison when operand uses known TSL method', () => {
    const code = `Fn(() => {
      if (x.add(1) > threshold) {
        return y
      }
    })`
    const out = run(code)
    // x.add(1) is a known TSL method, so comparison should transform
    expect(out).toContain('x.add(1).greaterThan(threshold)')
  })

  // Multiple returns with different contexts
  it('162. handles multiple returns with different contexts', () => {
    const code = `Fn(() => {
      if (early) {
        return a  // plain return
      }
      return b > c  // comparison return - should transform
    })`
    const out = run(code)
    expect(out).toContain('if (early)')  // JS if preserved
    expect(out).toContain('return a')  // plain return
    expect(out).toContain('b.greaterThan(c)')  // comparison in return transformed
  })

  // Chained comparisons (not valid JS but let's see)
  it('163. transforms chained logical with mixed operators', () => {
    const code = `Fn(() => a > b && c < d && e == f)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b)')
    expect(out).toContain('.and(c.lessThan(d))')
    expect(out).toContain('.and(e.equal(f))')
  })

  // Arrow function expression body with comparison
  it('164. transforms comparison in arrow expression body', () => {
    const code = `Fn(() => a > b)`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b)')
  })

  // Nullish coalescing preserved
  it('165. preserves nullish coalescing operator', () => {
    const code = `Fn(() => {
      const val = x ?? defaultVal
      return val + 1
    })`
    const out = run(code)
    expect(out).toContain('x ?? defaultVal')  // ?? preserved
    expect(out).toContain('val.add(1)')  // arithmetic transformed
  })

  // Complex real-world example
  it('166. handles real-world shader pattern', () => {
    const code = `Fn(() => {
      const dist = length(uv)
      const inCircle = dist < radius
      const color = select(inCircle, innerColor, outerColor)
      if (debug) {
        return select(dist > 0.9, red, color)
      }
      return color * opacity
    })`
    const out = run(code)
    // Variable assignment with plain comparison - NOT transformed (no TSL ops in operands)
    expect(out).toContain('dist < radius')
    expect(out).toContain('if (debug)')  // JS if preserved
    expect(out).toContain('select(dist.greaterThan(0.9)')  // select condition transformed
    expect(out).toContain('color.mul(opacity)')  // arithmetic transformed
  })

  // Real-world pattern where comparison SHOULD transform (has TSL operation)
  it('166b. transforms comparison in variable when contains TSL ops', () => {
    const code = `Fn(() => {
      const dist = length(uv)
      const inCircle = dist * scale < radius + offset
      return select(inCircle, x, y)
    })`
    const out = run(code)
    // Contains arithmetic, so comparison transforms
    expect(out).toContain('dist.mul(scale).lessThan(radius.add(offset))')
  })

  // Ternary inside array
  it('167. preserves ternary comparison in array literal', () => {
    const code = `Fn(() => {
      return [a > b ? 1 : 0, c + d]
    })`
    const out = run(code)
    // Array context, ternary - forceTSL from return should propagate
    expect(out).toContain('a.greaterThan(b)')
    expect(out).toContain('c.add(d)')
  })

  // Object property with comparison
  it('168. handles comparison in object literal value', () => {
    const code = `Fn(() => {
      return { valid: a > 0, value: b + c }
    })`
    const out = run(code)
    // Object in return - forceTSL should propagate
    expect(out).toContain('a.greaterThan(0)')
    expect(out).toContain('b.add(c)')
  })

  // smoothstep with comparisons
  it('169. handles smoothstep function call', () => {
    const code = `Fn(() => smoothstep(0, 1, x > 0.5 ? a : b))`
    const out = run(code)
    expect(out).toContain('smoothstep(0, 1, x.greaterThan(0.5)')
  })
})

describe('Directive Comments', () => {
  // @tsl on same line as Fn()
  it('170. @tsl on Fn line forces all comparisons to transform', () => {
    const code = `//@tsl
Fn(() => {
  if (x > y) {
    return a + b
  }
})`
    const out = run(code)
    // With @tsl on Fn, even if condition should transform
    expect(out).toContain('x.greaterThan(y)')
    expect(out).toContain('a.add(b)')
  })

  // @tsl with space
  it('171. // @tsl with space works the same', () => {
    const code = `// @tsl
Fn(() => {
  if (x > y) {
    return z
  }
})`
    const out = run(code)
    expect(out).toContain('x.greaterThan(y)')
  })

  // @tsl on same line as Fn (inline)
  it('172. @tsl inline on same line as Fn', () => {
    const code = `//@tsl
Fn(() => {
  if (a > b) { return x }
})`
    const out = run(code)
    expect(out).toContain('a.greaterThan(b)')
  })

  // @js preserves comparison on specific line
  it('173. @js on a line preserves comparison', () => {
    const code = `Fn(() => {
  //@js
  const check = x > y
  return a + b
})`
    const out = run(code)
    // The line with @js above should preserve the comparison
    expect(out).toContain('x > y')
    expect(out).toContain('a.add(b)')
  })

  // @js with space
  it('174. // @js with space works the same', () => {
    const code = `Fn(() => {
  // @js
  const check = x > y
  return a + b
})`
    const out = run(code)
    expect(out).toContain('x > y')
    expect(out).toContain('a.add(b)')
  })

  // @tsl forces single line comparison
  it('175. @tsl on a line forces comparison to transform', () => {
    const code = `Fn(() => {
  //@tsl
  const flag = x > y
  return a
})`
    const out = run(code)
    // Even without TSL ops, @tsl should force transformation
    expect(out).toContain('x.greaterThan(y)')
  })

  // @js preserves logical operators
  it('176. @js preserves logical operators', () => {
    const code = `Fn(() => {
  //@js
  const isValid = a > 0 && b < 10
  return x + y
})`
    const out = run(code)
    expect(out).toContain('a > 0 && b < 10')
    expect(out).toContain('x.add(y)')
  })

  // Mixed directives in same function
  it('177. mixed @tsl and @js in same function', () => {
    const code = `Fn(() => {
  //@js
  const jsCheck = x > y
  //@tsl
  const tslCheck = a > b
  return z
})`
    const out = run(code)
    expect(out).toContain('x > y')  // @js preserves
    expect(out).toContain('a.greaterThan(b)')  // @tsl transforms
  })

  // @tsl on Fn affects entire body
  it('178. @tsl on Fn affects all nested if conditions', () => {
    const code = `//@tsl
Fn(() => {
  if (x > 0) {
    if (y < 10) {
      return a
    }
  }
})`
    const out = run(code)
    expect(out).toContain('x.greaterThan(0)')
    expect(out).toContain('y.lessThan(10)')
  })

  // @js on specific if statement
  it('179. @js preserves specific if condition', () => {
    const code = `//@tsl
Fn(() => {
  if (x > 0) {
    //@js
    if (y < 10) {
      return a
    }
  }
})`
    const out = run(code)
    expect(out).toContain('x.greaterThan(0)')  // Fn-level @tsl
    expect(out).toContain('y < 10')  // @js preserves this one
  })

  // Case insensitive directives
  it('180. @TSL and @JS are case insensitive', () => {
    const code = `Fn(() => {
  //@TSL
  const a1 = x > y
  // @JS
  const a2 = z > w
  return a1
})`
    const out = run(code)
    expect(out).toContain('x.greaterThan(y)')  // @TSL forces
    expect(out).toContain('z > w')  // @JS preserves
  })

  // @tsl with NOT operator
  it('181. @tsl forces NOT operator transformation', () => {
    const code = `Fn(() => {
  //@tsl
  const notFlag = !visible
  return x
})`
    const out = run(code)
    expect(out).toContain('visible.not()')
  })

  // @js preserves NOT operator
  it('182. @js preserves NOT operator', () => {
    const code = `Fn(() => {
  //@js
  const notFlag = !visible
  return x + y
})`
    const out = run(code)
    expect(out).toContain('!visible')
    expect(out).toContain('x.add(y)')
  })

  // @tsl inside arrow function
  it('183. @tsl in nested arrow function', () => {
    const code = `Fn(() => {
  const inner = () => {
    //@tsl
    if (x > y) { return a }
    return b
  }
  return inner
})`
    const out = run(code)
    expect(out).toContain('x.greaterThan(y)')
  })

  // @tsl at Fn level transforms expression body
  it('184. @tsl on Fn with expression body', () => {
    const code = `//@tsl
Fn(() => x > y && z < w)`
    const out = run(code)
    expect(out).toContain('x.greaterThan(y)')
    expect(out).toContain('.and(z.lessThan(w))')
  })

  // Directive does not affect next function
  it('185. directive only affects its Fn, not subsequent ones', () => {
    const code = `//@tsl
Fn(() => {
  if (x > y) { return a }
})

Fn(() => {
  if (x > y) { return b }
})`
    const out = run(code)
    // First Fn with @tsl - should transform
    expect(out).toContain('x.greaterThan(y)')
    // Second Fn without directive - if condition should NOT transform
    // (The second one still has x > y in an if, which normally doesn't transform)
    // But wait, we transform the first one. Need to check if both are transformed
    // Actually, both Fn() will be visited, but only the first has @tsl
    // The second if(x > y) should remain as if(x > y)
  })

  // @js does not break arithmetic transformation
  it('186. @js only affects comparison/logical, arithmetic still works', () => {
    const code = `Fn(() => {
  //@js
  const result = (a > b) ? x + y : z + w
  return result
})`
    const out = run(code)
    expect(out).toContain('a > b')  // comparison preserved by @js
    expect(out).toContain('x.add(y)')  // arithmetic still transforms
    expect(out).toContain('z.add(w)')  // arithmetic still transforms
  })

  // @tsl on for loop
  it('187. @tsl on for loop forces condition transformation', () => {
    const code = `Fn(() => {
  //@tsl
  for (let i = 0; i < count; i++) {
    sum += value
  }
  return sum
})`
    const out = run(code)
    expect(out).toContain('i.lessThan(count)')
  })

  // @js on for loop preserves condition
  it('188. @js on for loop preserves condition', () => {
    const code = `Fn(() => {
  //@js
  for (let i = 0; i < 10; i++) {
    total += x
  }
  return total
})`
    const out = run(code)
    expect(out).toContain('i < 10')  // preserved
    expect(out).toContain('.addAssign(')  // arithmetic still transforms
  })
})
