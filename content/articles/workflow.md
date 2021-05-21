---
title: Release Workflow
description: Work In Progress on the design of a release workflow and its tooling
img: /img/stocks/leaves2.jpg
alt: Photo by <a href="https://unsplash.com/@ilypnytskyi?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Igor Lypnytskyi</a> on <a href="https://unsplash.com/@ilypnytskyi?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
author: 
  name: Matthieu
  bio: Rust and such
  img: /img/profiles/programmer.svg
tags:  ['rust']
---

This documents a **work in progress** workflow used, from development to deployment, for
Mimirsbrunn.

## Context

I extended and formalized an existing workflow, and tried to make it slightly more automatic, or at
least reduce the number and the complexity of the commands to use, so that it would be less error
prone. By doing so, I made some assumptions, some of which I can clearly articulate, some I can't.
And I don't have enough practice with this Makefile to know if it can be easily modified to suit
other contexts. It feels brittle though, meaning a small refactoring can be tricky.

Anyway, here are a couple assumptions:

1. It's a rust project. So the Makefile includes a couple of rust specifics, like the use for
   `cargo` for running tests, lints, and so on. These are used in preflight checks. I also use the
   `Cargo.toml` as the source for information about the version. So I read the version from there,
   and I also change the file to update the version.
2. We use a couple of tools around, some are very common (eg. github), some less so. You can
   probably easily swap them around.
3. I rely on docker. The release artifacts are docker images.
4. Versioning follows [semver](https://semver.org/). (This is used to tag images, and automatically
   increment version number when cutting a new prerelease.
5. Commit message are prefixed with the type of change. This is used when building the changelog to
   gather commits by their type.

My motivation was also to embed this workflow in a Makefile, so that it is easier to embed the
project in a CI/CD pipeline, by having to write simple make commands in a CI tool.

## Development

The workflow begins in a local environment. I could, and maybe will, tackle what happens before the
dev starts to code, like, for example, in the context of Behavior Driven Development (BDD), the
developer could create new test features before actually starting to implement a functionality.
Anyway, it starts, as is often the case, by cycles of code editing followed by unit tests
execution. This step is simplified with the `make pre-build` command, which runs a formatting and
linting checks, followed by unit tests.

![Workflow](/img/7023406c-c3f6-4320-8196-f511969be213/workflow-dev-1.svg)

The command `pre-build` is:

```
re-build: fmt lint test

fmt: format ## Check formatting of the code (alias for 'format')
format: ## Check formatting of the code
  cargo fmt --all -- --check

clippy: lint ## Check quality of the code (alias for 'lint')
lint: ## Check quality of the code
  cargo clippy --all-features --all-targets \
    -- --warn clippy::cargo --allow clippy::multiple_crate_versions --deny warnings

test: ## Launch all tests
  cargo test --all-targets                 # `--all-targets` but no doctests
```

## Integration Tests

When the development stage is complete, then its time to run some integration tests, or acceptance
tests.  I run these tests, which are similar to those executed in a CI pipeline later, to gain
confidence ahead of the actual CI pipeline. Integration tests, in my context, involve a couple of
services talking to each other, each of which is a single docker container. So I use the command
`make snapshot` to build an image and push it to a local repository. I can then call for example
`docker-compose` to evaluate these images. So I use a local docker registry, which you can have
with:

```
docker run -d -p 5000:5000 --name registry registry:2
```

![Workflow](/img/7023406c-c3f6-4320-8196-f511969be213/workflow-test-1.svg)

If the test fails, well, tough luck, you're back to the development square.

So what does make snapshot looks like?

```
snapshot: build push

build: pre-build docker-build post-build

pre-build: fmt lint test

post-build:

docker-build:
  [...]

push: pre-push do-push post-push

pre-push:

post-push:

do-push:
  [...]
```

The `docker-build` rule is made a bit complex, but it essentially runs `docker build`, with the
right tags. Same thing for `docker-push`.

::: callout question
Credentials for eg docker hub?
:::

### Reviews

The project is open source, and multiple developers collaborate on github. We use github worflow,
so when the new code passes acceptance tests, its time to submit a pull request (PR).

![Workflow](/img/7023406c-c3f6-4320-8196-f511969be213/workflow-github-1.svg)

There are hooks in git to trigger the execution of a Jenkins pipeline. The purpose of this pipeline
is to give a feedback inside the PR's page about the validity of the code. So the validation
pipeline will run the acceptance tests.

::: callout info
It's not very clear if the validation pipeline (Jenkins, Travis, ...) should make use of a public
registry or create a local registry.
:::

### Pre Release

Your code has successfully passed the pull request reviews, and is ready for a pre-release.  You
can bundle together multiple Pull Requests before cutting a pre-release.

![Workflow](/img/7023406c-c3f6-4320-8196-f511969be213/workflow-prere-1.svg)

::: callout question
The `make prerelease` command pushes images to a docker registry. But the diagram mentions
a *deployment pipeline* used by Jenkins.... Isn't that redundant?
:::

The Makefile provide some help to create the pre-release: `make {major, minor, patch}-prerelease`.
These commands will, assuming you're using semantic versioning, increment the correct element of
your version, and use a suffix '-rc0'

In addition, the `make new-prerelease` command will just increment the pre-release number, `-rc1,
-rc2, ...`.

The prerelease commands essentially:
- retrieves the current version number
- computes the new version number
- makes sure the tag corresponding to that version does not exist yet.
- modifies the version inside the code (`Cargo.toml` in our context).
- commit this change (version)
- use `git tag`
- make a release (build and push)

::: callout warning
It is up to you to push these changes to your source repository.
:::

So what's in this pre-release command? In the following Makefile extract, we focus on the
`patch-prerelease`.

```
patch-prerelease: tag-patch-prerelease release
  @echo $(VERSION)

tag-patch-prerelease: VERSION := $(shell . $(RELEASE_SUPPORT); nextPatchPrerelease)
tag-patch-prerelease: tag
```

Here is the `tag` rule:

```
tag: check-status
  @. $(RELEASE_SUPPORT) ; ! tagExists $(TAG) \
     || (echo "ERROR: tag $(TAG) for version $(VERSION) already tagged in git" >&2 && exit 1) ;
  @. $(RELEASE_SUPPORT) ; setRelease $(VERSION)
  cargo check
  git add .
  git commit -m "[VER] new version $(VERSION)" ;
  git tag -a $(TAG) -m "Version $(VERSION)";
  @ if [ -n "$(shell git remote -v)" ] ; then \
      git push --tags ; \
      else echo 'no remote to push tags to' ; \
    fi
```

And for the release, we run a couple of checks prior to `build` and `push`, which have already been
seen.

```
release: check-status check-release build push

check-status:
  @. $(RELEASE_SUPPORT) ; ! hasChanges \
    || (echo "Status ERROR: there are outstanding changes" >&2 && exit 1) \
    && (echo "Status OK" >&2 ) ;

check-release: TAG=$(shell . $(RELEASE_SUPPORT); getTag $(VERSION))
check-release:
  $(info $$VERSION is [${VERSION}])
  $(info $$TAG is [${TAG}])
  @. $(RELEASE_SUPPORT) ; tagExists $(TAG) \
  || (echo "ERROR: version not yet tagged in git. make [minor,major,patch]-release." >&2 && exit 1) ;
  @. $(RELEASE_SUPPORT) ; ! differsFromRelease $(TAG) \
  || (echo "ERROR: current directory differs from tagged $(TAG). make [minor,major,patch]-release." ; exit 1)
```

## Release

All flags are green, ready to make the release!

The command `make new-release` will help you. It will
- remove the `-rcN` prefix from the version number
- makes sure the tag corresponding to that version does not exist yet.
- modifies the version inside the code (`Cargo.toml` in our context).
- generate the Changelog
- commit these changes (version and changelog)
- use `git tag`
- make a release (build and push)

```
new-release: tag-new-release release ## Drop the prerelease suffix and release
  @echo $(VERSION)

tag-new-release: VERSION := $(shell . $(RELEASE_SUPPORT); nextRelease)
tag-new-release: changelog tag
```

The changelog is built by gathering all the commits since the last release, organizing by change
type, and displaying them along with some context.

::: callout warning
It is up to you to push these changes to your source repository.
:::

## Conclusion

![Workflow](/img/7023406c-c3f6-4320-8196-f511969be213/workflow-all-1.svg)

## Appendix

### Changelog

[keep a changelog](https://keepachangelog.com/en/1.0.0/) provides some guidance on creating
a Changelog. It includes a suggestion for prefixing the commit by the type of change:
- *Added* for new features.
- *Changed* for changes in existing functionality.
- *Deprecated* for soon-to-be removed features.
- *Removed* for now removed features.
- *Fixed* for any bug fixes.
- *Security* in case of vulnerabilities.

## Reference

* [keep a changelog](https://keepachangelog.com/en/1.0.0/)

* [Generic Docker Makefile](https://github.com/mvanholsteijn/docker-makefile) provided a very good
    stepping stone for this project.
