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

test('landing page contains the complete people map', async ({ page }) => {
  await page.goto('/')

  const section = page.locator('.home-people')
  const globe = section.locator('.people-globe')
  const canvas = globe.locator('canvas')
  await expect(globe).toHaveAttribute('data-ready', 'true')
  await expect(canvas).toBeVisible()
  await expect(globe.getByRole('group', { name: 'Globe controls' })).toBeVisible()
  await expect(globe).toHaveAttribute('data-avatar-detail', '0')
  expect(Number(await globe.getAttribute('data-avatar-count'))).toBeGreaterThan(20)
  await expect(section.locator('.home-people__country-flag').first()).toBeVisible()

  await globe.locator('.people-globe__avatar-marker.is-visible').first().dispatchEvent('click')
  const profilePanel = page.getByRole('dialog')
  await expect(profilePanel).toContainText('Merged PRs')
  await expect(profilePanel.getByRole('link', { name: 'View full Nuxter profile' })).toBeVisible()
  await profilePanel.getByRole('button', { name: 'Close' }).click()

  await canvas.dispatchEvent('wheel', { deltaY: -500 })
  await expect(globe).toHaveAttribute('data-zoom', '100')
  await expect(globe).toHaveAttribute('data-avatar-detail', '3')
  await section.getByRole('button', { name: /Paris/ }).click()
  expect(await globe.locator('.people-globe__avatar-marker.is-selected').count()).toBeGreaterThan(20)
  await expect(globe).toHaveAttribute('data-latitude', '49')
  await expect.poll(async () => Number(await globe.getAttribute('data-rendered-latitude'))).toBeGreaterThan(45)

  await canvas.evaluate(element => element.scrollIntoView({ block: 'center' }))
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2 + 140, { steps: 5 })
    await page.mouse.up()
  }
  await expect.poll(async () => Number(await globe.getAttribute('data-latitude'))).toBeGreaterThan(70)
  await expect.poll(async () => Number(await globe.getAttribute('data-rendered-latitude'))).toBeGreaterThan(70)

  await expect(section.getByRole('searchbox', { name: 'Search mapped locations or contributors' })).toBeVisible()
  await expect(section).toContainText('13,634')
  await expect(section).not.toContainText('Regional zoom limit')
  await expect(section).not.toContainText('Approximate locations')
  await expect(section.locator('a[href="/people"]')).toHaveCount(0)
})

test('mobile map keeps location discovery with the globe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const section = page.locator('.home-people')
  const globe = section.locator('.people-globe')
  const browser = section.locator('.home-people__browser')
  await expect(globe).toHaveAttribute('data-ready', 'true')
  await expect(browser).toBeHidden()

  await section.getByRole('button', { name: 'Choose a location' }).click()
  await page.getByRole('combobox', { name: 'Search locations' }).fill('Paris')
  await page.getByRole('option', { name: 'Paris France' }).click()

  await expect(globe).toHaveAttribute('data-latitude', '49')
  await expect(browser).toBeVisible()
  await expect(section.locator('.home-people__selection a').first()).toBeVisible()
})

test('globe expansion prototypes keep the COBE canvas through every variant', async ({ page }) => {
  await page.goto('/prototypes/globe-expand')

  const canvas = page.locator('.prototype-globe canvas')
  await expect(canvas).toBeVisible()

  const peek = page.locator('.peek')
  const collapsedWidth = (await page.locator('.globe-wrap').boundingBox())?.width ?? 0
  await peek.dispatchEvent('click')
  await expect(peek).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(async () => (await page.locator('.globe-wrap').boundingBox())?.width ?? 0).toBeGreaterThan(collapsedWidth)

  await page.keyboard.press('2')
  const orb = page.locator('.orb-card')
  await expect(orb).toBeVisible()
  await orb.dispatchEvent('click')
  await expect(orb).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('3')
  const portal = page.locator('.map-viewport')
  await expect(portal).toBeVisible()
  await portal.dispatchEvent('click')
  await expect(portal).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.prototype-globe canvas')).toHaveCount(1)
})

test('og image for home page', async ({ page }) => {
  await page.goto('/__og-image__/image/og.png')
  await expect(page).toHaveScreenshot()
})
