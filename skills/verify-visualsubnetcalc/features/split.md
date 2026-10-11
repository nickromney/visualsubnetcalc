# Split and join

The user enters a base network and splits rows into halves, recursively. Join cells (labelled `<cidr> Join`) merge them back.

## Sub-features

- `split-base`: Go shows one row for the base network.
- `split-row` replaces a row with two half-size rows.
- `join-row` merges children back (not yet driven).

## How to get to it (user POV)

- Type a network and size, press Go, then click a row's Split cell.

## Driving it with control.sh

Preconditions:

- `doctor` prints `OK`.

- **Split twice.** `control.sh --execute drive split 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17` steps through `10.0.0.0/16 hosts=65534`, then `10.0.0.0/17` and `10.0.128.0/17` (32766 each), then `10.0.0.0/18`, `10.0.64.0/18` and `10.0.128.0/17`. `export.json` has `base_network: 10.0.0.0/16`.

## Gotchas

- The minimum prefix depends on the mode: /32 Standard, /28 AWS, /29 Azure, /30 OCI.
