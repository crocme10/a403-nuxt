<template>
  <article
    class="flex lg:h-screen w-screen lg:overflow-hidden xs:flex-col lg:flex-row"
  >
    <div class="relative lg:w-1/3 xs:w-full xs:h-84 lg:h-full post-left">
      <div class="overlay" />
      <div class="absolute top-32 left-32 text-white">
        <NuxtLink to="/">
          <Logo />
        </NuxtLink>
        <div class="mt-16 -mb-3 flex uppercase text-lg">
          <p class="mr-3">
            {{ formatDate(article.updatedAt) }}
          </p>
          <span class="mr-3">•</span>
          <p>{{ article.author.name }}</p>
        </div>
        <h1 class="mt-8 mb-8 text-6xl font-bold">
          {{ article.title }}
        </h1>
        <span v-for="(tag, id) in article.tags" :key="id">
          <NuxtLink :to="`/blog/tag/${tags[tag].slug}`">
            <span
              class="truncate uppercase tracking-wider font-medium px-2 py-1 rounded-full mr-2 mb-2 border border-light-border dark:border-dark-border transition-colors duration-300 ease-linear"
            >
              {{ tags[tag].name }}
            </span>
          </NuxtLink>
        </span>
        <!-- table of contents -->
        <nav class="mt-16 ml-8 text-xl leading-loose">
          <ul>
            <li
              v-for="link of article.toc"
              :key="link.id"
              :class="{
                'font-semibold': link.depth === 2
              }"
            >
              <nuxtLink
                :to="`#${link.id}`"
                class="hover:underline"
                :class="{
                  'py-2': link.depth === 2,
                  'ml-4 pb-2': link.depth === 3
                }"
              >
                {{ link.text }}
              </nuxtLink>
            </li>
          </ul>
        </nav>
      </div>
      <div class="flex absolute top-3rem right-3rem">
        <AppSearchInput />
      </div>
    </div>
    <div
      class="relative xs:py-8 xs:px-8 lg:py-32 lg:px-16 lg:w-3/4 xs:w-full h-full overflow-y-scroll markdown-body post-right custom-scroll"
    >
      <h1 class="font-bold text-6xl">
        {{ article.title }}
      </h1>
      <p class="mt-8 text-lg">
        {{ article.description }}
      </p>
      <p class="mt-8 pb-4">
        Post last updated: {{ formatDate(article.updatedAt) }}
      </p>
      <!-- content from markdown -->
      <nuxt-content class="my-12 max-w-5xl" :document="article" />
      <!-- content author component -->
      <author :author="article.author" />
      <!-- prevNext component -->
      <PrevNext :prev="prev" :next="next" class="mt-8" />
    </div>
  </article>
</template>
<script>
import Prism from '~/plugins/prism'

export default {
  async asyncData ({ $content, params }) {
    const article = await $content('articles', params.slug).fetch()
    const tagsList = await $content('tags')
      .only(['name', 'slug'])
      .where({ name: { $containsAny: article.tags } })
      .fetch()
    const tags = Object.assign({}, ...tagsList.map(s => ({ [s.name]: s })))
    const [prev, next] = await $content('articles')
      .only(['title', 'slug'])
      .sortBy('createdAt', 'asc')
      .surround(params.slug)
      .fetch()
    return {
      article,
      tags,
      prev,
      next
    }
  },
  mounted () {
    Prism.highlightAll()
  },
  methods: {
    formatDate (date) {
      const options = { year: 'numeric', month: 'long', day: 'numeric' }
      return new Date(date).toLocaleDateString('en', options)
    }
  }
}
</script>

<style>
.nuxt-content {
  @apply text-xl font-thin text-gray-300
}

.nuxt-content p {
  @apply my-4
}

.nuxt-content h2 {
  @apply mt-10 mb-6 ml-4 text-4xl font-bold tracking-wider
}

.nuxt-content h3 {
  @apply mt-10 mb-6 ml-4 text-3xl font-bold
}

.nuxt-content h4 {
  @apply mt-10 mb-6 ml-4 text-2xl font-medium
}

.nuxt-content ul {
  @apply list-disc list-inside
}

.nuxt-content a {
  @apply underline
}

.nuxt-content code {
  @apply font-mono
}

/* .nuxt-content {
  @apply break-words;
} */

.nuxt-content .nuxt-content-highlight {
  @apply mb-6
}
.nuxt-content .nuxt-content-highlight .code-toolbar .line-numbers {
  @apply leading-5
}

.nuxt-content .nuxt-content-highlight > .filename {
  @apply block bg-gray-700 text-gray-100 font-mono text-lg tracking-tight py-2 px-4 -mb-3 rounded-t text-right
}

.nuxt-content .nuxt-content-highlight .code-toolbar {
  @apply relative
}

.nuxt-content .nuxt-content-highlight .code-toolbar .toolbar {
  @apply absolute top-0 right-0 opacity-75 space-x-2
}

.nuxt-content .nuxt-content-highlight .code-toolbar .toolbar .toolbar-item {
  @apply inline-block
}

.nuxt-content .nuxt-content-highlight .code-toolbar .toolbar .toolbar-item a {
  @apply cursor-pointer
}

.nuxt-content .nuxt-content-highlight .code-toolbar .toolbar .toolbar-item a,
.nuxt-content .nuxt-content-highlight .code-toolbar .toolbar .toolbar-item button,
.nuxt-content .nuxt-content-highlight .code-toolbar .toolbar .toolbar-item span {
  @apply mr-6 mt-6 px-4 py-2 text-gray-100 hover:text-white text-lg bg-gray-600 shadow-sm rounded-lg leading-tight
}

</style>
