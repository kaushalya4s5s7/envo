# Third-party notices

The MIT license in [`LICENSE`](LICENSE) applies to Envo's original source code only. The services,
data, external media, and generated visual components listed below keep their own terms.

## BOPTEST

Envo uses the upstream [IBPSA Project 1 BOPTEST repository](https://github.com/ibpsa/project1-boptest)
and its HTTP service. Envo does not include or fork the BOPTEST emulator. BOPTEST is distributed
under its revised 3-clause BSD license:

- [Upstream BOPTEST license](https://github.com/ibpsa/project1-boptest/blob/master/license.md)
- [Upstream BOPTEST project](https://ibpsa.github.io/project1-boptest/)

The BOPTEST copyright notice belongs to the International Building Performance Simulation
Association and its contributors. BOPTEST-derived sample payloads under
[`docs/reference/boptest/samples/`](docs/reference/boptest/samples/) and
[`fixtures/boptest-points.json`](fixtures/boptest-points.json) are retained for the project’s
benchmark documentation and remain subject to the upstream terms.

## OpenStreetMap

The interactive block map requests raster tiles from
`https://tile.openstreetmap.org`. OpenStreetMap data is available under the
[Open Database License (ODbL)](https://www.openstreetmap.org/copyright).

The running map displays and links the required attribution: **© OpenStreetMap contributors**.
Tile use also follows the [OpenStreetMap Foundation tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## Napkin AI diagrams

The architecture diagrams in [`docs/assets/`](docs/assets/) were generated with Napkin AI from
Envo-authored prompts and content. Their use is governed by
[Napkin’s terms](https://www.napkin.ai/terms-conditions/). Napkin permits use of generated output
subject to its terms, while individual templates, icons, and other components remain Napkin or
licensor property. The diagrams are used as complete exported works and are not relicensed as
standalone MIT assets.

## FortyGuard

FortyGuard is an external data service. Envo calls its API during live capture and stores selected
responses in project fixtures for deterministic replay. FortyGuard’s service, data, trademarks, and
API terms remain with FortyGuard. API credentials are never distributed with this repository.

## YouTube

The README links to the Envo demo video and loads its thumbnail from YouTube. The thumbnail is
external media and is not included in this repository. Its use remains subject to the rights and
terms applicable to the linked video and YouTube service.

## Package dependencies

Third-party packages are installed from the lockfile and retain their own licenses. The root MIT
license does not replace the licenses of packages in `node_modules` or their transitive
dependencies. Consult each package's published license when redistributing a production bundle.
