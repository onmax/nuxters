const GLOBE_RADIUS = 0.812

export function globeMinimumDepth(containerWidth: number, scale: number): number {
  const projectedLimit = 0.8 - 28 / (containerWidth * scale)
  return Math.sqrt(Math.max(0, GLOBE_RADIUS ** 2 - projectedLimit ** 2))
}

export function isGlobePointVisible(
  [latitude, longitude]: readonly [number, number],
  sinPhi: number,
  cosPhi: number,
  sinTheta: number,
  cosTheta: number,
  minimumDepth: number,
): boolean {
  const latitudeRadians = latitude * Math.PI / 180
  const longitudeRadians = longitude * Math.PI / 180 - Math.PI
  const cosLatitude = Math.cos(latitudeRadians)
  const x = -cosLatitude * Math.cos(longitudeRadians) * GLOBE_RADIUS
  const y = Math.sin(latitudeRadians) * GLOBE_RADIUS
  const z = cosLatitude * Math.sin(longitudeRadians) * GLOBE_RADIUS
  const depth = -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z

  return depth >= minimumDepth
}
