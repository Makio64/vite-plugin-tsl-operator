// Runtime verification tests for TSL shader compilation
// These tests use direct TSL method calls to verify the runtime works correctly
// This validates that transformed code WOULD work if the plugin transforms correctly

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { page } from 'vitest/browser'

// Static imports for Three.js
import * as THREE from 'three'
import { WebGPURenderer, MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn, float, vec2, vec3, vec4,
  uv, sin, floor, select
} from 'three/tsl'

// Test both WebGL and WebGPU backends
const backends = [
  { name: 'WebGL', forceWebGL: true },
  { name: 'WebGPU', forceWebGL: false },
]

describe.each(backends)('TSL Runtime - $name', ({ name: backendName, forceWebGL }) => {
  let renderer
  let scene
  let camera
  let consoleErrors = []
  let originalConsoleError

  // Helper to compile and render a TSL shader function
  const compileAndRender = async (shaderFn, testName) => {
    const material = new MeshBasicNodeMaterial()
    material.colorNode = shaderFn()

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    renderer.render(scene, camera)
    await new Promise(r => setTimeout(r, 100))
    renderer.render(scene, camera)

    const screenshotDir = `test/screenshots/${backendName.toLowerCase()}`
    const safeName = testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const canvas = page.elementLocator(renderer.domElement)
    await canvas.screenshot({ path: `${screenshotDir}/${safeName}.png` })

    scene.remove(mesh)
    geometry.dispose()
    material.dispose()

    return true
  }

  beforeAll(async () => {
    renderer = new WebGPURenderer({ forceWebGL })
    await renderer.init()
    renderer.setSize(256, 256)
    document.body.appendChild(renderer.domElement)

    scene = new THREE.Scene()
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1
  })

  afterAll(() => {
    if (renderer) {
      renderer.dispose()
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  })

  beforeEach(() => {
    consoleErrors = []
    originalConsoleError = console.error
    console.error = (...args) => {
      consoleErrors.push(args.join(' '))
      originalConsoleError.apply(console, args)
    }
  })

  afterEach(() => {
    console.error = originalConsoleError
    expect(consoleErrors, 'Console errors detected').toEqual([])
  })

  // ==========================================
  // Plugin Transform Integration
  // ==========================================
  describe('Plugin Transform Integration', () => {
    it('transforms operator syntax inside Fn()', () => {
      const makeNode = Fn(() => {
        const a = float(0.25)
        const b = float(0.5)
        return a + b
      })

      const node = makeNode()
      expect(typeof node?.add).toBe('function')
    })

    it('transforms assignment operators inside Fn()', () => {
      const makeNode = Fn(() => {
        const a = float(0.25).toVar()
        a += 0.5
        return a
      })

      const node = makeNode()
      expect(typeof node?.addAssign).toBe('function')
    })
  })

  // ==========================================
  // Basic Arithmetic - Direct TSL Methods
  // ==========================================
  describe('Basic Arithmetic', () => {
    it('addition: .add()', async () => {
      const shader = Fn(() => {
        const a = float(0.3)
        const b = float(0.5)
        const result = a + b
        return vec4(result, float(0.4), float(0.2), 1)
      })
      await compileAndRender(shader, 'addition')
    })

    it('subtraction: .sub()', async () => {
      const shader = Fn(() => {
        const a = float(0.8)
        const b = float(0.3)
        const result = a - b
        return vec4(result, float(0.2), float(0.4), 1)
      })
      await compileAndRender(shader, 'subtraction')
    })

    it('multiplication: .mul()', async () => {
      const shader = Fn(() => {
        const a = float(0.6)
        const b = float(0.8)
        const result = a * b
        return vec4(float(0.2), result, float(0.3), 1)
      })
      await compileAndRender(shader, 'multiplication')
    })

    it('division: .div()', async () => {
      const shader = Fn(() => {
        const a = float(0.8)
        const b = float(2.0)
        const result = a / b
        return vec4(result, float(0.5), float(0.2), 1)
      })
      await compileAndRender(shader, 'division')
    })

    it('modulo: .mod()', async () => {
      const shader = Fn(() => {
        const a = float(0.7)
        const b = float(0.3)
        const result = a % b + 0.5
        return vec4(result, float(0.3), float(0.7), 1)
      })
      await compileAndRender(shader, 'modulo')
    })
  })

  // ==========================================
  // Assignment Operators - Direct TSL Methods
  // ==========================================
  describe('Assignment Operators', () => {
    it('addAssign: .addAssign()', async () => {
      const shader = Fn(() => {
        const a = float(0.3).toVar()
        const b = float(0.4)
        a += b
        return vec4(a, float(0.2), float(0.35), 1)
      })
      await compileAndRender(shader, 'addAssign')
    })

    it('subAssign: .subAssign()', async () => {
      const shader = Fn(() => {
        const a = float(0.9).toVar()
        a -= 0.2
        return vec4(a, float(0.35), float(0.3), 1)
      })
      await compileAndRender(shader, 'subAssign')
    })

    it('mulAssign: .mulAssign()', async () => {
      const shader = Fn(() => {
        const a = float(0.5).toVar()
        a *= 1.5
        return vec4(float(0.2), a, float(0.35), 1)
      })
      await compileAndRender(shader, 'mulAssign')
    })

    it('divAssign: .divAssign()', async () => {
      const shader = Fn(() => {
        const a = float(0.8).toVar()
        a /= 2.0
        return vec4(float(0.5), a, float(0.2), 1)
      })
      await compileAndRender(shader, 'divAssign')
    })
  })

  // ==========================================
  // Comparison Operators - Direct TSL Methods
  // ==========================================
  describe('Comparison Operators', () => {
    it('greaterThan: .greaterThan()', async () => {
      const shader = Fn(() => {
        const a = float(0.7)
        const b = float(0.3)
        return select(a > b, vec4(0.2, 0.8, 0.3, 1), vec4(0.8, 0.2, 0.3, 1))
      })
      await compileAndRender(shader, 'greaterThan')
    })

    it('lessThan: .lessThan()', async () => {
      const shader = Fn(() => {
        const a = float(0.2)
        const b = float(0.6)
        return select(a < b, vec4(0.3, 0.7, 0.2, 1), vec4(0.7, 0.3, 0.2, 1))
      })
      await compileAndRender(shader, 'lessThan')
    })

    it('greaterThanEqual: .greaterThanEqual()', async () => {
      const shader = Fn(() => {
        const a = float(0.5)
        const b = float(0.5)
        return select(a >= b, vec4(0.2, 0.6, 0.8, 1), vec4(0.8, 0.2, 0.3, 1))
      })
      await compileAndRender(shader, 'greaterThanEqual')
    })

    it('lessThanEqual: .lessThanEqual()', async () => {
      const shader = Fn(() => {
        const a = float(0.4)
        const b = float(0.6)
        return select(a <= b, vec4(0.8, 0.4, 0.2, 1), vec4(0.2, 0.8, 0.4, 1))
      })
      await compileAndRender(shader, 'lessThanEqual')
    })

    it('equal: .equal()', async () => {
      const shader = Fn(() => {
        const a = float(0.5)
        const b = float(0.5)
        return select(a == b, vec4(0.3, 0.8, 0.5, 1), vec4(0.8, 0.3, 0.5, 1))
      })
      await compileAndRender(shader, 'equal')
    })

    it('notEqual: .notEqual()', async () => {
      const shader = Fn(() => {
        const a = float(0.3)
        const b = float(0.7)
        return select(a != b, vec4(0.5, 0.3, 0.8, 1), vec4(0.3, 0.5, 0.8, 1))
      })
      await compileAndRender(shader, 'notEqual')
    })
  })

  // ==========================================
  // Logical Operators - Direct TSL Methods
  // ==========================================
  describe('Logical Operators', () => {
    it('and: .and()', async () => {
      const shader = Fn(() => {
        const a = float(0.6)
        const b = float(0.7)
        const cond = (a > 0.5) && (b > 0.5)
        return select(cond, vec4(0.2, 0.7, 0.4, 1), vec4(0.7, 0.2, 0.4, 1))
      })
      await compileAndRender(shader, 'and')
    })

    it('or: .or()', async () => {
      const shader = Fn(() => {
        const a = float(0.3)
        const b = float(0.8)
        const cond = (a > 0.5) || (b > 0.5)
        return select(cond, vec4(0.4, 0.2, 0.8, 1), vec4(0.2, 0.4, 0.8, 1))
      })
      await compileAndRender(shader, 'or')
    })

    it('not: .not()', async () => {
      const shader = Fn(() => {
        const a = float(0.3)
        const cond = !(a > 0.5)
        return select(cond, vec4(0.8, 0.5, 0.2, 1), vec4(0.2, 0.5, 0.8, 1))
      })
      await compileAndRender(shader, 'not')
    })
  })

  // ==========================================
  // Complex Expressions - Direct TSL Methods
  // ==========================================
  describe('Complex Expressions', () => {
    it('nested arithmetic: (a + b) * (c - d)', async () => {
      const shader = Fn(() => {
        const a = float(0.3)
        const b = float(0.4)
        const c = float(0.9)
        const d = float(0.2)
        const result = (a + b) * (c - d)
        return vec4(result, float(0.25), float(0.3), 1)
      })
      await compileAndRender(shader, 'nested-arithmetic')
    })

    it('chained operations: a + b - c', async () => {
      const shader = Fn(() => {
        const a = float(0.5)
        const b = float(0.3)
        const c = float(0.2)
        const result = a + b - c
        return vec4(result, float(0.4), float(0.3), 1)
      })
      await compileAndRender(shader, 'chained-operations')
    })

    it('numeric literal wrapped: float(0.5).add(a)', async () => {
      const shader = Fn(() => {
        const a = float(0.2)
        const result = 0.5 + a
        return vec4(result, float(0.56), float(0.3), 1)
      })
      await compileAndRender(shader, 'numeric-wrapped')
    })

    it('unary minus: a.mul(-1)', async () => {
      const shader = Fn(() => {
        const a = float(0.3)
        const result = -a + 0.8
        return vec4(result, float(0.4), float(0.4), 1)
      })
      await compileAndRender(shader, 'unary-minus')
    })
  })

  // ==========================================
  // Real-World Shader Patterns
  // ==========================================
  describe('Real-World Patterns', () => {
    it('UV gradient shader', async () => {
      const shader = Fn(() => {
        const uvCoord = uv()
        return vec4(uvCoord.x, uvCoord.y, float(0.5), 1)
      })
      await compileAndRender(shader, 'uv-gradient')
    })

    it('color manipulation with brightness', async () => {
      const shader = Fn(() => {
        const color = vec3(0.8, 0.4, 0.2)
        const brightness = float(1.2)
        const adjusted = color * brightness
        return vec4(adjusted, 1)
      })
      await compileAndRender(shader, 'color-brightness')
    })

    it('linear interpolation blend', async () => {
      const shader = Fn(() => {
        const a = vec3(0.9, 0.2, 0.3)
        const b = vec3(0.2, 0.3, 0.9)
        const factor = float(0.5)
        const result = a * factor + b * (1 - factor)
        return vec4(result, 1)
      })
      await compileAndRender(shader, 'linear-blend')
    })

    it('UV-based wave pattern', async () => {
      const shader = Fn(() => {
        const uvCoord = uv()
        const wave = sin(uvCoord.x * 10.0) * 0.5 + 0.5
        return vec4(wave, uvCoord.y * wave, float(0.5), 1)
      })
      await compileAndRender(shader, 'wave-pattern')
    })

    it('checkerboard pattern', async () => {
      const shader = Fn(() => {
        const uvCoord = uv()
        const checker = (floor(uvCoord.x * 8) + floor(uvCoord.y * 8)) % 2
        return vec4(
          checker * 0.7 + 0.2,
          checker * 0.5 + 0.3,
          0.8 - checker * 0.3,
          1
        )
      })
      await compileAndRender(shader, 'checkerboard')
    })
  })

  // ==========================================
  // Edge Cases
  // ==========================================
  describe('Edge Cases', () => {
    it('Math.PI evaluated at JS runtime', async () => {
      const shader = Fn(() => {
        const a = float(Math.PI / 4)
        const result = sin(a)
        return vec4(result, result * 0.5 + 0.5, float(0.3), 1)
      })
      await compileAndRender(shader, 'math-expressions')
    })

    it('vec3 operations', async () => {
      const shader = Fn(() => {
        const a = vec3(0.5, 0.3, 0.7)
        const b = vec3(0.2, 0.4, 0.1)
        const result = a + b
        return vec4(result, 1)
      })
      await compileAndRender(shader, 'vec3-operations')
    })

    it('mixed scalar and vector operations', async () => {
      const shader = Fn(() => {
        const v = vec3(0.4, 0.5, 0.6)
        const s = float(1.5)
        const result = v * s
        return vec4(result, 1)
      })
      await compileAndRender(shader, 'mixed-scalar-vector')
    })
  })
})
