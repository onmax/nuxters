<script setup lang="ts">
import type { Contributor } from '~~/shared/types'
import { usePeopleMap } from '~/composables/usePeopleMap'
import { peopleMapFallback } from '~/data/people'

const { data: peopleMap } = usePeopleMap({ lazy: true, server: false })
const map = computed(() => peopleMap.value ?? peopleMapFallback)
const peopleLocations = computed(() => map.value.locations)
const selectedId = useState<string | undefined>('people:selected-location', () => undefined)
const selectedLocation = computed(() => peopleLocations.value.find(location => location.id === selectedId.value))
const searchQuery = ref('')
const visibleProfileCount = ref(12)
const profileOpen = ref(false)
const profileUsername = ref<string>()
const profileContributor = shallowRef<Contributor>()
const profileStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const LOCATION_AVATAR_LIMIT = 5
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
  description: location.country,
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
    <header class="home-people__header">
      <h2 id="community-map-title">
        People like you build Nuxt <span>around the globe.</span>
      </h2>
      <p>
        Meet the contributors behind Nuxt across {{ peopleLocations.length.toLocaleString() }} locations shared publicly on GitHub.
      </p>
    </header>

    <dl class="home-people__stats">
      <div>
        <dt>Nuxters</dt>
        <dd>{{ map.totalContributors.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>On the map</dt>
        <dd>{{ map.mappedContributors.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>Countries</dt>
        <dd>{{ countryCount.toLocaleString() }}</dd>
      </div>
    </dl>

    <div class="home-people__experience">
      <div class="home-people__globe">
        <ClientOnly>
          <PeopleGlobalPeopleGlobe
            :locations="peopleLocations"
            :selected-id="selectedId"
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
            :search-input="{ placeholder: 'Search locations' }"
            :virtualize="{ estimateSize: 44 }"
            :content="{ side: 'top', sideOffset: 8 }"
            placeholder="Choose a location"
            aria-label="Choose a location"
            color="neutral"
            variant="outline"
            size="lg"
            clear
            class="w-full"
          />
        </div>
      </div>

      <aside
        class="home-people__browser"
        :class="{ 'home-people__browser--selected': selectedLocation }"
        aria-label="Browse mapped Nuxters"
      >
        <div class="home-people__browser-heading">
          <div>
            <p>{{ selectedLocation ? 'Selected location' : 'Explore the community' }}</p>
            <h3>{{ selectedLocation?.label ?? 'Find Nuxters near you' }}</h3>
          </div>
          <UButton
            v-if="selectedLocation"
            label="Clear"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearSelection"
          />
        </div>

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
            <strong>{{ selectedLocation.people.length.toLocaleString() }} contributors</strong>
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
          placeholder="Search a city, country, or GitHub username"
          aria-label="Search mapped locations or contributors"
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
                  {{ location.country }}
                </small>
              </span>
              <span class="home-people__location-meta">
                <UAvatarGroup
                  size="2xs"
                  color="neutral"
                  aria-hidden="true"
                >
                  <UAvatar
                    v-for="username in location.people.slice(0, LOCATION_AVATAR_LIMIT)"
                    :key="username"
                    :src="username"
                    alt=""
                  />
                </UAvatarGroup>
                <span v-if="location.people.length > LOCATION_AVATAR_LIMIT">
                  +{{ (location.people.length - LOCATION_AVATAR_LIMIT).toLocaleString() }}
                </span>
              </span>
            </button>
          </li>
        </ul>

        <p
          v-if="filteredLocations.length === 0"
          class="home-people__empty"
        >
          No mapped location or contributor matches "{{ searchQuery }}".
        </p>

        <p class="home-people__note">
          Locations come from public GitHub profiles and stop at city or country level. Geocoding data by
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
.home-people__header {
  max-width: 44rem;
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
  margin-top: 1.25rem;
  color: var(--color-neutral-300);
  font-size: 1rem;
  line-height: 1.7;
}

.home-people__stats {
  display: grid;
  margin-top: 2.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid var(--color-neutral-800);
}

.home-people__stats div {
  padding: 1.2rem 0;
}

.home-people__stats div + div {
  padding-left: clamp(1rem, 4vw, 2rem);
  border-left: 1px solid var(--color-neutral-800);
}

.home-people__stats dt,
.home-people__browser-heading p {
  color: var(--ui-primary);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.home-people__stats dd {
  margin-top: 0.25rem;
  color: var(--ui-primary);
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.home-people__experience {
  --people-panel-bg: var(--color-slate-900);
  display: grid;
  margin-top: 2rem;
  margin-inline: -1rem;
  grid-template-columns: minmax(0, 1.35fr) minmax(19rem, 0.65fr);
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--color-slate-800);
  border-radius: 1.25rem;
  background: var(--people-panel-bg);
}

.home-people__globe {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 36rem;
  overflow: hidden;
  place-items: center;
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
  display: flex;
  min-width: 0;
  padding: clamp(1rem, 3vw, 2rem);
  container-type: inline-size;
  flex-direction: column;
  gap: 0.75rem;
  border-left: 1px solid var(--color-slate-800);
  background: var(--people-panel-bg);
}

.home-people__browser-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.home-people__browser h3 {
  margin-top: 0.35rem;
  color: var(--ui-text-highlighted);
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
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

.home-people__selection ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.35rem 0.75rem;
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

.home-people__location-meta {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
}

.home-people__location-meta > span:last-child {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
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

@container (min-width: 34rem) {
  .home-people__locations {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0.25rem;
  }
}

@media (max-width: 900px) {
  .home-people__experience {
    grid-template-columns: 1fr;
  }

  .home-people__globe {
    min-height: auto;
  }

  .home-people__browser {
    border-top: 1px solid var(--ui-border);
    border-left: 0;
  }

  .home-people__mobile-location {
    display: block;
  }

  .home-people__browser:not(.home-people__browser--selected),
  .home-people__browser-heading,
  .home-people__search,
  .home-people__locations,
  .home-people__empty,
  .home-people__note {
    display: none;
  }

  .home-people__browser {
    padding: 0.75rem 1rem 1rem;
    background: var(--ui-bg);
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
  .home-people__stats div {
    padding-block: 1rem;
  }

  .home-people__stats dt {
    font-size: 0.62rem;
  }

  .home-people__selection ul {
    grid-template-columns: 1fr;
  }
}
</style>
