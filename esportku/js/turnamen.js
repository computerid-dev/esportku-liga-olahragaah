import { roundName, unpack } from "./bracket.js";
import { db, F, $, esc, head, card, klas, bracketHtml, STATUS } from "./fb.js";
head();
const id = new URLSearchParams(location.search).get("id");
const ref = id && F.doc(db, "tournaments", id);
const snap = ref && await F.getDoc(ref).catch(() => null);
if (!snap || !snap.exists()) $("#detail").innerHTML = '<p class="empty">Turnamen tidak ditemukan.</p>';
else {
  const t = snap.data(), set = t.scoring === "set" ? (t.bestOf || 3) : 0, fmt = t.format, hasK = fmt !== "roundrobin", hasT = fmt !== "single" && fmt !== "double";
  document.title = t.name + " - ESPORTKU";
  const ts = (await F.getDocs(F.collection(ref, "teams"))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.grp || "").localeCompare(b.grp || "") || a.name.localeCompare(b.name));
  const L = Object.fromEntries(ts.map(x => [x.id, x.logo || ""]));
  const tabs = [["jadwal", "Jadwal & Hasil"], ...(hasT ? [["klasemen", "Klasemen"]] : []), ...(hasK ? [["bracket", "Bracket"]] : []), ["tim", "Tim"]];
  $("#detail").innerHTML = `<h1>${esc(t.name)}</h1><div class="sub">${esc(t.sportName)}</div><p class="lead">${esc(t.location || "")} &middot; ${esc(t.date || "")} &middot; ${STATUS[t.status] || ""}</p><button class="btn sm" id="pr" type="button">Cetak PDF polos</button> <button class="btn sm" id="prl" type="button">Cetak PDF + logo</button><div class="tabs" id="tabs">${tabs.map((x, i) => `<button data-t="${x[0]}" class="${i ? "" : "on"}">${x[1]}</button>`).join("")}</div><div id="body"></div><div id="print"></div>`;
  const doPrint = m => { document.body.dataset.pm = m; window.print(); };
  $("#pr").onclick = () => doPrint("plain");
  $("#prl").onclick = () => doPrint("logo");
  let ms = [], tab = "jadwal";
  const list = a => a.length ? `<div class="list">${a.map(m => card(m, set, L)).join("")}</div>` : '<p class="empty">Belum ada jadwal.</p>';
  const so = m => ({ grup: 0, gugur: 1, lower: 2, final: 3 }[m.stage] ?? 1);
  let printed = false;
  // Laporan rapi untuk dicetak / disimpan sebagai PDF (semua format)
  const report = () => {
    const vis = ms.filter(m => !m.bye).sort((a, b) => so(a) - so(b) || a.round - b.round || a.idx - b.idx);
    const lastR = Math.max(1, ...vis.filter(m => !["grup", "lower", "final"].includes(m.stage)).map(m => m.round));
    const lab = m => m.grp ? "Grup " + m.grp : m.stage === "final" ? "Grand Final" : m.stage === "lower" ? "Lower R" + m.round : fmt === "double" ? "Upper R" + m.round : fmt === "roundrobin" ? "Liga" : roundName(m.round, lastR);
    const fin = fmt === "double" ? ms.find(m => m.stage === "final") : hasK ? vis.filter(m => m.stage !== "grup").sort((a, b) => b.round - a.round)[0] : null;
    const champ = fin?.done ? (fin.sa > fin.sb ? fin.na : fin.nb) : "";
    const dt = t.date ? new Date(t.date + "T00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
    const row = (m, side) => {
      const id = side ? m.b : m.a, win = m.done && (side ? m.sb > m.sa : m.sa > m.sb);
      const cells = set ? Array.from({ length: set }, (_, j) => `<td>${m.sets[j] ? m.sets[j][side] : "-"}</td>`).join("") : "";
      return `<tr class="${win ? "pw" : ""}"><td class="tn">${L[id] ? `<img class="lg" src="${esc(L[id])}" alt="">` : ""}${esc((side ? m.nb : m.na) || "TBD")}</td>${cells}<td class="sc">${m.done ? (side ? m.sb : m.sa) : set ? 0 : "-"}</td></tr>`;
    };
    const head = `<tr><th class="tn">Tim</th>${set ? Array.from({ length: set }, (_, j) => `<th>Set ${j + 1}</th>`).join("") : ""}<th>${set ? "Menang Set" : "Skor"}</th></tr>`;
    const blocks = vis.map((m, i) => `<div class="pm"><div class="ph"><span>Pertandingan ${i + 1} &middot; ${lab(m)}</span><span class="st ${m.done ? "ok" : ""}">${m.done ? "Selesai" : "Belum Dimulai"}</span></div><table>${head}${row(m, 0)}${row(m, 1)}</table>${m.when ? `<div class="pj">${esc(m.when)}</div>` : ""}</div>`).join("");
    return `<h1>Jadwal &amp; Hasil Pertandingan</h1><div class="sub">${esc(t.name)}</div><table class="info"><tr><td>Tanggal</td><td>: ${dt}</td><td>Peserta</td><td>: ${ts.length} Tim</td></tr><tr><td>Lokasi</td><td>: ${esc(t.location || "-")}</td><td>Cabang</td><td>: ${esc(t.sportName)}${set ? " &middot; Best of " + set : ""}</td></tr></table>${champ ? `<p><b>Juara: ${esc(champ)}</b></p>` : ""}${hasT ? `<h2>Klasemen</h2>${klas(ts, ms.filter(m => m.stage === "grup" || fmt === "roundrobin"))}` : ""}<h2>Pertandingan</h2>${blocks || "<p>Belum ada pertandingan.</p>"}<p class="foot">Dicetak dari ESPORTKU pada ${new Date().toLocaleString("id-ID")}</p>`;
  };
  const draw = () => {
    const vis = ms.filter(m => !m.bye), ko = hasK ? vis.filter(m => m.stage !== "grup") : [], gr = vis.filter(m => !hasK || m.stage === "grup");
    let h = "";
    if (tab === "jadwal") h = fmt === "group" ? `<h2>Fase grup</h2>${list(gr)}<h2>Babak gugur</h2>${list(ko)}` : list(vis);
    if (tab === "bracket") h = bracketHtml(ms, fmt, set, L);
    if (tab === "klasemen") h = klas(ts, ms.filter(m => m.stage === "grup" || fmt === "roundrobin"));
    if (tab === "tim") h = `<div class="grid">${ts.map(x => `<div class="panel">${x.logo ? `<img class="lg" src="${esc(x.logo)}" alt="">` : ""}${esc(x.name)}${x.grp ? ` <span class="badge">Grup ${x.grp}</span>` : ""}</div>`).join("")}</div>`;
    $("#body").innerHTML = h;
    $("#print").innerHTML = report();
    if (!printed && new URLSearchParams(location.search).get("print") && ms.length) { printed = true; document.body.dataset.pm = new URLSearchParams(location.search).get("print") === "logo" ? "logo" : "plain"; setTimeout(() => window.print(), 500); }
  };
  $("#tabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; tab = b.dataset.t; document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b)); draw(); };
  F.onSnapshot(F.collection(ref, "matches"), s => { ms = s.docs.map(d => unpack(d.data())).sort((a, b) => a.round - b.round || a.idx - b.idx); draw(); });
}
