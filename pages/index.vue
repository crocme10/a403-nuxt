<template>
  <div class="flex lg:h-screen w-screen lg:overflow-hidden xs:flex-col lg:flex-row">
    <div class="relative lg:w-1/3 xs:w-full xs:h-84 lg:h-full post-left">
      <div class="overlay" />
      <div class="absolute top-8 left-8 text-white">
        <NuxtLink to="/">
          <Logo />
        </NuxtLink>
        <!-- table of contents -->
        <nav class="mt-16 ml-8 text-xl leading-loose">
          <ul>
            <li
              v-for="tag of tags"
              :key="tag.slug"
            >
              <NuxtLink :to="`/blog/tag/${tag.slug}`" class="">
                <p
                  class="font-bold text-gray-600 uppercase tracking-wider font-medium text-ss"
                >
                  {{ tag.name }}
                </p>
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
    <div class="relative xs:py-8 xs:px-8 lg:py-32 lg:px-16 lg:w-3/4 xs:w-full h-full overflow-y-scroll markdown-body post-right custom-scroll">
      <div class="xs:w-full md:w-1/2 px-2 xs:mb-6 md:mb-12 m-8">
        <h1 class="text-4xl font-bold">
          Articles
        </h1>
      </div>
      <ul class="mt-8 flex flex-wrap">
        <li
          v-for="article of articles"
          :key="article.slug"
          class="xs:w-full md:w-1/2 px-2 xs:mb-6 md:mb-12 @apply rounded-md border-2 border-gray-400 m-8"
        >
          <NuxtLink
            :to="{ name: 'blog-slug', params: { slug: article.slug } }"
            class="flex transition-shadow duration-150 ease-in-out shadow-sm hover:shadow-md xxlmax:flex-col"
          >
            <div
              class="p-6 flex flex-col justify-between xxlmin:w-1/2 xxlmax:w-full"
            >
              <h2 class="font-bold text-2xl text-gray-300">
                {{ article.title }}
              </h2>
              <p>by {{ article.author.name }}</p>
              <p class="mt-4 font-medium text-gray-300 text-lg">
                {{ article.description }}
              </p>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData ({ $content, params }) {
    const articles = await $content('articles', params.slug)
      .only(['title', 'description', 'img', 'slug', 'author'])
      .sortBy('createdAt', 'desc')
      .fetch()
    const tags = await $content('tags', params.slug)
      .only(['name', 'description', 'img', 'slug'])
      .sortBy('createdAt', 'asc')
      .fetch()
    return {
      articles,
      tags
    }
  }
}
</script>

<style class="postcss">
.container {
  @apply min-h-screen flex justify-center items-center mx-auto;
}

.article-card {
  @apply rounded-md border-2 border-gray-400;
}

.article-card a {
  @apply rounded-md;
}

.article-card img div {
  @apply rounded-md;
}
</style>
