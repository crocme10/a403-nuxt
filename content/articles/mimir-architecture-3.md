---
title: Growing Mimir using the Hexagonal Architecture (III)
description: Tutorial showing the development of a component of mimirsbrunn using the hexagonal architecture. This part focuses on usecases and the primary adapter.
img: /img/stocks/leaves3.jpg
alt: Photo by <a href="https://unsplash.com/@erol?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Erol Ahmed</a> on <a href="https://unsplash.com/s/photos/leaves?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
author: 
  name: Matthieu
  bio: Rust and such
  img: /img/profiles/programmer.svg
tags:  ['rust', 'hexagonal architecture']
---

## Primary Adapters

Recall the difference we made between driving and driven adapters. We just completed the Elasticsearch adapter, which
implements the `Storage` port. It is driven by the domain.

On the driving side, we already implemented the `GenerateIndex` use case, because it allowed us to test the `Storage`
port. Well the use case is in fact an implementation of a primary port, which we call `Import`. `Import` has a single
method, which resembles that of the `GenerateIndex`:

```rust[domain/ports/import.rs]
/// Create index and stores documents in them.
#[async_trait]
pub trait Import {
    /// Type of document
    type Doc: Document + 'static;

    /// creates an index using the given configuration, and stores the documents.
    async fn generate_index<S>(&self, mut docs: S, config: Configuration) -> Result<Index, Error>
    where
        S: Stream<Item = Self::Doc> + Send + Sync + Unpin + 'static;
}
```

And we also face the same problem of trait safe objects, so we must *erase* the trait:

```rust[domain/ports/import.rs]
/// Allows building safe trait objects for Import
#[cfg_attr(test, mockall::automock(type Doc=Book;))]
#[async_trait]
pub trait ErasedImport {
    type Doc: Document;
    async fn erased_generate_index(
        &self,
        docs: Box<dyn Stream<Item = Self::Doc> + Send + Sync + Unpin + 'static>,
        config: Configuration,
    ) -> Result<Index, Error>;
}
```

We can now go back to the use case and connect it to this trait:

```rust[domain/usecases/generate_index.rs]
#[async_trait]
impl<T: Document + Send + Sync + 'static> Import for GenerateIndex<T> {
    type Doc = T;

    async fn generate_index<S>(
        &self,
        mut _docs: S,
        config: Configuration,
    ) -> Result<Index, ImportError>
    where
        S: Stream<Item = Self::Doc> + Send + Sync + Unpin + 'static,
    {
        self.storage
            .create_container(config)
            .await
            .map_err(|err| ImportError::IndexCreation {
                details: format!("Could not create container: {}", err.to_string()),
            })
    }
}
```

Of course, at that point, we need to modify the `UseCase::execute()` method so that it calls on that `generate_index()`
method:

```rust[domain/usecases/generate_index.rs]
#[async_trait]
impl<T: Document + Send + Sync + 'static> UseCase for GenerateIndex<T> {
    type Res = Index;
    type Param = GenerateIndexParameters<T>;

    async fn execute(&self, param: Self::Param) -> Result<Self::Res, UseCaseError> {
        self.generate_index(param.documents, param.config)
            .await
            .map_err(|err| UseCaseError::Execution {
                details: format!("Could not create container: {}", err.to_string()),
            })
    }
}
```

Since we've also implemented the `insert_document` method on the `Storage` trait, we can insert a few documents. I say
a few documents, because we're not yet supporting bulk import, which is more efficient for large imports.

[github](6ee841d)


