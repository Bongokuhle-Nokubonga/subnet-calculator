import { parseInput, calculate, split, prefixForHosts } from "./subnet.js";

const $ = (id) => document.getElementById(id);
let current = null; // { ip, prefix } of the last good calculation

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function row(label, value, mono = true) {
  return `<tr><th scope="row">${label}</th><td${mono ? ' class="mono"' : ""}>${esc(value)}</td></tr>`;
}

/** Colours the network bits and host bits differently. */
function binaryView(bin, prefix) {
  let bitsSeen = 0;
  let out = "";
  for (const ch of bin) {
    if (ch === ".") { out += "."; continue; }
    out += `<span class="${bitsSeen < prefix ? "net" : "host"}">${ch}</span>`;
    bitsSeen++;
  }
  return out;
}

function showResult(text) {
  try {
    const { ip, prefix } = parseInput(text);
    const r = calculate(ip, prefix);
    current = { ip, prefix };
    $("error").textContent = "";
    $("address").removeAttribute("aria-invalid");
    $("results").innerHTML = `
      <h2>${esc(r.cidr)}</h2>
      <table>
        ${row("IP address", r.ip)}
        ${row("Network address", r.network)}
        ${row("Broadcast address", r.broadcast)}
        ${row("Usable host range", r.usableHosts === 1 ? r.firstHost : `${r.firstHost} – ${r.lastHost}`)}
        ${row("Usable hosts", r.usableHosts.toLocaleString("en-ZA"))}
        ${row("Total addresses", r.totalAddresses.toLocaleString("en-ZA"))}
        ${row("Subnet mask", `${r.mask}  (/${r.prefix})`)}
        ${row("Wildcard mask", r.wildcard)}
        ${row("Address type", r.type, false)}
        ${row("Class", r.ipClass, false)}
      </table>
      <h3>Binary</h3>
      <p class="legend"><span class="net">■</span> network bits <span class="host">■</span> host bits</p>
      <pre class="binary mono">IP   ${binaryView(r.binaryIp, r.prefix)}
Mask ${binaryView(r.binaryMask, r.prefix)}</pre>
      ${r.prefix === 31 ? '<p class="note">/31 is a point-to-point link (RFC 3021): both addresses are usable and there is no broadcast.</p>' : ""}`;
    try { history.replaceState(null, "", "#" + encodeURIComponent(text.trim())); } catch { /* ignore */ }
  } catch (e) {
    current = null;
    $("error").textContent = e.message;
    $("address").setAttribute("aria-invalid", "true");
    $("results").innerHTML = "";
  }
  $("split-results").hidden = true;
}

$("calc").addEventListener("submit", (e) => { e.preventDefault(); showResult($("address").value); });

document.querySelectorAll("[data-example]").forEach(b =>
  b.addEventListener("click", () => { $("address").value = b.dataset.example; showResult(b.dataset.example); }));

$("split").addEventListener("submit", (e) => {
  e.preventDefault();
  $("split-error").textContent = "";
  if (!current) { $("split-error").textContent = "Calculate a network first."; return; }
  try {
    const { newPrefix, subnets } = split(current.ip, current.prefix, Number($("count").value));
    const rows = subnets.map((s, i) =>
      `<tr><td>${i + 1}</td><td class="mono">${esc(s.cidr)}</td><td class="mono">${esc(s.firstHost)} – ${esc(s.lastHost)}</td><td class="mono">${esc(s.broadcast)}</td><td>${s.usableHosts.toLocaleString("en-ZA")}</td></tr>`).join("");
    const out = $("split-results");
    out.innerHTML = `<h2>${subnets.length} × /${newPrefix} subnets</h2>
      <div class="scroll"><table class="wide">
        <thead><tr><th>#</th><th>Network</th><th>Host range</th><th>Broadcast</th><th>Hosts</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    out.hidden = false;
  } catch (err) {
    $("split-error").textContent = err.message;
  }
});

$("hosts").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    const hosts = Number($("host-count").value);
    const p = prefixForHosts(hosts);
    const usable = p === 32 ? 1 : p === 31 ? 2 : 2 ** (32 - p) - 2;
    $("hosts-result").textContent =
      `Use a /${p} (${calculate(0, p).mask}): ${usable.toLocaleString("en-ZA")} usable hosts.`;
  } catch (err) {
    $("hosts-result").textContent = err.message;
  }
});

// Start from the address in the link (shareable), or the default value.
let initial = $("address").value;
try { if (location.hash.length > 1) initial = decodeURIComponent(location.hash.slice(1)); } catch { /* ignore */ }
$("address").value = initial;
showResult(initial);
