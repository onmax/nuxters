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
  const experience = section.locator('.home-people__experience')
  const globe = section.locator('.people-globe')
  const canvas = globe.locator('canvas')
  await expect(globe).toHaveAttribute('data-ready', 'true')
  await expect(canvas).toBeVisible()
  await expect(experience).toHaveClass(/home-people__experience--collapsed/)
  const collapsedHeight = (await experience.boundingBox())?.height ?? 0
  await section.getByRole('button', { name: /Explore globe/ }).click()
  await expect(experience).not.toHaveClass(/home-people__experience--collapsed/)
  await expect.poll(async () => (await experience.boundingBox())?.height ?? 0).toBeGreaterThan(collapsedHeight)
  await expect(globe.getByRole('group', { name: 'Globe controls' })).toBeVisible()
  await expect(globe).toHaveAttribute('data-avatar-detail', '0')
  expect(Number(await globe.getAttribute('data-avatar-count'))).toBeGreaterThan(20)
  await expect(section.locator('.home-people__country-flag').first()).toBeVisible()

  await section.getByRole('button', { name: 'Collapse map' }).click()
  await expect(experience).toHaveClass(/home-people__experience--collapsed/)
  await expect(canvas).toHaveCount(1)
  await section.getByRole('button', { name: /Explore globe/ }).click()

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

  await section.getByRole('button', { name: /Explore globe/ }).click()
  await section.getByRole('button', { name: 'Choose a location' }).click()
  await page.getByRole('combobox', { name: 'Search locations' }).fill('Paris')
  await page.getByRole('option', { name: 'Paris France' }).click()

  await expect(globe).toHaveAttribute('data-latitude', '49')
  await expect(browser).toBeVisible()
  await expect(section.locator('.home-people__selection a').first()).toBeVisible()
})

test('og image for home page', async ({ page }) => {
  await page.goto('/__og-image__/image/og.png')
  await expect(page).toHaveScreenshot()
})
