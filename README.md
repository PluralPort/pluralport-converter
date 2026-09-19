# PluralPort Converter

PluralPort Converter turns a plural app's own export into a [PluralPort](https://pluralport.com) file, in your browser, without an account.

It exists for the apps that don't implement PluralPort themselves. Without it, moving your data means finding some third app that happens to read both your old app's format and something your new app understands, and round-tripping through it. This converts directly instead, and doubles as a set of reference implementations of the spec's mappings.

The converter started as a [PluralSpace](https://pluralspace.app) project and is now maintained alongside the specification.

## Open spec questions

Places where this implementation has had to make a call the spec doesn't settle yet are tagged `SPEC-OPEN(<topic>)` in the source. Grep for them before changing envelope output:

- `SPEC-OPEN(producer-exporter)` - the spec's `producer` block identifies the app that wrote the export and offers `exporter_version`, but has no field naming *which* tool performed a third-party conversion. We keep `producer` as the source app (it's what `source_refs` and the `extensions` namespace key off) and record the converter's identity under a namespaced extension. If the spec gains `producer.exporter`/`exporter_id`, these sites move back into `producer`.

## Getting Started

To get started with contributing, please follow these steps:

1. Fork the repository and create a new branch for your feature or bug fix.
2. Make your changes and commit them with clear and descriptive messages.
3. Push your changes to your forked repository.
4. Create a pull request to the main repository, describing your changes and why they are necessary
5. Wait for feedback from the maintainers and make any necessary changes based on their suggestions.
6. Once your pull request is approved, it will be merged into the main repository.

## Setting Up Your Development Environment

To set up your development environment for the converter, you will need to have the following tools installed:
- Node.js (version 22 or higher)
- NPM (latest version for your Node.js version)

That's it! It's a nuxt 4 app so you can clone it, then simply run `npm install` to install the dependencies, and `npm run dev` to start the development server.

## Code of Conduct

Just be nice. I don't want to write a full code of conduct but I want to make it clear that we do not tolerate any form 
of harassment, discrimination, or disrespectful behavior in our community. We want this project to be a welcoming and 
inclusive space for everyone, regardless of their background, identity, or beliefs. Please treat others with 
kindness and respect, and if you see any behavior that violates this code of conduct, please report it to the maintainers.

## Contributing Guidelines
We welcome contributions! If you have an idea for a new feature, have found a bug, or want to help improve 
the documentation, please feel free to submit a pull request. You can find more detailed contributing guidelines in the 
CONTRIBUTING.md file in the root of the repository. Please make sure to read and follow these guidelines when submitting 
your contributions.

## License

PluralPort Converter is licensed under the MIT License. See the LICENSE file in the root of the repository for more information.