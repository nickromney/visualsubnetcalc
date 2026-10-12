# Cloud modes

Operating modes change the minimum subnet size and the reserved addresses: Standard reserves 2, AWS 5, Azure 5 and OCI 3.

## Sub-features

- `mode-standard`: a /24 gives usable `.1 - .254` and 254 hosts.
- `mode-azure`: a /24 gives usable `.4 - .254` and 251 hosts.
- `mode-aws` and `mode-oci` are not yet driven.

## How to get to it (user POV)

- Tools, then "Mode - <provider>".

## Driving it with control.sh

Preconditions:

- `doctor` prints `OK`.

- **Compare.** Run `control.sh --execute drive mode azure 10.0.0.0 24` and then `control.sh --execute drive mode standard 10.0.0.0 24`. The `mode` lines report `hosts 251` with `usable 10.0.0.4 - 10.0.0.254`, then `hosts 254` with `usable 10.0.0.1 - 10.0.0.254`.

## Gotchas

- Each drive starts on a fresh page in Standard mode.
