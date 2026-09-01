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
  const prototypeSwitcher = section.getByRole('group', { name: 'Collapsed globe prototype' })
  await prototypeSwitcher.getByRole('button', { name: 'Country dots' }).click()
  await expect(page).toHaveURL(/globe=markers/)
  await expect(experience).toHaveAttribute('data-globe-prototype', 'markers')
  await expect(globe.locator('.people-globe__avatar-marker')).toHaveCount(0)
  await expect(canvas).toHaveCount(1)
  await prototypeSwitcher.getByRole('button', { name: 'Avatars' }).click()
  await expect(experience).toHaveAttribute('data-globe-prototype', 'avatars')
  expect(await globe.locator('.people-globe__avatar-marker').count()).toBeGreaterThan(20)
  const collapsedHeight = (await experience.boundingBox())?.height ?? 0
  const globeTrigger = section.getByRole('button', { name: /Explore globe/ })
  const triggerBox = await globeTrigger.boundingBox()
  expect(triggerBox?.width ?? 0).toBeGreaterThan(250)
  expect(triggerBox?.height ?? 0).toBeGreaterThan(collapsedHeight - 4)
  await globeTrigger.click()
  await expect(experience).not.toHaveClass(/home-people__experience--collapsed/)
  await expect.poll(async () => (await experience.boundingBox())?.height ?? 0).toBeGreaterThan(collapsedHeight)
  await expect.poll(async () => (await experience.boundingBox())?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(760)
  await expect(globe.getByRole('group', { name: 'Globe controls' })).toBeVisible()
  await expect(globe).toHaveAttribute('data-avatar-detail', '0')
  expect(Number(await globe.getAttribute('data-avatar-count'))).toBeGreaterThan(20)
  const avatarPositions = await globe.locator('.people-globe__avatar-marker').evaluateAll(elements => new Set(elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    return `${Math.round(bounds.x)},${Math.round(bounds.y)}`
  })).size)
  expect(avatarPositions).toBeGreaterThan(20)
  await expect(section.locator('.home-people__country-flag').first()).toBeVisible()
  const globeBox = await section.locator('.home-people__globe').boundingBox()
  const countryListBox = await section.locator('.home-people__browser').boundingBox()
  expect(globeBox?.x ?? 0).toBeGreaterThan(countryListBox?.x ?? 0)
  expect(globeBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(countryListBox?.y ?? 0)
  expect(await globe.evaluate(element => getComputedStyle(element, '::before').filter)).toBe('blur(48px)')
  await expect(globe).toHaveCSS('position', 'sticky')
  expect(await globe.evaluate((element) => {
    let parent = element.parentElement
    while (parent) {
      if (getComputedStyle(parent).overflowY !== 'visible')
        return false
      parent = parent.parentElement
    }
    return true
  })).toBe(true)

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
  await section.getByRole('button', { name: /France/ }).click()
  expect(await globe.locator('.people-globe__avatar-marker.is-selected').count()).toBeGreaterThan(20)
  await expect(globe).toHaveAttribute('data-latitude', '47')
  await expect.poll(async () => Number(await globe.getAttribute('data-rendered-latitude'))).toBeGreaterThan(43)

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

  await expect(section.getByRole('searchbox', { name: 'Search mapped countries or contributors' })).toBeVisible()
  await expect(section).toContainText('26,287')
  await expect(section).toContainText('164')
  await expect(section).not.toContainText('Regional zoom limit')
  await expect(section).not.toContainText('Approximate locations')
  await expect(section).not.toContainText('Explore the community')
  await expect(section).not.toContainText('Find Nuxters near you')
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
  await expect(globe).toHaveCSS('position', 'relative')
  await section.getByRole('button', { name: 'Choose a country' }).click()
  await page.getByRole('combobox', { name: 'Search countries' }).fill('France')
  await page.getByRole('option', { name: /France/ }).click()

  await expect(globe).toHaveAttribute('data-latitude', '47')
  await expect(browser).toBeVisible()
  await expect(section.locator('.home-people__selection a').first()).toBeVisible()
})

test('og image for home page', async ({ page }) => {
  await page.goto('/__og-image__/image/og.png')
  await expect(page).toHaveScreenshot()
})
