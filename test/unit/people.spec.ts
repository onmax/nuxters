import { describe, expect, it } from 'vitest'
import contributorMeta from '../../public/contributors-meta.json'
import peopleMap from '../../public/people.json'
import { peopleLocations } from '../../app/data/people'

describe('people map data', () => {
  it('uses unique ids and public profiles once', () => {
    const ids = peopleLocations.map(location => location.id)
    const people = peopleLocations.flatMap(location => location.people)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(people).size).toBe(people.length)
  })

  it('keeps every centroid within valid coordinate bounds', () => {
    for (const location of peopleLocations) {
      expect(location.location[0]).toBeGreaterThanOrEqual(-90)
      expect(location.location[0]).toBeLessThanOrEqual(90)
      expect(location.location[1]).toBeGreaterThanOrEqual(-180)
      expect(location.location[1]).toBeLessThanOrEqual(180)
    }
  })

  it('ships broad generated coverage without duplicating contributors', () => {
    const mappedPeople = peopleMap.locations.flatMap(location => location.people)

    expect(peopleMap.totalContributors).toBe(contributorMeta.count)
    expect(peopleMap.mappedContributors).toBeGreaterThan(10000)
    expect(peopleMap.publicProfiles).toBe(peopleMap.mappedContributors + peopleMap.unresolvedProfiles)
    expect(peopleMap.mappedContributors).toBe(mappedPeople.length)
    expect(new Set(mappedPeople).size).toBe(mappedPeople.length)
    expect(peopleMap.locations.length).toBeGreaterThan(1000)
  })
})
