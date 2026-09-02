import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    nuxtConfig: {
      runtimeConfig: {
        sessionPassword: 'test-session-password-at-least-32-characters',
      },
    },
    setupTimeout: 600_000,
  },
})
test.setTimeout(60_000)

// TODO: figure out how to run these with `@nuxthub/core` module enabled

test('home page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot()
})

test('landing page contains the community globe', async ({ page }) => {
  await page.goto('/')

  const section = page.locator('.home-people')
  const experience = section.locator('.home-people__experience')
  const globe = section.locator('.people-globe')
  const canvas = globe.locator('canvas')
  await expect(globe).toHaveAttribute('data-ready', 'true')
  await expect(canvas).toBeVisible()
  const prototypeSwitcher = section.getByRole('group', { name: 'Globe version' })
  await prototypeSwitcher.getByRole('button', { name: 'Country dots' }).click()
  await expect(page).toHaveURL(/globe=markers/)
  await expect(experience).toHaveAttribute('data-globe-prototype', 'markers')
  await expect(globe.locator('.people-globe__avatar-marker')).toHaveCount(0)
  await expect(canvas).toHaveCount(1)
  await prototypeSwitcher.getByRole('button', { name: 'Avatars' }).click()
  await expect(experience).toHaveAttribute('data-globe-prototype', 'avatars')
  expect(await globe.locator('.people-globe__avatar-marker').count()).toBeGreaterThan(20)
  await expect(section.getByRole('button', { name: /Explore globe/ })).toHaveCount(0)
  await expect(section.locator('.home-people__browser')).toHaveCount(0)
  await expect(globe.getByRole('group', { name: 'Globe controls' })).toHaveCount(0)
  await expect(globe).toHaveAttribute('data-avatar-detail', '0')
  expect(Number(await globe.getAttribute('data-avatar-count'))).toBeGreaterThan(20)
  const avatarPositions = await globe.locator('.people-globe__avatar-marker').evaluateAll(elements => new Set(elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    return `${Math.round(bounds.x)},${Math.round(bounds.y)}`
  })).size)
  expect(avatarPositions).toBeGreaterThan(20)
  await globe.locator('.people-globe__avatar-marker.is-visible').first().dispatchEvent('click')
  const profilePanel = page.getByRole('dialog')
  await expect(profilePanel).toContainText('Merged PRs')
  await expect(profilePanel.getByRole('link', { name: 'View full Nuxter profile' })).toBeVisible()
  await profilePanel.getByRole('button', { name: 'Close' }).click()

  await canvas.dispatchEvent('wheel', { deltaY: -500 })
  await expect(globe).toHaveAttribute('data-zoom', '100')
  await expect(globe).toHaveAttribute('data-avatar-detail', '3')
  await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 })
  await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 420 })
  await canvas.dispatchEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 420 })
  await expect.poll(async () => Number(await globe.getAttribute('data-latitude'))).toBeGreaterThan(70)
  await expect.poll(async () => Number(await globe.getAttribute('data-rendered-latitude'))).toBeGreaterThan(70)

  await expect(page.getByRole('heading', { name: 'Become a Nuxter' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Check my GitHub contributions' })).toBeVisible()
  await expect(section).toContainText('26,287')
  await expect(section).toContainText('164')
  await expect(section).not.toContainText('Regional zoom limit')
  await expect(section).not.toContainText('Approximate locations')
  await expect(section).not.toContainText('Explore the community')
  await expect(section).not.toContainText('Find Nuxters near you')
  await expect(section.locator('a[href="/people"]')).toHaveCount(0)
})

test('mobile keeps the globe without a country browser', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const section = page.locator('.home-people')
  const globe = section.locator('.people-globe')
  await expect(globe).toHaveAttribute('data-ready', 'true')
  await expect(globe).toHaveCSS('position', 'relative')
  await expect(section.locator('.home-people__browser')).toHaveCount(0)
  await expect(section.getByRole('button', { name: /Explore globe/ })).toHaveCount(0)
})

test('og image for home page', async ({ page }) => {
  await page.goto('/__og-image__/image/og.png')
  await expect(page).toHaveScreenshot()
})
