# cli-flags-parser

cli-flags-parser is:

- Minimal. No dependencies. Tiny API.
- Flexible. Complete control to you.
- Strict. Report great errors.
- Type safe. Great TypeScript experience.
- Functional. Pure functions.

cli-flags-parser does not:

- Generate help text.
- Help you write as little code as possible.

While many other CLI libraries try to do everything for you through configuration, cli-flags-parser’s goal is to feel more like a good old `for` loop over `process.argv`.

## Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [Example](#example)
- [Supported](#supported)
- [Not supported](#not-supported)
- [API](#api)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

Not published on npm (yet?).

## Example

TBD

- [Comprehensive example](https://github.com/lydell/cli-flags-parser/blob/main/tests/elm-test.test.ts)

## Supported

- `-h`: Short flags.
- `--help`: Long flags.
- `-o out.txt`: Short flags with values.
- `--output out.txt`: Long flags with values.
- `-o=out.txt`: Short flags with values using equals sign.
- `--output=out.txt`: Long flags with values using equals sign.
- `-abc`: Groups of short flags.
- `-abc=value`: Groups of short flags, the last one with a value.
- `--` to stop parsing flags.
- `--delimiter -- --next-flag`: `--` can still be used as a value without stopping flags parsing.

## Not supported

- `-d/`: Flag values right next to short flags. This is a complicated and confusing feature. Use `-d /` or `-d=/` instead.
- `+f /f`: Other types of flags. If you need that, cli-flags-parser might not be the library for you.

## API

TBD

## License

[MIT](LICENSE).
