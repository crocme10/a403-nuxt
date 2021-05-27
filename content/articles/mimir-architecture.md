---
title: Growing Mimir using the Hexagonal Architecture
description: Tutorial showing the development of a component of mimirsbrunn using the hexagonal architecture
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
geospatial data.
Mimirsbrunn uses Elasticsearch as a backend.  Mimir is a component of mimirsbrunn which is
responsible for data ingestion, that is it takes sources of geospatial data, modifies them, and
insert them in Elasticsearch. Bragi, on the other hand, is only concerned with forwarding queries
from the user to Elasticsearch, and Elasticsearch's response back to the user, as seen in the
diagram below.

![Mimirsbrunn Components](/img/mimir-architecture/mimirsbrunn.svg)

Mimir, as well as the much of the rest of Mimirsbrunn, is written in Rust. As part of the
maintenance of that component, I decided to:
- have a look into using a newly available Elasticsearch client written in Rust,
- improve the coverage of unit tests for Mimir,

The previous version of Mimir has enjoyed good stability, but as Rust is a young language, it has
evolved tremendously since Mimir was first written. These changes may also provide opportunities
for improvements:
- asynchronous code is now pervasive
- generic code, using traits, are more expressive.

With these considerations, I investigated a partial rewrite of Mimir on sound architectural
grounds, and the following documents show how the code can be grown from principles to deployment.

## Hexagonal Architecture

You will find many references to hexagonal architecture, also known as *ports and adapters*. This
architectural pattern was presented by Alistair Cockburn in 2005, with the goal of:
- improving the testability of a system by allowing test doubles to replace parts of it.
- improving the maintenance of a system by making it easy to swap parts of its infrastructure.

It isolates 3 areas of the system from each other:
- The core **domain**
- Part of the infrastructure **driving** the code domain (eg user input)
- The other part of the infrastructure **driven** by the core domain (eg database)

It specifies that dependencies must be toward the center: An adapter can depend on domain
components, but the domain dependencies don't extend beyond ports.

Sometimes adapters on the driving side are called **primary** adapters, while adapters on the
driven side are called **secondary** adapters.

![Hexagonal Architecture](/img/mimir-architecture/hexagon-1.svg)

The domain and the infrastructure communicates through **ports**. These are implemented as
interfaces in many languages, traits in Rust. They define the behavior of a component without
specifying its actual implementation. The infrastructure is comprised of **adapters**, which, as the
name suggest, adapt on interface to another. For example, for an input adapter could be
interpreting REST requests, and use a port of the domain to fulfill that request.

This apparently simple design decision seem to address the stated goals identified previously:
- Using test doubles that implement an interface, we can replace / mock a component, specify its
    exact behavior, and test how other parts of the system make use of it.
- You can change a component provided its implementation meets the constraints specified by the
    ports it plugs into. Its a pluggable architecture.

![Hexagonal Architecture and Testing](/img/mimir-architecture/hexagon-testing.svg)

## Mimir Architecture Overview

We recall that Mimir's purpose is to index various sources of data, which means, more accurately:
- on the driving side, the user must provide a configuration for the index, and documents, which
are essentially the pieces of information that will be stored in Elasticsearch.
- on the driven side, we must be able to create and delete Elasticsearch indices, insert data in
    an existing index, and manipulate index aliases.

Currently Mimir is the basis for several command line binaries, and so we will not initially
provide any HTTP based adapter (FIXME Are you sure??)

If we apply these concepts to the architecture of Mimir, we can identify the following ports and
adapters:

### Ports

**GenerateIndex** defines the main functionality expected from Mimir: It takes an index
configurations, documents, and return an index. The details of what those elements are,
configuration, index, and so on is not relevant at the moment. What is important is that they be
defined inside the domain, because ports are part of the domain and the domain's dependencies are
limited to itself.

**IndexStorage** defines the functionality we expect from the backend storage. Not that to be don't
necessarily need to be talking about indices... In fact it might prove beneficial later to be
splitting that backend into an **IndexStorage**, which has an interface to create or delete objects
that implement another port, **DocumentContainer**.

### Adapters

**GraphQL Adapter** is a component that exposes a GraphQL interface, and translate incoming queries
into calls to the GenerateIndex ports.

**Elasticsearch Adapter** is a component which uses the adapts the Elasticsearch Client Library
(Crate) to the IndexStorage port.

## Laying out the Domain

### Model

We can start with a clean slate

```shell
cargo new --lib mimir
```

I would like the source code to reflect the architecture, so I will create the following files and
directories under `src`:

```
src
 ├── lib.rs
 ├── domain
 │    ├── mod.rs
 │    └── model
 │         ├── mod.rs
 │         ├── configuration.rs
 │         ├── document.rs
 │         └── index.rs
```

As the layout shows, we're just just focusing on the index and the information it carries: its
name, the count of documents in that index, and its status. Maybe at a later stage we'll add more
information, like a creation timestamp and so on.

```rust
#[derive(Debug, Clone)]
pub enum IndexStatus {
  Available,
  NotAvailable
}

#[derive(Debug, Clone)]
pub struct Index {
  pub name: String,
  pub doc_count: u32,
  pub status: IndexStatus
}
```

Another component of the model is the index configuration. Here, however, we are a bit in a bind,
because we have to remain backend agnostic. So what does the configuration looks like then? I see
three choices:
- Either we have a struct holding just a `String`
- Either we define a `Configuration` trait, with `Serialize` and `Deserialize` as super traits,
- Or maybe the configuration could be trait object, like `Box<dyn Any>`, or `box<dyn Serialize + Deserialize>`

We'll pick the first solution for now, and we may have to revisit that choice later.

```rust
#[derive(Debug, Clone)]
pub struct Configuration {
  pub value: String,
}
```

Finally, the last element of the model we're interested in at the moment are documents, the precise
objects that are stored in Elasticsearch. Little is known about them, and so we'll just provide
a trait to describe what basic constraints they must implement.

```rust
use serde::Serialize;

pub trait Document: Serialize {
  const IS_GEO_DATA: bool;

  const DOC_TYPE: &'static str;

  fn id(&self) -> String;
}

impl<'a, T: Document> Document for &'a T {
  const IS_GEO_DATA: bool = T::IS_GEO_DATA;

  cont DOC_TYPE: &'static str = T::DOC_TYPE;

  fn id(&self) -> String {
    T::id(self)
  }
}
```

For this last piece to compile, we need to update `Cargo.toml`:

```toml
[dependencies]
serde = { version = "1.0", features = [ "derive", "rc" ] }
```

You can now try `cargo build`, and it should work. Granted, it's not very useful...

### Ports

We'll first focus on the driven side, the backend, namely the storage port. So we'll extend
the previous directory structure to contain a `ports` directory under `domain`:

```
 ├── domain
 │    ├── mod.rs
 │    ├── model
 │    └── ports
 │         ├── mod.rs
 │         └── storage.rs
```

We recall from a previous section that the storage backend must be able to create and delete
indices, insert data in an existing index, and manipulate index aliases. We may want to cast
aside that last bit for now.

In Rust, part of defining an interface, is also defining its failure
mode, so that any function returned is a `Result<SuccessType, ErrorType>`.

I like to use `Snafu`[^10]

So the first part of the `storage.rs` is for the definition of the error:

```rust[storage.rs]
use snafu::Snafu;

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Container Creation Error: {}", details))]
    ContainerCreationError { details: String },

    #[snafu(display("Document Insertion Error: {}", details))]
    DocumentInsertionError { details: String },
}
```

For lack of imagination, we currently have two failure modes, one occuring during index creation,
and the other during document insertion.

There is, however, an issue with this definition. It turns out that `Snafu` is well suited at
embedding error sources into an upper layer. For example, if I use a function from the
Elasticsearch Client crate which has a function `foo(...)` which returns a `Result<_,
elasticsearch::Error>`, I can define the following variant in my enum:

```rust
#[snafu(display("Container Creation Error: {}", source))]
FooError { source: elasticsearch::Error }
```

and in my function calling `foo`, I can have the following:

```rust
using snafu::ResultExt;

fn my_function(...) -> Result<_, Error> {

[...].foo()
     .context(FooError)?;
```

Snafu converts the `elasticsearch::Error` into a `FooError` and stores the former one in the
latter.

The problem is that, one of the core principle of the hexagonal architecture, is that the domain
should not depend on any backend.... so we really can't have, in the domain layer, a reference to
`elasticsearch::Error`. I've decided to serialize the errors, but I seem to be loosing part of the
benefit of Snafu.

The rest of the storage definition goes like this:

```rust[storage.rs]
use async_trait::async_trait;
use serde::Serialize;

use crate::domain::model::configuration::Configuration;
use crate::domain::model::index::Index;

#[async_trait]
pub trait Storage {
    async fn create_container(&self, config: Configuration)
      -> Result<Index, Error>;

    async fn insert_document<D>(&self, index: String,
        id: String, document: D,) -> Result<(), Error>
    where
      D: Serialize + Send + Sync + 'static;
}
```

As an aside, you can notice a nice side effect of the repository layout here. In the `use` section
at the top of the file, you quickly notice `use crate::domain`... which is nice because you would
quickly spot a `use crate::adapters` if one was to slip in there. I suppose you could even write
a static analysis tool to check for invalid dependencies.

There are some questionable choices in the interface.

1. We've decided to go for hard structs for the `create_container` function.
2. The `insert_document` takes a document which is `Serialize`.... Why not `Document` as previously
   defined?
3. The `insert_document` returns nothing on success... I can't see anything to return of value.
4. A little type alias would look better instead of `index: String` or `id: String`.
5. What's up with all that `Send + Sync + 'static`

Ok, we've defined an interface, we can go about testing it. [FIXME: why interface -> testing]

We add a dependency on `mockall`:

```toml[Cargo.toml]
[dev-dependencies]
mockall = "0.9.1"
```

and add a derive macro to the definition of our `Storage` trait:

```rust[storage.rs]
#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait Storage {
  ...
}
```

In the domain, the object using that `Storage` trait is a **usecase**. It owns a trait object,
which is an object whose type is unknown, but whose behavior conforms to the trait. In our case,
the use case owns a trait object `Box<dyn Storage>`.

So we'll extend our file structure to include use cases.

```
 ├── domain
 │    ├── mod.rs
 │    ├── model
 │    ├── ports
 │    └── usecases
 │         ├── mod.rs
 │         └── generate_index.rs
```

The use case:

```rust[domain/usecases/generate_index.rs]
use crate::domain::ports::storage::Storage;

pub struct GenerateIndex {
    pub storage: Box<dyn Storage + Send + Sync + 'static>,
}

impl GenerateIndex {
    fn new(storage: Box<dyn Storage + Send + Sync + 'static>) -> Self {
        GenerateIndex { storage }
    }
}

#[cfg(test)]
pub mod tests {

    use super::GenerateIndex;
    use crate::domain::ports::storage::MockStorage;

    async fn some_interesting_test() {
        let storage = MockStorage::new();
        let usecase = GenerateIndex::new(storage);
    }
}
```

The use case includes the premise of a test.

Unfortunately, the compiler reminds us that the `Storage` trait we built is not object safe because the method
`insert_document` has generic type parameters.

It seems the best solution to this problem is the one proposed by David Tolnay for his crate erased-serde.

## References

* Original article about [Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/) by Alistair Cockburn

[^10]: [Migrating from quick-error to SNAFU: a story on revamped error handling in Rust](https://dev.to/e_net4/migrating-from-quick-error-to-snafu-a-story-on-revamped-error-handling-in-rust-58h9)
