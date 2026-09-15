## fastlane documentation

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### internal

```sh
[bundle exec] fastlane internal
```

Clean build release AAB and upload it to Play Internal

---

### production

```sh
[bundle exec] fastlane production
```

Upload AAB to Production (100%)

---

This README.md is maintained manually. The Fastfile disables automatic docs generation so this Android-only project can document lanes as `fastlane internal` and `fastlane production`.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
