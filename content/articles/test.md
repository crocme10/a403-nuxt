---
title: Try Extend
description: I am a description of a great article
img: https://images.unsplash.com/photo-1588514727390-91fd5ebaef81?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=639&q=80
alt: article 7
author: 
  name: Matthieu
  bio: Rust and such
  img: https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2551&q=80
tags: 
  - web development
---

Wild imaginings on a trait `TryExtend`, which is a variation on
[`Extend`](https://doc.rust-lang.org/std/iter/trait.Extend.html).

## Extend

The documentation says

> Extend a collection with the contents of an iterator.

A typical case would be, for example, that of merging two datasets:

```rust
let set1 = vec![1, 4, 8, 21];
let set2 = vec![0, 7];
set1.extend(set2);
```

## Try Fold

[try_fold](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.try_fold) a function that
accumulates a result while iterating through a collection.

The problem of using `try_fold` in our case is that the function takes ownership of the initial
value of the accumulator.

```rust
struct Model {
  data: HashMap<_,_>,
}

impl Model {
  fn merge()
}
```
