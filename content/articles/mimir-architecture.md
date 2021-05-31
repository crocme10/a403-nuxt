---
title: Growing Mimir using the Hexagonal Architecture
description: Tutorial showing the development of a component of mimirsbrunn using the hexagonal architecture.
img: /img/stocks/leaves3.jpg
alt: Photo by <a href="https://unsplash.com/@erol?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Erol Ahmed</a> on <a href="https://unsplash.com/s/photos/leaves?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
author: 
  name: Matthieu
  bio: Rust and such
  img: /img/profiles/programmer.svg
tags:  ['rust', 'hexagonal architecture']
---

[Mimirsbrunn](https://github.com/CanalTP/mimirsbrunn/) is an open source project to develop
a forward and reverse geocoder. It is used by [Navitia](https://github.com/CanalTP/navitia) and
[Qwant](https://about.qwant.com/maps/) to enable, among other functionalities, autocompletion for
geospatial data. Mimirsbrunn uses Elasticsearch as a backend.

**Mimir** is a component of mimirsbrunn which is responsible for data ingestion, that is it takes sources of geospatial
data, modifies them, and inserts them in Elasticsearch.

This series of articles explains the rewrite of Mimir using the hexagonal architecture:

1. **[Part I](/blog/mimir-architecture-1)** gives some context and lays out the domain.
2. **[Part II](/blog/mimir-architecture-2)** implements the Elasticsearch backend.
3. **[Part III](/blog/mimir-architecture-3)** implements the main use case.
4. **Part IV** shows a primary adapter for a GraphQL interface.
5. **Part V** adds some integration tests.
