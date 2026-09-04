import { expect, test } from 'vitest'
import { mkdirSync } from 'node:fs'
import peopleMap from '../../public/people.json'
import { globeMinimumDepth, isGlobePointVisible } from '../../app/utils/globe'

let visibleCount = 0
const project = isGlobePointVisible
const outputDirectory = process.env.PERF_OUTPUT_DIR ?? 'performance-results'
mkdirSync(outputDirectory, { recursive: true })

test('projects the homepage avatar set', async ({ bench }) => {
  const locations = peopleMap.locations.map(location => [location.location[0]!, location.location[1]!] as const)
  const minimumDepth = globeMinimumDepth(480, 0.9)
  const phi = 0.8
  const theta = 0.16
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const result = await bench(
    'avatar visibility',
    { writeResult: `${outputDirectory}/avatar-visibility.json` },
    () => {
      let visible = 0
      for (const location of locations)
        visible += Number(project(location, sinPhi, cosPhi, sinTheta, cosTheta, minimumDepth))
      visibleCount = visible
    },
  ).run({ iterations: 100, time: 1_000, warmupIterations: 10, warmupTime: 250 })

  expect(result.throughput.mean).toBeGreaterThan(0)
  expect(visibleCount).toBeGreaterThan(0)
})
