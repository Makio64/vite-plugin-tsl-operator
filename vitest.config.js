import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import TSLOperatorPlugin from './src/index.js'

export default defineConfig({
  test: {
    projects: [
      // Node tests (existing transformation tests)
      {
        plugins: [
          // Apply the TSL operator plugin to transform test code
          TSLOperatorPlugin({ logs: true }),
        ],
        test: {
          name: 'unit',
          include: ['test/index.test.js'],
          environment: 'node',
        },
      },
      // Browser tests (new runtime verification)
      {
        plugins: [
          // Apply the TSL operator plugin to transform test code
          TSLOperatorPlugin({ logs: true }),
        ],
        test: {
          name: 'browser',
          include: ['test/runtime.test.js'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            headless: false,
            viewport: { width: 256, height: 256 },
            providerOptions: {
              launch: {
                deviceScaleFactor: 1,
                args: [
                  '--enable-unsafe-webgpu',
                  '--enable-features=Vulkan',
                  '--use-angle=swiftshader',
                  '--use-gl=angle',
                ],
              },
            },
          },
        },
      },
    ],
  },
})
