<script setup lang="ts">
import type { PeopleLocation } from '~/data/people'
import type { Contributor } from '~~/shared/types'
import { usePeopleMap } from '~/composables/usePeopleMap'
import { peopleMapFallback } from '~/data/people'

const { data: peopleMap } = usePeopleMap({ lazy: true, server: false })
const route = useRoute()
const router = useRouter()
const map = computed(() => peopleMap.value ?? peopleMapFallback)
const selectedId = useState<string | undefined>('people:selected-country', () => undefined)
const searchQuery = ref('')
const visibleProfileCount = ref(12)
const profileOpen = ref(false)
const profileUsername = ref<string>()
const profileContributor = shallowRef<Contributor>()
const profileStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const mapExpanded = ref(false)
const mapTransitioning = ref(false)
type GlobePrototype = 'avatars' | 'markers'
const globePrototype = computed<GlobePrototype>(() => route.query.globe === 'markers' ? 'markers' : 'avatars')
let activeMapTransition: ViewTransition | undefined
const COUNTRY_CODE_OVERRIDES: Record<string, string> = {
  'Afghanistan': 'AF',
  'Aland Islands': 'AX',
  'Andorra': 'AD',
  'Belize': 'BZ',
  'Bhutan': 'BT',
  'Democratic Republic of the Congo': 'CD',
  'Guatemala': 'GT',
  'Honduras': 'HN',
  'Hong Kong': 'HK',
  'Ivory Coast': 'CI',
  'Kosovo': 'XK',
  'Kuwait': 'KW',
  'Luxembourg': 'LU',
  'Mozambique': 'MZ',
  'North Macedonia': 'MK',
  'Palestinian Territory': 'PS',
  'Paraguay': 'PY',
  'Qatar': 'QA',
  'Republic of the Congo': 'CG',
  'Rwanda': 'RW',
  'South Sudan': 'SS',
  'Timor Leste': 'TL',
  'Togo': 'TG',
  'Zambia': 'ZM',
}

function countryKey(country: string): string {
  return country.toLowerCase().replace(/^the\s+/, '')
}

const peopleLocations = computed<PeopleLocation[]>(() => {
  const codes = new Map(Object.entries(COUNTRY_CODE_OVERRIDES).map(([country, code]) => [countryKey(country), code]))
  for (const location of map.value.locations) {
    const match = /^country-([a-z]{2})$/.exec(location.id)
    if (match?.[1])
      codes.set(countryKey(location.country), match[1].toUpperCase())
  }

  const countries = new Map<string, { location: PeopleLocation, people: Set<string> }>()
  for (const location of map.value.locations) {
    const key = countryKey(location.country)
    const code = codes.get(key)
    const existing = countries.get(key)
    const representative = !existing || location.precision === 'country'
      ? {
          ...location,
          id: code ? `country-${code.toLowerCase()}` : `country-${key.replace(/[^a-z0-9]+/g, '-')}`,
          label: location.country.replace(/^The\s+/, ''),
          precision: 'country' as const,
        }
      : existing.location
    const people = existing?.people ?? new Set<string>()
    location.people.forEach(username => people.add(username))
    countries.set(key, { location: representative, people })
  }

  return [...countries.values()]
    .map(({ location, people }) => ({ ...location, people: [...people] }))
    .toSorted((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label))
})
const selectedLocation = computed(() => peopleLocations.value.find(location => location.id === selectedId.value))

const countryCount = computed(() => new Set(peopleLocations.value.map(location => location.country)).size)
const filteredLocations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return peopleLocations.value

  return peopleLocations.value.filter(location =>
    location.label.toLowerCase().includes(query)
    || location.country.toLowerCase().includes(query)
    || location.people.some(username => username.toLowerCase().includes(query)),
  )
})
const visibleLocations = computed(() => filteredLocations.value.slice(0, 12))
const visibleProfiles = computed(() => selectedLocation.value?.people.slice(0, visibleProfileCount.value) ?? [])
const countryCodes = computed(() => {
  const codes = new Map(Object.entries(COUNTRY_CODE_OVERRIDES))
  for (const location of peopleLocations.value) {
    const match = /^country-([a-z]{2})$/.exec(location.id)
    if (match?.[1])
      codes.set(location.country, match[1].toUpperCase())
  }
  return codes
})

watch(selectedId, () => {
  visibleProfileCount.value = 12
})

function clearSelection(): void {
  selectedId.value = undefined
}

async function setMapExpanded(expanded: boolean): Promise<void> {
  if (mapExpanded.value === expanded)
    return

  const update = async () => {
    mapExpanded.value = expanded
    await nextTick()
  }

  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await update()
    return
  }

  mapTransitioning.value = true
  await nextTick()

  try {
    const transition = document.startViewTransition(update)
    activeMapTransition = transition
    const finish = () => {
      if (activeMapTransition !== transition)
        return
      activeMapTransition = undefined
      mapTransitioning.value = false
    }
    void transition.ready.catch(() => {})
    void transition.updateCallbackDone.catch(() => {})
    void transition.finished.then(finish, finish)
  }
  catch {
    mapTransitioning.value = false
    await update()
  }
}

async function selectGlobePrototype(prototype: GlobePrototype): Promise<void> {
  await setMapExpanded(false)
  await router.replace({ query: { ...route.query, globe: prototype } })
}

async function openContributor(username: string): Promise<void> {
  profileUsername.value = username
  profileContributor.value = undefined
  profileStatus.value = 'pending'
  profileOpen.value = true

  try {
    const contributor = await $fetch<Contributor>(`/api/contributors/${username}`)
    if (profileUsername.value === username) {
      profileContributor.value = contributor
      profileStatus.value = 'success'
    }
  }
  catch {
    if (profileUsername.value === username)
      profileStatus.value = 'error'
  }
}

function countryFlagIcon(country: string): string {
  const code = countryCodes.value.get(country)
  if (!code)
    return 'i-lucide-globe-2'

  return `i-circle-flags-${code.toLowerCase()}`
}

const locationOptions = computed(() => peopleLocations.value.map(location => ({
  label: location.label,
  description: `${location.people.length.toLocaleString()} contributors`,
  value: location.id,
  icon: countryFlagIcon(location.country),
})))
</script>

<template>
  <section
    id="community-map"
    class="home-people scroll-mt-24"
    aria-labelledby="community-map-title"
  >
    <div
      class="home-people__prototype-switcher"
      role="group"
      aria-label="Collapsed globe prototype"
    >
      <span>Collapsed version</span>
      <button
        type="button"
        :aria-pressed="globePrototype === 'avatars'"
        @click="selectGlobePrototype('avatars')"
      >
        Avatars
      </button>
      <button
        type="button"
        :aria-pressed="globePrototype === 'markers'"
        @click="selectGlobePrototype('markers')"
      >
        Country dots
      </button>
    </div>

    <div
      id="community-map-experience"
      class="home-people__experience"
      :data-globe-prototype="globePrototype"
      :class="{
        'home-people__experience--collapsed': !mapExpanded,
        'home-people__experience--view-transitioning': mapTransitioning,
      }"
    >
      <header class="home-people__header">
        <h2 id="community-map-title">
          People like you build Nuxt <span>around the globe.</span>
        </h2>
        <p>
          Meet the contributors behind Nuxt across {{ peopleLocations.length.toLocaleString() }} countries shared publicly on GitHub.
        </p>
      </header>

      <div class="home-people__meta">
        <dl class="home-people__stats">
          <div>
            <dt>Nuxters</dt>
            <dd>{{ map.totalContributors.toLocaleString() }}</dd>
          </div>
          <div>
            <dt>Countries</dt>
            <dd>{{ countryCount.toLocaleString() }}</dd>
          </div>
        </dl>
      </div>

      <div class="home-people__globe">
        <ClientOnly>
          <PeopleGlobalPeopleGlobe
            :compact="!mapExpanded"
            :locations="peopleLocations"
            :selected-id="selectedId"
            :show-avatars="globePrototype === 'avatars'"
            @collapse="setMapExpanded(false)"
            @reset="clearSelection"
            @select-contributor="openContributor"
          />
          <template #fallback>
            <div
              class="home-people__placeholder"
              aria-label="Loading globe"
            />
          </template>
        </ClientOnly>

        <div class="home-people__mobile-location">
          <USelectMenu
            v-model="selectedId"
            :items="locationOptions"
            value-key="value"
            label-key="label"
            description-key="description"
            :filter-fields="['label', 'description']"
            :search-input="{ placeholder: 'Search countries' }"
            :virtualize="{ estimateSize: 44 }"
            :content="{ side: 'top', sideOffset: 8 }"
            placeholder="Choose a country"
            aria-label="Choose a country"
            color="neutral"
            variant="outline"
            size="lg"
            clear
            class="w-full"
          />
        </div>
      </div>

      <button
        v-if="!mapExpanded"
        type="button"
        class="home-people__globe-trigger"
        aria-label="Explore globe"
        aria-controls="community-map-experience"
        :aria-expanded="mapExpanded"
        @click="setMapExpanded(true)"
      />

      <aside
        class="home-people__browser"
        :class="{ 'home-people__browser--selected': selectedLocation }"
        :aria-hidden="!mapExpanded"
        aria-label="Browse mapped Nuxters"
      >
        <div
          v-if="selectedLocation"
          class="home-people__selection"
        >
          <p>
            <span>
              <UIcon
                :name="countryFlagIcon(selectedLocation.country)"
                class="home-people__country-flag"
                aria-hidden="true"
              />
              {{ selectedLocation.country }}
            </span>
            <span class="home-people__selection-meta">
              <strong>{{ selectedLocation.people.length.toLocaleString() }} contributors</strong>
              <UButton
                label="Clear"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearSelection"
              />
            </span>
          </p>
          <ul>
            <li
              v-for="username in visibleProfiles"
              :key="username"
            >
              <NuxtLink :to="`/${username}`">
                <UAvatar
                  :src="username"
                  :alt="username"
                  size="sm"
                />
                <span class="home-people__profile-name">{{ username }}</span>
              </NuxtLink>
            </li>
          </ul>
          <UButton
            v-if="visibleProfileCount < selectedLocation.people.length"
            label="More"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="visibleProfileCount += 12"
          />
        </div>

        <UInput
          v-model="searchQuery"
          type="search"
          icon="i-lucide-search"
          size="lg"
          placeholder="Search a country or GitHub username"
          aria-label="Search mapped countries or contributors"
          class="home-people__search w-full"
        />

        <ul class="home-people__locations">
          <li
            v-for="location in visibleLocations"
            :key="location.id"
          >
            <button
              type="button"
              :aria-pressed="location.id === selectedId"
              @click="selectedId = location.id"
            >
              <span>
                <strong>{{ location.label }}</strong>
                <small>
                  <UIcon
                    :name="countryFlagIcon(location.country)"
                    class="home-people__country-flag"
                    aria-hidden="true"
                  />
                  {{ location.people.length.toLocaleString() }} contributors
                </small>
              </span>
            </button>
          </li>
        </ul>

        <p
          v-if="filteredLocations.length === 0"
          class="home-people__empty"
        >
          No mapped country or contributor matches "{{ searchQuery }}".
        </p>

        <p class="home-people__note">
          Countries come from public GitHub profile locations and use country centroids. Geocoding data by
          <ULink
            to="https://www.geonames.org/"
            target="_blank"
          >GeoNames</ULink>.
        </p>
      </aside>
    </div>

    <USlideover
      v-model:open="profileOpen"
      :title="profileUsername ? `${profileUsername} is a Nuxter` : 'Nuxter profile'"
      description="Nuxt contribution summary"
      :ui="{
        content: 'bg-neutral-950 ring-1 ring-neutral-800 sm:max-w-md',
        header: 'border-b border-neutral-800',
        body: 'p-0',
      }"
    >
      <template #body>
        <div
          v-if="profileStatus === 'pending'"
          class="grid gap-5 p-6"
        >
          <USkeleton class="size-24 rounded-full" />
          <USkeleton class="h-8 w-48" />
          <USkeleton class="h-32 w-full rounded-xl" />
        </div>

        <div
          v-else-if="profileStatus === 'error'"
          class="grid min-h-64 place-content-center gap-4 p-6 text-center text-neutral-300"
        >
          <UIcon
            name="i-ph-warning-circle"
            class="mx-auto size-8 text-amber-400"
          />
          <p>We could not load this Nuxter profile.</p>
        </div>

        <div
          v-else-if="profileContributor"
          class="text-neutral-300"
        >
          <div class="bg-[url('/card-gradient-bg.svg')] bg-cover bg-center p-6 sm:p-8">
            <NuxtImg
              :src="profileContributor.username"
              :alt="profileContributor.username"
              width="112"
              height="112"
              class="size-28 rounded-full ring-2 ring-primary-400"
            />
            <UButton
              :to="`https://github.com/${profileContributor.username}`"
              target="_blank"
              color="neutral"
              variant="link"
              icon="i-simple-icons-github"
              class="mt-4 px-0"
            >
              <span class="text-2xl text-white">{{ profileContributor.username }}</span>
            </UButton>
            <div class="mt-3 flex items-center gap-5">
              <span class="text-neutral-400"><strong class="text-xl text-white">#{{ profileContributor.rank.toLocaleString() }}</strong> rank</span>
              <span class="h-8 w-px bg-neutral-700" />
              <span class="text-neutral-400"><strong class="text-xl text-white">{{ profileContributor.score.toLocaleString() }}</strong> pts</span>
            </div>
          </div>

          <dl class="grid grid-cols-2 gap-px bg-neutral-800 border-y border-neutral-800">
            <div class="bg-neutral-950 p-5">
              <dt class="text-sm text-neutral-400">
                Merged PRs
              </dt>
              <dd class="mt-1 text-2xl font-semibold text-white">
                {{ profileContributor.merged_pull_requests.all.toLocaleString() }}
              </dd>
            </div>
            <div class="bg-neutral-950 p-5">
              <dt class="text-sm text-neutral-400">
                Helpful issues
              </dt>
              <dd class="mt-1 text-2xl font-semibold text-white">
                {{ profileContributor.helpful_issues.toLocaleString() }}
              </dd>
            </div>
            <div class="bg-neutral-950 p-5">
              <dt class="text-sm text-neutral-400">
                Helpful comments
              </dt>
              <dd class="mt-1 text-2xl font-semibold text-white">
                {{ profileContributor.helpful_comments.toLocaleString() }}
              </dd>
            </div>
            <div class="bg-neutral-950 p-5">
              <dt class="text-sm text-neutral-400">
                Reactions
              </dt>
              <dd class="mt-1 text-2xl font-semibold text-white">
                {{ profileContributor.reactions.toLocaleString() }}
              </dd>
            </div>
          </dl>

          <div class="grid gap-3 p-6 sm:p-8">
            <UButton
              :to="`/${profileContributor.username}`"
              label="View full Nuxter profile"
              icon="i-ph-arrow-up-right"
              trailing
              size="xl"
              color="primary"
            />
            <UButton
              :to="`https://github.com/${profileContributor.username}`"
              target="_blank"
              label="Open on GitHub"
              icon="i-simple-icons-github"
              size="xl"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </section>
</template>

<style scoped>
.home-people__prototype-switcher {
  position: relative;
  z-index: 5;
  display: flex;
  width: max-content;
  max-width: 100%;
  margin: 0 0 0.75rem auto;
  padding: 0.25rem;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid var(--color-neutral-800);
  border-radius: 0.5rem;
  background: var(--color-neutral-950);
  box-shadow: 0 0.5rem 1.5rem color-mix(in srgb, black 22%, transparent);
  color: var(--color-neutral-400);
  font-size: 0.75rem;
}

.home-people__prototype-switcher > span {
  padding-inline: 0.5rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.home-people__prototype-switcher button {
  min-height: 2rem;
  padding: 0.35rem 0.6rem;
  border: 0;
  border-radius: 0.3rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.home-people__prototype-switcher button:hover {
  color: var(--color-neutral-100);
}

.home-people__prototype-switcher button[aria-pressed='true'] {
  background: var(--color-neutral-800);
  color: white;
}

.home-people__prototype-switcher button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 1px;
}

.home-people__header {
  position: relative;
  z-index: 2;
  grid-area: header;
  max-width: 44rem;
  padding: clamp(1.5rem, 4vw, 2rem) clamp(1.25rem, 4vw, 2rem) 0;
}

.home-people h2 {
  color: white;
  font-size: clamp(1.875rem, 4vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1;
  text-wrap: balance;
}

.home-people h2 span {
  color: var(--color-green-400);
}

.home-people__header > p {
  max-width: 40rem;
  margin-top: 0.75rem;
  color: var(--color-neutral-300);
  font-size: 1rem;
  line-height: 1.7;
}

.home-people__meta {
  position: relative;
  z-index: 2;
  display: flex;
  grid-area: meta;
  padding: 1rem clamp(1.25rem, 4vw, 2rem) 1.5rem;
  align-items: center;
}

.home-people__stats {
  display: flex;
  max-width: 42rem;
  align-items: center;
  gap: 1.5rem;
}

.home-people__stats div {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.home-people__stats div + div {
  padding-left: 1.5rem;
  border-left: 1px solid var(--color-neutral-800);
}

.home-people__stats dt {
  color: var(--ui-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.home-people__stats dd {
  color: var(--ui-primary);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.home-people__experience {
  --people-panel-bg: var(--color-slate-900);
  interpolate-size: allow-keywords;
  position: relative;
  display: grid;
  height: auto;
  margin-inline: -1rem;
  grid-template-columns: minmax(22rem, 0.68fr) minmax(0, 1.32fr);
  grid-template-areas:
    'header globe'
    'meta globe'
    'browser globe';
  align-items: stretch;
  overflow: visible;
  border: 1px solid var(--color-slate-800);
  border-radius: 1.25rem;
  background: var(--people-panel-bg);
  box-shadow: 0 1.5rem 4rem color-mix(in srgb, black 22%, transparent), inset 0 1px color-mix(in srgb, white 5%, transparent);
  isolation: isolate;
  transition: height 280ms cubic-bezier(0.77, 0, 0.175, 1);
}

.home-people__experience--view-transitioning {
  transition: none;
}

.home-people__experience--collapsed {
  height: 18rem;
  overflow: clip;
  grid-template-columns: 1fr;
  grid-template-areas:
    'header'
    'meta';
  align-content: center;
}

.home-people__experience--collapsed .home-people__header {
  max-width: 52rem;
  padding-right: min(32vw, 24rem);
}

.home-people__experience--collapsed .home-people__meta {
  padding-right: min(32vw, 24rem);
}

.home-people__experience:not(.home-people__experience--collapsed) .home-people__header,
.home-people__experience:not(.home-people__experience--collapsed) .home-people__meta,
.home-people__experience:not(.home-people__experience--collapsed) .home-people__browser {
  border-right: 1px solid var(--color-slate-800);
}

.home-people__globe {
  position: relative;
  z-index: 1;
  display: grid;
  grid-area: globe;
  min-width: 0;
  min-height: 36rem;
  padding: 1rem 1rem 0 0;
  overflow: visible;
  place-items: start end;
}

.home-people__globe :deep(.people-globe) {
  position: sticky;
  top: 1rem;
  width: min(100%, 42rem);
  view-transition-name: people-globe-stage;
}

.home-people__globe :deep(.people-globe::before) {
  position: absolute;
  z-index: -1;
  inset: 18%;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ui-primary) 18%, transparent);
  content: '';
  filter: blur(3rem);
  pointer-events: none;
}

.home-people__experience--collapsed .home-people__globe :deep(.people-globe::before) {
  inset: 8%;
  filter: blur(5rem);
}

.home-people__experience--collapsed .home-people__globe {
  position: absolute;
  inset: 0 0 0 auto;
  width: min(36%, 24rem);
  min-height: 0;
  padding: 0;
  place-items: center end;
}

.home-people__experience--collapsed .home-people__globe :deep(.people-globe) {
  position: absolute;
  top: 50%;
  right: -1.5rem;
  width: 19rem;
  max-width: none;
  transform: translateY(-50%);
}

.home-people__globe-trigger {
  position: absolute;
  z-index: 4;
  inset: 0 0 0 auto;
  width: min(36%, 24rem);
  border: 0;
  border-radius: 0 1.25rem 1.25rem 0;
  background: transparent;
  cursor: pointer;
  transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.home-people__globe-trigger:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -3px;
}

@media (hover: hover) and (pointer: fine) {
  .home-people__globe-trigger:hover {
    background: color-mix(in srgb, var(--ui-primary) 5%, transparent);
  }
}

.home-people__experience--collapsed .home-people__browser,
.home-people__experience--collapsed .home-people__mobile-location {
  display: none;
}

.home-people__mobile-location {
  position: absolute;
  z-index: 5;
  right: 1rem;
  bottom: 1rem;
  left: 1rem;
  display: none;
}

.home-people__browser {
  position: relative;
  z-index: 2;
  display: flex;
  grid-area: browser;
  min-width: 0;
  padding: clamp(1rem, 3vw, 2rem);
  container-type: inline-size;
  flex-direction: column;
  gap: 0.75rem;
}

.home-people__selection {
  display: flex;
  padding-bottom: 1rem;
  flex-direction: column;
  gap: 1rem;
  border-bottom: 1px solid var(--ui-border);
}

.home-people__selection > p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}

.home-people__selection > p > span,
.home-people__locations small {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
}

.home-people__country-flag {
  width: 0.9rem;
  height: 0.9rem;
  flex: none;
}

.home-people__selection > p strong {
  color: var(--ui-text-highlighted);
  font-weight: 600;
}

.home-people__selection-meta {
  margin-left: auto;
}

.home-people__selection ul {
  display: grid;
  max-height: min(26rem, 50vh);
  overflow-y: auto;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.35rem 0.75rem;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.home-people__selection a {
  display: flex;
  min-width: 0;
  padding-block: 0.2rem;
  align-items: center;
  gap: 0.5rem;
  color: var(--ui-text);
  font-size: 0.8rem;
}

.home-people__selection a:hover,
.home-people__selection a:focus-visible {
  color: var(--ui-primary);
}

.home-people__selection a span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-people__locations {
  display: grid;
  gap: 0;
}

.home-people__locations button {
  display: grid;
  width: 100%;
  padding: 0.35rem 0.5rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  color: var(--ui-text-muted);
  text-align: left;
  transition: background-color 140ms ease, color 140ms ease;
}

.home-people__locations button:hover,
.home-people__locations button:focus-visible,
.home-people__locations button[aria-pressed='true'] {
  background: var(--ui-bg-accented);
  color: var(--ui-text-highlighted);
}

.home-people__locations button[aria-pressed='true'] {
  box-shadow: inset 2px 0 var(--ui-primary);
}

.home-people__locations button[aria-pressed='true'] > span:last-child {
  color: var(--ui-primary);
}

.home-people__locations button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -2px;
}

.home-people__locations button > span:first-child {
  display: grid;
  min-width: 0;
}

.home-people__locations strong {
  overflow: hidden;
  color: var(--ui-text-highlighted);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-people__locations small {
  overflow: hidden;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-people__note,
.home-people__empty {
  color: var(--ui-text-dimmed);
  font-size: 0.75rem;
  line-height: 1.55;
}

.home-people__note {
  margin-top: auto;
  padding-top: 0.5rem;
}

.home-people__placeholder {
  width: 100%;
  aspect-ratio: 1;
  background: radial-gradient(circle, var(--ui-bg-elevated), transparent 68%);
}

@media (min-width: 640px) {
  .home-people__experience {
    margin-inline: -1.5rem;
  }
}

@media (min-width: 1024px) {
  .home-people__experience {
    margin-inline: -2rem;
  }
}

@container (min-width: 22rem) {
  .home-people__locations {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.25rem;
  }
}

@media (max-width: 900px) {
  .home-people__experience {
    grid-template-columns: 1fr;
    grid-template-areas:
      'header'
      'meta'
      'globe'
      'browser';
  }

  .home-people__globe {
    min-height: auto;
    padding: 0;
    place-items: center;
  }

  .home-people__globe :deep(.people-globe) {
    position: relative;
    top: auto;
  }

  .home-people__browser {
    border-top: 1px solid var(--ui-border);
  }

  .home-people__experience:not(.home-people__experience--collapsed) .home-people__header,
  .home-people__experience:not(.home-people__experience--collapsed) .home-people__meta,
  .home-people__experience:not(.home-people__experience--collapsed) .home-people__browser {
    border-right: 0;
  }

  .home-people__mobile-location {
    display: block;
  }

  .home-people__browser:not(.home-people__browser--selected),
  .home-people__search,
  .home-people__locations,
  .home-people__empty,
  .home-people__note {
    display: none;
  }

  .home-people__browser {
    padding: 0.75rem 1rem 1rem;
  }

  .home-people__selection {
    padding: 0;
    gap: 0.75rem;
    border-bottom: 0;
  }

  .home-people__selection ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .home-people__selection a {
    padding: 0;
  }

  .home-people__profile-name {
    display: none;
  }
}

@media (max-width: 520px) {
  .home-people__prototype-switcher > span {
    display: none;
  }

  .home-people__experience--collapsed {
    height: 19rem;
  }

  .home-people__experience--collapsed .home-people__header {
    padding-right: 1.25rem;
  }

  .home-people__experience--collapsed .home-people__meta {
    padding-right: 1.25rem;
  }

  .home-people__experience--collapsed .home-people__globe {
    width: 42%;
  }

  .home-people__globe-trigger {
    width: 42%;
  }

  .home-people__experience--collapsed .home-people__globe :deep(.people-globe) {
    right: -2rem;
    width: 13.5rem;
    opacity: 0.55;
  }

  .home-people__stats dt {
    font-size: 0.62rem;
  }

  .home-people__selection ul {
    grid-template-columns: 1fr;
  }
}

:global(::view-transition-group(people-globe-stage)) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(0.77, 0, 0.175, 1);
}

:global(::view-transition-old(people-globe-stage)),
:global(::view-transition-new(people-globe-stage)) {
  animation-duration: 280ms;
}

@media (prefers-reduced-motion: reduce) {
  .home-people__experience {
    transition: none;
  }

  :global(::view-transition-group(people-globe-stage)) {
    animation-duration: 1ms;
  }
}
</style>
