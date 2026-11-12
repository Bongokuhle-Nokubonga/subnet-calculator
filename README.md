# Subnet Calculator

A free IPv4 subnet calculator that runs in the browser.

**Try it:** https://bongokuhle-nokubonga.github.io/subnet-calculator/

Built with plain HTML, CSS and JavaScript (no frameworks, no tracking), and tested
automatically on every push.

## Features

- Accepts `192.168.1.10/24`, `192.168.1.10 255.255.255.0`, or just an address
- Network and broadcast addresses, usable host range, number of hosts
- Subnet mask, wildcard mask (for ACLs and OSPF), classful class
- Address type: private (RFC 1918), public, loopback, APIPA (with a hint that DHCP probably failed), CGNAT, multicast and more
- Binary view with network bits and host bits in different colours
- **Split a network** into equal subnets, e.g. a /24 into four /26s
- **"How big a subnet do I need?"**: turn a host count into a prefix, e.g. 50 hosts → /26
- Handles edge cases correctly: /31 point-to-point links (RFC 3021), /32 host routes, and /0
- Shareable links: the address goes in the URL, e.g. `.../subnet-calculator/#10.0.0.0%2F8`
- Works on phones, has automatic dark mode, and is keyboard and screen-reader friendly

## Tests

The subnet maths is in [`subnet.js`](subnet.js), separate from the page, so it can be tested.
The same test cases run in two places:

- **In the browser:** open [`tests.html`](https://bongokuhle-nokubonga.github.io/subnet-calculator/tests.html)
- **In Node.js:** `node tests/run.mjs` (this runs on GitHub Actions on every push)

## Run locally

Browsers block JavaScript modules on `file://` pages, so serve the folder with any
local web server, for example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Why I built it

Subnetting is a core skill for CompTIA Network+ and day-to-day network support. Writing
the calculator made me work through the binary maths myself, including the edge cases that
most quick calculators get wrong.
