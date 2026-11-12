// Test cases shared by the browser test page (tests.html) and Node (tests/run.mjs).
import {
  parseIPv4, formatIPv4, maskFromPrefix, prefixFromMask, parsePrefix, parseInput,
  calculate, split, prefixForHosts, addressType, toBinary,
} from "../subnet.js";

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}
function throws(fn, what) {
  try { fn(); } catch { return; }
  throw new Error(`${what}: expected an error`);
}

export const cases = [
  ["parses and formats IPv4 addresses", () => {
    eq(parseIPv4("192.168.1.10"), 3232235786, "192.168.1.10");
    eq(parseIPv4("255.255.255.255"), 4294967295, "max");
    eq(formatIPv4(3232235786), "192.168.1.10", "format");
    eq(formatIPv4(0), "0.0.0.0", "zero");
  }],
  ["rejects invalid addresses", () => {
    throws(() => parseIPv4("256.1.1.1"), "256");
    throws(() => parseIPv4("1.2.3"), "3 parts");
    throws(() => parseIPv4("1.2.3.4.5"), "5 parts");
    throws(() => parseIPv4("a.b.c.d"), "letters");
    throws(() => parseIPv4("01.2.3.4"), "leading zero");
    throws(() => parseIPv4("1..3.4"), "empty part");
  }],
  ["converts between masks and prefixes", () => {
    eq(formatIPv4(maskFromPrefix(24)), "255.255.255.0", "/24");
    eq(formatIPv4(maskFromPrefix(0)), "0.0.0.0", "/0");
    eq(formatIPv4(maskFromPrefix(32)), "255.255.255.255", "/32");
    eq(formatIPv4(maskFromPrefix(20)), "255.255.240.0", "/20");
    eq(prefixFromMask(parseIPv4("255.255.255.192")), 26, "255.255.255.192");
    throws(() => prefixFromMask(parseIPv4("255.0.255.0")), "non-contiguous mask");
  }],
  ["accepts prefix in several formats", () => {
    eq(parsePrefix("24"), 24, "24");
    eq(parsePrefix("/26"), 26, "/26");
    eq(parsePrefix("255.255.240.0"), 20, "mask");
    throws(() => parsePrefix("33"), "33");
  }],
  ["parses the input box", () => {
    eq(parseInput("10.0.0.5/8"), { ip: parseIPv4("10.0.0.5"), prefix: 8 }, "cidr");
    eq(parseInput("10.0.0.5 255.0.0.0"), { ip: parseIPv4("10.0.0.5"), prefix: 8 }, "mask");
    eq(parseInput(" 10.0.0.5 / 8 "), { ip: parseIPv4("10.0.0.5"), prefix: 8 }, "spaces");
    eq(parseInput("10.0.0.5").prefix, 32, "no prefix means /32");
    throws(() => parseInput(""), "empty");
  }],
  ["calculates a /26", () => {
    const r = calculate(parseIPv4("192.168.10.37"), 26);
    eq(r.network, "192.168.10.0", "network");
    eq(r.broadcast, "192.168.10.63", "broadcast");
    eq(r.firstHost, "192.168.10.1", "first");
    eq(r.lastHost, "192.168.10.62", "last");
    eq(r.usableHosts, 62, "usable");
    eq(r.mask, "255.255.255.192", "mask");
    eq(r.wildcard, "0.0.0.63", "wildcard");
    eq(r.ipClass, "C", "class");
  }],
  ["calculates a /20 across octets", () => {
    const r = calculate(parseIPv4("10.20.30.40"), 20);
    eq(r.network, "10.20.16.0", "network");
    eq(r.broadcast, "10.20.31.255", "broadcast");
    eq(r.usableHosts, 4094, "usable");
  }],
  ["handles /30, /31 and /32 edge cases", () => {
    const r30 = calculate(parseIPv4("172.16.5.1"), 30);
    eq([r30.firstHost, r30.lastHost, r30.usableHosts], ["172.16.5.1", "172.16.5.2", 2], "/30");
    const r31 = calculate(parseIPv4("10.0.0.0"), 31);
    eq([r31.firstHost, r31.lastHost, r31.usableHosts, r31.broadcast], ["10.0.0.0", "10.0.0.1", 2, "n/a"], "/31");
    const r32 = calculate(parseIPv4("8.8.8.8"), 32);
    eq([r32.firstHost, r32.usableHosts], ["8.8.8.8", 1], "/32");
  }],
  ["handles /0 without overflow", () => {
    const r = calculate(parseIPv4("1.2.3.4"), 0);
    eq([r.network, r.broadcast, r.totalAddresses], ["0.0.0.0", "255.255.255.255", 4294967296], "/0");
  }],
  ["classifies address types", () => {
    eq(addressType(parseIPv4("192.168.1.1")), "Private (RFC 1918)", "192.168");
    eq(addressType(parseIPv4("172.31.255.1")), "Private (RFC 1918)", "172.31");
    eq(addressType(parseIPv4("172.32.0.1")), "Public", "172.32 is public");
    eq(addressType(parseIPv4("169.254.3.4")).startsWith("Link-local"), true, "APIPA");
    eq(addressType(parseIPv4("127.0.0.1")), "Loopback", "loopback");
    eq(addressType(parseIPv4("8.8.8.8")), "Public", "public");
    eq(addressType(parseIPv4("100.64.1.1")), "Carrier-grade NAT (RFC 6598)", "CGNAT");
  }],
  ["shows binary", () => {
    eq(toBinary(parseIPv4("192.168.1.10")), "11000000.10101000.00000001.00001010", "binary");
  }],
  ["splits a /24 into 4 subnets", () => {
    const { newPrefix, subnets } = split(parseIPv4("192.168.1.0"), 24, 4);
    eq(newPrefix, 26, "prefix");
    eq(subnets.map(s => s.cidr), ["192.168.1.0/26", "192.168.1.64/26", "192.168.1.128/26", "192.168.1.192/26"], "subnets");
  }],
  ["rounds split count up to a power of two", () => {
    const { newPrefix, subnets } = split(parseIPv4("10.0.0.0"), 8, 5);
    eq([newPrefix, subnets.length], [11, 8], "5 -> 8 subnets");
    throws(() => split(parseIPv4("10.0.0.0"), 31, 4), "cannot split /31 into 4");
  }],
  ["finds the right prefix for a host count", () => {
    eq(prefixForHosts(50), 26, "50 hosts");
    eq(prefixForHosts(62), 26, "62 hosts");
    eq(prefixForHosts(63), 25, "63 hosts");
    eq(prefixForHosts(2), 31, "2 hosts");
    eq(prefixForHosts(254), 24, "254 hosts");
  }],
];
