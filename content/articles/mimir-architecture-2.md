---
title: Growing Mimir using the Hexagonal Architecture (II)
description: Tutorial showing the development of a component of mimirsbrunn using the hexagonal architecture. This part focuses on the secondary adapter (Elasticsearch)
img: /img/stocks/leaves3.jpg
alt: Photo by <a href="https://unsplash.com/@erol?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Erol Ahmed</a> on <a href="https://unsplash.com/s/photos/leaves?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
author: 
  name: Matthieu
  bio: Rust and such
  img: /img/profiles/programmer.svg
tags:  ['rust', 'hexagonal architecture', 'elasticsearch']
---

## Secondary Adapters

We'll focus on the implementation of the `Storage` trait. Of course, the main artisan of this implementation is the
[Elasticsearch Rust Client](https://docs.rs/elasticsearch/7.12.0-alpha.1/elasticsearch/)

For ports in the backend, the implementation is an **Adapter**. It adapts the external component (Elasticsearch) to the
requirements of the port (`Storage`).

So we extend the file hierarchy:

```
 ├── adapters
 │    ├── mod.rs
 │    └── secondary
 │         ├── mod.rs
 │         └── elasticsearch.rs
```

We recall that the first method of the `Storage` trait is:

```rust[domain/ports/storage.rs]
async fn create_container(&self, config: Configuration) -> Result<Index, Error>;
```

### Index Configuration

If we look at the Elasticsearch Create API, we see that we need the following elements to create an Elasticsearch index:
- **Index**: Name of the index to create
- **Settings**: Configuration options for the index
- **Mappings**: Mappings for the fields in the index.
- **Parameters**: Timeout, Wait for Active Shards, ...
- **aliases**: Aliases for the index.

Elasticsearch requires this information to be provided as JSON. So we'll create the necessary structs to hold this
information:

```rust[adapters/secondary/elasticsearch.rs]
#[derive(Debug, Serialize, Deserialize)]
pub struct IndexConfiguration {
    pub name: String,
    pub parameters: IndexParameters,
    pub settings: IndexSettings,
    pub mappings: IndexMappings,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct IndexSettings {
    pub value: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct IndexMappings {
    pub value: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename = "snake_case")]
pub struct IndexParameters {
    pub timeout: String,
    pub wait_for_active_shards: String,
}
```

We leave the details of the values out for now, and hide everything behind a
`String`.

We have to translate the configuration given by the port into the configuration used by Elasticsearch. In Rust this is
simply a matter of implementing a `From` or `TryFrom`. Probably `TryFrom` is better because the information comes from
a user and can be invalid. So we need to define an error type:

```rust[adapters/secondary/elasticsearch.rs]
use snafu::{ResultExt, Snafu};

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Invalid Index Configuration: {}", details))]
    InvalidConfiguration { details: String },

```

and now we can implement `TryFrom`:

```rust[adapters/secondary/elasticsearch.rs]
use crate::domain::model::configuration::Configuration;

impl TryFrom<Configuration> for IndexConfiguration {
    type Error = Error;

    // FIXME Parameters not handled
    fn try_from(configuration: Configuration) -> Result<Self, Self::Error> {
        let Configuration { value, .. } = configuration;
        serde_json::from_str(&value).map_err(|err| Error::InvalidConfiguration {
            details: format!(
                "could not deserialize configuration: {} / {}",
                err.to_string(),
                value
            ),
        })
    }
}
```

How about a test to make sure that, if we provide an invalid configuration, we get correctly notified:

```rust[adapters/secondary/elasticsearch.rs]
#[cfg(test)]
pub mod tests {

    use std::convert::TryFrom;

    use super::IndexConfiguration;
    use crate::domain::model::configuration::Configuration;

    #[test]
    #[should_panic(expected = "could not deserialize configuration")]
    fn should_return_invalid_configuration() {
        let config = Configuration {
            value: String::from("invalid"),
        };
        IndexConfiguration::try_from(config).unwrap();
    }
}
```

### Connection

If we want the code to be reusable (FIXME SOLID)

We will thus define a new port on the backend for remote connectivity:

```rust[domain/ports/remote.rs]
use async_trait::async_trait;
use snafu::Snafu;

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Connection Error: {}", details))]
    Connection { details: String },
}

#[async_trait]
pub trait Remote {
    type Conn;
    async fn conn(self) -> Result<Self::Conn, Error>;
}
```

FIXME Tests on Remote ?

From the Elasticsearch crate's documentation, we see that the client API is accessible through a
[`Elasticsearch`](https://docs.rs/elasticsearch/7.12.0-alpha.1/elasticsearch/struct.Elasticsearch.html) object.

So we'll write some code to go from the URL to an `Elasticsearch`. We need to add a couple crates to our dependencies:

```toml[Cargo.toml]
elasticsearch = "7.12.0-alpha.1"
url = "2.2"
```

The first part consists in Creating a `SingleNodeConnectionPool`, and the second establishes the connection.
For the first part, we'll extend the error type to report when an invalid URL is provided.

```rust[adapters/secondary/elasticsearch.rs]
use snafu::ResultExt;
use url::Url;

#[derive(Debug, Snafu)]
pub enum Error {
    [...]
    #[snafu(display("Invalid URL: {}", source))]
    InvalidUrl { source: url::ParseError },
}

/// Open a connection to elasticsearch
pub async fn connection_pool(url: &str) -> Result<SingleNodeConnectionPool, Error> {
    let url = Url::parse(url).context(InvalidUrl)?;
    let pool = SingleNodeConnectionPool::new(url);
    Ok(pool)
}
```

Finally, to establish the connection, we implement the `Remote` trait, and also extend the Error type:

```rust[adapters/secondary/elasticsearch.rs]
#[derive(Debug, Snafu)]
pub enum Error {
    [...]
    #[snafu(display("Elasticsearch Connection Error: {}", source))]
    ElasticsearchConnectionError { source: TransportBuilderError },
}

#[async_trait]
impl Remote for SingleNodeConnectionPool {
    type Conn = Elasticsearch;

    /// Use the connection to create a client.
    async fn conn(self) -> Result<Self::Conn, RemoteError> {
        let transport = TransportBuilder::new(self)
            .disable_proxy()
            .build()
            .context(ElasticsearchConnectionError)
            .map_err(|err| RemoteError::Connection {
                details: err.to_string(),
            })?;
        let client = Elasticsearch::new(transport);
        Ok(client)
    }
}

[...]
#[cfg(test)]
pub mod tests {

    #[tokio::test]
    #[should_panic(expected = "could not parse Elasticsearch URL")]
    async fn should_return_invalid_url() {
        let _pool = connection_pool("foo").await.unwrap();
    }
}
```

### Docker

At that point we need to test if we can actually establish a connection with an actual Elasticsearch. Since
we can't expect the user to install Elasticsearch to run these tests, we'll instead rely on docker. Rust has
a crate, [Bollard](https://docs.rs/bollard/0.10.1/bollard/index.html), to interact with the Docker API.

We can find in the
[Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html) that we
should be launching the container with the following command line:

```
docker run
  -p 9200:9200 -p 9300:9300
  -e "discovery.type=single-node"
  --name "mimir-test-elasticsearch"
  docker.elastic.co/elasticsearch/elasticsearch:7.13.0
```

But it takes a while for this command to complete, and for Elasticsearch to be available. We could have a `setup()` and
`teardown()` function before and after every tests, but that would preclude the effective testing execution.

<alert class="question">
Since I'm not sure how to run a single setup and teardown function for the execution of `cargo test`, I will resort to
... the simplest solution. Expect the user to start the docker container before executing the tests.
</alert>

So, with Docker (temporarily) out of the way, we can write a simple test for the connection functionality:

```rust[adapters/secondary/elasticsearch.rs]
#[tokio::test]
async fn should_connect_to_elasticsearch() {
    let pool = connection_pool("http://localhost:9200")
        .await
        .expect("Elasticsearch Connection Pool");
    let _client = pool
        .conn()
        .await
        .expect("Elasticsearch Connection Established");
}
```

[github](0c2d402)

### Elasticsearch

We can now see how to actually create indices with the Elasticsearch client.

For that we need to implement the first method of the `Storage` trait.

```rust[adapters/secondary/elasticsearch.rs]
use crate::domain::model::configuration::Configuration;
use crate::domain::model::index::Index;
use crate::domain::ports::storage::{Error as StorageError, Storage};

#[async_trait]
impl Storage for Elasticsearch {
    async fn create_container(&self, config: Configuration) -> Result<Index, StorageError> {
      [...]
    }
```

We will be using the `IndicesCreate` API, which basically involves extracting relevant elements from the configuration,
and making sure all possible error mode are correctly recorded (ie avoid `.unwrap()` and `.expect()` which will
inevitably come and bite you when you least expect it).

The configuration is split between the body of the request, and url parameters.

```rust[adapters/secondary/elasticsearch.rs]
let config = IndexConfiguration::try_from(config).map_err(|err| {
    StorageError::ContainerCreationError {
        details: format!("could not convert index configuration: {}", err.to_string()),
    }
})?;
let body_str = format!(
    r#"{{ "mappings": {mappings}, "settings": {settings} }}"#,
    mappings = config.mappings.value,
    settings = config.settings.value
);
let body: serde_json::Value = serde_json::from_str(&body_str)
.map_err(|err| {
    StorageError::ContainerCreationError {
        details: format!("could not deserialize index configuration: {}", err.to_string()),
    }
})?;
```

Finally we can call Elasticsearch to create the index:

```rust[adapters/secondary/elasticsearch.rs]
let response = self
    .indices()
    .create(IndicesCreateParts::Index(&config.name))
    .timeout(&config.parameters.timeout)
    .wait_for_active_shards(&config.parameters.wait_for_active_shards)
    .body(body)
    .send()
    .await
    .map_err(|err| StorageError::ContainerCreationError {
        details: format!("could not create index: {}", err.to_string()),
    })?;
```

At this point, we need to do a bit more work to get a proper response to the client, because the one we receive does not
contain much information: `{"acknowledged": true, "index": "name", "shards_acknowledged": true}`

We'll call the CAT indices API to query the index status. The rest of the code is actually not very intesting, except
for two salient points:

First, the response we get from Elasticsearch CAT indices API includes a more detailed description of the index. So we
need a type to encode this information, as well as the ability to transform it into our `model::index`:

```rust[adapters/secondary/elasticsearch.rs]
/// This is the information provided by Elasticsearch CAT Indice API
#[derive(PartialEq, Debug, Serialize, Deserialize)]
pub struct ElasticsearchIndex {
    pub health: String,
    pub status: String,
    #[serde(rename = "index")]
    pub name: String,
    #[serde(rename = "docs.count")]
    pub docs_count: Option<String>,
    #[serde(rename = "docs.deleted")]
    pub docs_deleted: Option<String>,
    pub pri: String,
    #[serde(rename = "pri.store.size")]
    pub pri_store_size: Option<String>,
    pub rep: String,
    #[serde(rename = "store.size")]
    pub store_size: Option<String>,
    pub uuid: String,
}

impl From<ElasticsearchIndex> for Index {
    fn from(index: ElasticsearchIndex) -> Self {
        let ElasticsearchIndex {
            name,
            docs_count,
            status,
            ..
        } = index;

        let docs_count = match docs_count {
            Some(val) => val.parse::<u32>().expect("docs count"),
            None => 0,
        };
        Index {
            name,
            docs_count,
            status: IndexStatus::from(status),
        }
    }
}

impl From<String> for IndexStatus {
    fn from(status: String) -> Self {
        match status.as_str() {
            "green" => IndexStatus::Available,
            "yellow" => IndexStatus::Available,
            _ => IndexStatus::Available,
        }
    }
}
```

Second, if Elasticsearch's response is not a success, it will give an exception. We need a way
to extract relevant information from the exception. So we write `impl From<Exception> to Error`, by analyzing
the text content of the exception using regular expressions.

So we add two new dependencies in `Cargo.toml` to deal with regular expressions:

```toml[Cargo.toml]
lazy_static = "1.4"
regex = "1.5.4"
```

And we extend the error type with a few possibilities:

```rust[adapters/secondary/elasticsearch.rs]
use lazy_static::lazy_static;
use regex::Regex;

#[derive(Debug, Snafu)]
pub enum Error {
    [...]
    /// Elasticsearch Unhandled Exception
    #[snafu(display("Elasticsearch Unhandled Exception: {}", details))]
    ElasticsearchUnhandledException { details: String },

    /// Elasticsearch Duplicate Index
    #[snafu(display("Elasticsearch Duplicate Index: {}", index))]
    ElasticsearchDuplicateIndex { index: String },

    /// Elasticsearch Failed To Parse
    #[snafu(display("Elasticsearch Failed to Parse"))]
    ElasticsearchFailedToParse,

    /// Elasticsearch Unknown Index
    #[snafu(display("Elasticsearch Unknown Index: {}", index))]
    ElasticsearchUnknownIndex { index: String },

    /// Elasticsearch Unknown Setting
    #[snafu(display("Elasticsearch Unknown Setting: {}", setting))]
    ElasticsearchUnknownSetting { setting: String },
}
```

Finally, we can write the code to convert an Elasticsearch exception into our Error type.

```rust[adapters/secondary/elasticsearch.rs]
impl From<Exception> for Error {
    // This function analyzes the content of an elasticsearch exception,
    // and returns an error, the type of which should mirror the exception's content.
    // There is no clear blueprint for this analysis, it's very much adhoc.
    fn from(exception: Exception) -> Error {
        let root_cause = exception.error().root_cause();
        if root_cause.is_empty() {
            // TODO If we can't find a root cause, not sure how to handle that.
            Error::ElasticsearchUnhandledException {
                details: String::from("Unspecified root cause"),
            }
        } else {
            lazy_static! {
                static ref ALREADY_EXISTS: Regex =
                    Regex::new(r"index \[([^\]/]+).*\] already exists").unwrap();
            }
            lazy_static! {
                static ref NOT_FOUND: Regex = Regex::new(r"no such index \[([^\]/]+).*\]").unwrap();
            }
            lazy_static! {
                static ref FAILED_PARSE: Regex = Regex::new(r"failed to parse").unwrap();
            }
            lazy_static! {
                static ref UNKNOWN_SETTING: Regex =
                    Regex::new(r"unknown setting \[([^\]/]+).*\]").unwrap();
            }
            match root_cause[0].reason() {
                Some(reason) => {
                    if let Some(caps) = ALREADY_EXISTS.captures(reason) {
                        let index = String::from(caps.get(1).unwrap().as_str());
                        Error::ElasticsearchDuplicateIndex { index }
                    } else if let Some(caps) = NOT_FOUND.captures(reason) {
                        let index = String::from(caps.get(1).unwrap().as_str());
                        Error::ElasticsearchUnknownIndex { index }
                    } else if FAILED_PARSE.is_match(reason) {
                        Error::ElasticsearchFailedToParse
                    } else if let Some(caps) = UNKNOWN_SETTING.captures(reason) {
                        let setting = String::from(caps.get(1).unwrap().as_str());
                        Error::ElasticsearchUnknownSetting { setting }
                    } else {
                        Error::ElasticsearchUnhandledException {
                            details: format!("Unidentified reason: {}", reason),
                        }
                    }
                }
                None => Error::ElasticsearchUnhandledException {
                    details: String::from("Unspecified reason"),
                },
            }
        }
    }
}
```

<alert class="question">
At this point I don't see a clean way to do unit tests for this Elasticsearch client code. We cannot really mock the
Elasticsearch response...
</alert>

[github](65f323a)
