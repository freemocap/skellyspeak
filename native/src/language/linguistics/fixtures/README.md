# Unicode conformance fixture provenance

Downloaded unchanged on 2026-09-10:

- GraphemeBreakTest-17.0.0.txt: https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakTest.txt
  SHA-256: e2d134d2c52919bace503ebb6a551c1855fe1a1faec18478c78fff254a1793ec
  126570 bytes, 766 non-comment test cases.
- UNICODE-LICENSE.txt: https://www.unicode.org/license.txt
  SHA-256: e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96
  1995 bytes. Original copyright/license notice remains in the test data.

The unit test parses expected break/non-break positions independently of the crate,
compares the entire allowed-boundary catalog, checks endpoint rejection and UTF-16
round-trips, and asserts Unicode version and corpus case count. This is test-only
public data; it is not runtime source text or a provider prompt. Fixtures are pinned
locally so tests never download them or access the network.
