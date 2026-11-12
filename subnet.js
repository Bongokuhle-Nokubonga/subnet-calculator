// IPv4 subnet maths. Pure functions, no DOM: used by the web page and by the tests.
// IPv4 addresses are handled as unsigned 32-bit integers (">>> 0" keeps them unsigned).

/** "192.168.1.10" -> 3232235786. Throws on anything that is not a valid dotted-quad address. */
export function parseIPv4(text) {
  const parts = String(text).trim().split(".");
  if (parts.length !== 4) throw new Error(`"${text}" is not an IPv4 address (needs 4 numbers separated by dots)`);
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`"${part}" is not a number from 0 to 255`);
    const n = Number(part);
    if (n > 255) throw new Error(`${n} is too big: each part must be 0 to 255`);
    if (part.length > 1 && part.startsWith("0")) throw new Error(`"${part}" has a leading zero`);
    value = (value * 256) + n;
  }
  return value >>> 0;
}

/** 3232235786 -> "192.168.1.10" */
export function formatIPv4(value) {
  const v = value >>> 0;
  return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
}

/** 24 -> 0xFFFFFF00 */
export function maskFromPrefix(prefix) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("Prefix must be 0 to 32");
  return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
}

/** 0xFFFFFF00 -> 24. Throws if the mask is not contiguous ones followed by zeros. */
export function prefixFromMask(mask) {
  const m = mask >>> 0;
  const inverted = (~m) >>> 0;
  if ((inverted & (inverted + 1)) !== 0) throw new Error(`${formatIPv4(m)} is not a valid subnet mask`);
  let prefix = 0;
  for (let bit = 31; bit >= 0 && ((m >>> bit) & 1); bit--) prefix++;
  return prefix;
}

/** Accepts "24", "/24" or "255.255.255.0" and returns the prefix length. */
export function parsePrefix(text) {
  const t = String(text).trim().replace(/^\//, "");
  if (/^\d{1,2}$/.test(t)) {
    const p = Number(t);
    if (p > 32) throw new Error("Prefix must be 0 to 32");
    return p;
  }
  return prefixFromMask(parseIPv4(t));
}

/** Parses "10.0.0.5/8", "10.0.0.5 255.0.0.0" or "10.0.0.5" (assumes /32). */
export function parseInput(text) {
  const t = String(text).trim();
  if (!t) throw new Error("Enter an IP address, e.g. 192.168.1.10/24");
  const m = t.match(/^([^\s/]+)\s*(?:\/\s*|\s+)?(\S+)?$/);
  if (!m) throw new Error("Use the form 192.168.1.10/24 or 192.168.1.10 255.255.255.0");
  const ip = parseIPv4(m[1]);
  const prefix = m[2] === undefined ? 32 : parsePrefix(m[2]);
  return { ip, prefix };
}

/** Classifies an address the way a network technician would describe it. */
export function addressType(ip) {
  const v = ip >>> 0;
  const inRange = (base, prefix) => ((v & maskFromPrefix(prefix)) >>> 0) === parseIPv4(base);
  if (inRange("127.0.0.0", 8)) return "Loopback";
  if (inRange("169.254.0.0", 16)) return "Link-local (APIPA: usually means DHCP failed)";
  if (inRange("10.0.0.0", 8) || inRange("172.16.0.0", 12) || inRange("192.168.0.0", 16)) return "Private (RFC 1918)";
  if (inRange("100.64.0.0", 10)) return "Carrier-grade NAT (RFC 6598)";
  if (inRange("224.0.0.0", 4)) return "Multicast";
  if (inRange("240.0.0.0", 4)) return "Reserved";
  if (inRange("0.0.0.0", 8)) return "\"This network\" (unusable)";
  if (inRange("192.0.2.0", 24) || inRange("198.51.100.0", 24) || inRange("203.0.113.0", 24)) return "Documentation (RFC 5737)";
  return "Public";
}

/** Historic classful network class (still asked about in exams). */
export function ipClass(ip) {
  const first = (ip >>> 24) & 255;
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D (multicast)";
  return "E (reserved)";
}

/** 8-bit groups, e.g. "11000000.10101000.00000001.00001010" */
export function toBinary(value) {
  return formatIPv4(value).split(".").map(o => Number(o).toString(2).padStart(8, "0")).join(".");
}

/** Everything about the subnet that ip/prefix belongs to. */
export function calculate(ip, prefix) {
  const mask = maskFromPrefix(prefix);
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = 2 ** (32 - prefix);

  let first, last, usable;
  if (prefix === 32) {            // single host route
    first = last = network; usable = 1;
  } else if (prefix === 31) {     // point-to-point link, RFC 3021: both addresses usable
    first = network; last = broadcast; usable = 2;
  } else {
    first = network + 1; last = broadcast - 1; usable = total - 2;
  }

  return {
    ip: formatIPv4(ip),
    prefix,
    cidr: `${formatIPv4(network)}/${prefix}`,
    mask: formatIPv4(mask),
    wildcard: formatIPv4(wildcard),
    network: formatIPv4(network),
    broadcast: prefix >= 31 ? "n/a" : formatIPv4(broadcast),
    firstHost: formatIPv4(first),
    lastHost: formatIPv4(last),
    totalAddresses: total,
    usableHosts: usable,
    ipClass: ipClass(ip),
    type: addressType(ip),
    binaryIp: toBinary(ip),
    binaryMask: toBinary(mask),
  };
}

/**
 * Splits a network into at least `count` equal subnets.
 * E.g. 192.168.1.0/24 into 4 -> four /26 networks.
 */
export function split(ip, prefix, count) {
  if (!Number.isInteger(count) || count < 2) throw new Error("Split into at least 2 subnets");
  const extraBits = Math.ceil(Math.log2(count));
  const newPrefix = prefix + extraBits;
  if (newPrefix > 32) throw new Error(`A /${prefix} cannot be split into ${count} subnets`);
  const n = 2 ** extraBits;
  if (n > 1024) throw new Error("That would create more than 1024 subnets; pick a smaller number");
  const network = (ip & maskFromPrefix(prefix)) >>> 0;
  const size = 2 ** (32 - newPrefix);
  const subnets = [];
  for (let i = 0; i < n; i++) {
    subnets.push(calculate((network + i * size) >>> 0, newPrefix));
  }
  return { newPrefix, subnets };
}

/** Smallest prefix that fits `hosts` usable hosts, e.g. 50 hosts -> /26 (62 usable). */
export function prefixForHosts(hosts) {
  if (!Number.isInteger(hosts) || hosts < 1) throw new Error("Enter a number of hosts of at least 1");
  if (hosts === 1) return 32;
  if (hosts === 2) return 31;
  for (let p = 30; p >= 0; p--) {
    if (2 ** (32 - p) - 2 >= hosts) return p;
  }
  throw new Error("Too many hosts for IPv4");
}
