const findBtn = document.getElementById("find-bridge");
const resetBtn = document.getElementById("reset-demo");
const againBtn = document.getElementById("again");
const copyBtn = document.getElementById("copy-prompts");
const copyStatus = document.getElementById("copy-status");
const statusEl = document.getElementById("status");
const hero = document.getElementById("hero");
const result = document.getElementById("result");
const dietsEl = document.getElementById("diets");
const bridgesEl = document.getElementById("bridges");
const samplesEl = document.getElementById("samples");
const resultTitle = document.getElementById("result-title");
const resultSub = document.getElementById("result-sub");
const provenance = document.getElementById("provenance");
const agenda = document.getElementById("agenda");
const agendaList = document.getElementById("agenda-list");
const signalRow = document.getElementById("signal-row");
const vennEl = document.getElementById("venn");
const openDeckBtn = document.getElementById("open-deck");
const closeDeckBtn = document.getElementById("close-deck");
const deckEl = document.getElementById("deck");
const deckProgress = document.getElementById("deck-progress");
const deckType = document.getElementById("deck-type");
const deckName = document.getElementById("deck-name");
const deckWhy = document.getElementById("deck-why");
const deckPrompt = document.getElementById("deck-prompt");
const deckGame = document.getElementById("deck-game");
const deckBars = document.getElementById("deck-bars");
const deckLock = document.getElementById("deck-lock");
const deckPrev = document.getElementById("deck-prev");
const deckNext = document.getElementById("deck-next");

let lastBridgeData = null;
let deckIndex = 0;
let deckVotes = {};

function pickAgenda(headline) {
  const want = [
    { match: "artist", verb: "Put on" },
    { match: "movie", verb: "Queue" },
    { match: "destination", verb: "Daydream" },
    { match: "brand", verb: "Share" },
  ];
  const used = new Set();
  const picks = [];
  for (const w of want) {
    const hit = headline.find(
      (h) => (h.type || "").includes(w.match) && !used.has(h.name)
    );
    if (hit) {
      used.add(hit.name);
      picks.push({ ...hit, verb: w.verb });
    }
    if (picks.length >= 3) break;
  }
  if (picks.length < 3) {
    for (const h of headline) {
      if (used.has(h.name)) continue;
      picks.push({ ...h, verb: "Talk about" });
      if (picks.length >= 3) break;
    }
  }
  return picks;
}

let sectionMeta = [];
let state = {
  left: { label: "Blue table", sections: {} },
  right: { label: "Red table", sections: {} },
};

function pct(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function typeLabel(type) {
  if (!type) return "entity";
  return type.split(":").pop().replaceAll("_", " ");
}

function setStatus(text, stateName = "") {
  statusEl.textContent = text;
  statusEl.dataset.state = stateName;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cloneDemo(demo) {
  state = {
    left: {
      label: demo.left.label,
      sections: Object.fromEntries(
        Object.entries(demo.left.sections).map(([k, v]) => [k, [...v]])
      ),
    },
    right: {
      label: demo.right.label,
      sections: Object.fromEntries(
        Object.entries(demo.right.sections).map(([k, v]) => [k, [...v]])
      ),
    },
  };
}

function sidePayload(sideKey) {
  const side = state[sideKey];
  return {
    label: side.label,
    sections: Object.fromEntries(
      sectionMeta.map((s) => [s.key, [...(side.sections[s.key] || [])]])
    ),
  };
}

function renderDiets() {
  dietsEl.innerHTML = "";

  ["left", "right"].forEach((sideKey, idx) => {
    if (idx === 1) {
      const versus = document.createElement("div");
      versus.className = "versus";
      versus.setAttribute("aria-hidden", "true");
      versus.textContent = "×";
      dietsEl.appendChild(versus);
    }

    const side = state[sideKey];
    const article = document.createElement("article");
    article.className = `diet diet-${sideKey === "left" ? "blue" : "red"}`;
    article.dataset.side = sideKey;

    const title = document.createElement("input");
    title.className = "diet-title-input";
    title.value = side.label;
    title.ariaLabel = `${sideKey} table name`;
    title.addEventListener("input", () => {
      state[sideKey].label = title.value.slice(0, 80);
    });
    article.appendChild(title);

    sectionMeta.forEach((spec) => {
      const block = document.createElement("div");
      block.className = "section-block";

      const head = document.createElement("div");
      head.className = "section-head";
      head.innerHTML = `<span>${escapeHtml(spec.label)}</span>`;
      block.appendChild(head);

      const chips = document.createElement("div");
      chips.className = "chips";
      const items = side.sections[spec.key] || [];
      items.forEach((name, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `<span>${escapeHtml(name)}</span>`;
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "chip-x";
        rm.setAttribute("aria-label", `Remove ${name}`);
        rm.textContent = "×";
        rm.addEventListener("click", () => {
          state[sideKey].sections[spec.key].splice(i, 1);
          renderDiets();
        });
        chip.appendChild(rm);
        chips.appendChild(chip);
      });
      block.appendChild(chips);

      const addRow = document.createElement("div");
      addRow.className = "add-row";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = spec.placeholder || "Add…";
      input.className = "add-input";
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "add-btn";
      addBtn.textContent = "+";
      addBtn.setAttribute("aria-label", `Add ${spec.label}`);

      const commit = () => {
        const val = input.value.trim();
        if (!val) return;
        if (!state[sideKey].sections[spec.key]) state[sideKey].sections[spec.key] = [];
        if (state[sideKey].sections[spec.key].length >= 8) {
          setStatus("Max 8 items per section", "error");
          return;
        }
        state[sideKey].sections[spec.key].push(val);
        input.value = "";
        renderDiets();
      };

      addBtn.addEventListener("click", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      });

      addRow.appendChild(input);
      addRow.appendChild(addBtn);
      block.appendChild(addRow);
      article.appendChild(block);
    });

    dietsEl.appendChild(article);
  });
}

function renderBridge(data) {
  lastBridgeData = data;
  const top = data.headline?.[0];
  resultTitle.textContent = top
    ? `Start with ${top.name}`
    : "Shared taste across the split";

  resultSub.textContent = `${data.left.label} × ${data.right.label} · ${data.headline.length} bridges across music, film, food, and travel`;

  const agendaPicks = pickAgenda(data.headline || []);
  if (agendaPicks.length) {
    agenda.hidden = false;
    agendaList.innerHTML = agendaPicks
      .map(
        (p) =>
          `<li><strong>${escapeHtml(p.verb)} ${escapeHtml(p.name)}</strong> <span>· ${escapeHtml(typeLabel(p.type))} · ${escapeHtml(p.prompt || "")}</span></li>`
      )
      .join("");
  } else {
    agenda.hidden = true;
    agendaList.innerHTML = "";
  }

  const leftSignals = (data.left.signals || []).map((s) => s.name || s).filter(Boolean);
  const rightSignals = (data.right.signals || []).map((s) => s.name || s).filter(Boolean);
  signalRow.innerHTML = `
    <span class="signal-pill"><strong>${escapeHtml(data.left.label)}</strong> · ${escapeHtml(leftSignals.join(" · ") || "—")}</span>
    <span class="signal-pill"><strong>${escapeHtml(data.right.label)}</strong> · ${escapeHtml(rightSignals.join(" · ") || "—")}</span>
  `;

  const venn = data.venn;
  if (venn && (venn.shared?.length || venn.left_only?.length || venn.right_only?.length)) {
    vennEl.hidden = false;
    document.getElementById("venn-left-title").textContent = `${data.left.label} only`;
    document.getElementById("venn-right-title").textContent = `${data.right.label} only`;
    document.getElementById("venn-left").innerHTML = (venn.left_only || [])
      .map((n) => `<li>${escapeHtml(n)}</li>`)
      .join("");
    document.getElementById("venn-shared").innerHTML = (venn.shared || [])
      .map((n) => `<li>${escapeHtml(n)}</li>`)
      .join("");
    document.getElementById("venn-right").innerHTML = (venn.right_only || [])
      .map((n) => `<li>${escapeHtml(n)}</li>`)
      .join("");
    document.getElementById("venn-note").textContent = venn.note || "";
  } else {
    vennEl.hidden = true;
  }

  bridgesEl.innerHTML = "";
  data.headline.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "bridge";
    li.innerHTML = `
      <div class="rank">${String(i + 1).padStart(2, "0")}</div>
      <div class="bridge-body">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="meta-line">${escapeHtml(typeLabel(item.type))} · bridge ${pct(item.bridge_score)}</p>
        <p class="why">${escapeHtml(item.why || "")}</p>
        <p class="prompt"><span class="prompt-label">Try asking</span> ${escapeHtml(item.prompt || "")}</p>
        <p class="game"><span class="game-label">Table game</span> ${escapeHtml(item.game || "")}</p>
        <div class="bars">
          <div class="bar-row">
            <span>Left</span>
            <div class="bar-track"><div class="bar-fill blue" data-w="${item.affinity_left ?? 0}"></div></div>
            <span>${pct(item.affinity_left)}</span>
          </div>
          <div class="bar-row">
            <span>Right</span>
            <div class="bar-track"><div class="bar-fill red" data-w="${item.affinity_right ?? 0}"></div></div>
            <span>${pct(item.affinity_right)}</span>
          </div>
        </div>
      </div>
    `;
    bridgesEl.appendChild(li);
  });

  deckIndex = 0;
  deckVotes = {};

  const bucketBits = Object.values(data.buckets || {})
    .filter((b) => (b.left_sample || []).length || (b.right_sample || []).length)
    .slice(0, 4);

  samplesEl.innerHTML = bucketBits
    .map(
      (b) => `
      <div class="sample">
        <h4>${escapeHtml(b.label)}</h4>
        <p class="sample-side">${escapeHtml(data.left.label)}</p>
        <ul>${(b.left_sample || []).map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        <p class="sample-side">${escapeHtml(data.right.label)}</p>
        <ul>${(b.right_sample || []).map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
      </div>`
    )
    .join("");

  let note = data.meta.evidence;
  const unresolved = [
    ...(data.left.unresolved || []).map((u) => `${u.name} (${data.left.label})`),
    ...(data.right.unresolved || []).map((u) => `${u.name} (${data.right.label})`),
  ];
  if (unresolved.length) {
    note += ` Unresolved signals skipped: ${unresolved.join(", ")}.`;
  }
  provenance.textContent = `${note} Generated in ${data.meta.duration_ms}ms.`;
  copyStatus.hidden = true;

  hero.hidden = true;
  result.hidden = false;

  requestAnimationFrame(() => {
    document.querySelectorAll(".bar-fill").forEach((el) => {
      const w = Number(el.dataset.w || 0);
      el.style.width = `${Math.max(4, Math.min(100, w * 100))}%`;
    });
  });
}

async function findBridge() {
  findBtn.disabled = true;
  const started = Date.now();
  const tick = setInterval(() => {
    const s = Math.round((Date.now() - started) / 1000);
    setStatus(`Still working with Qloo… ${s}s (slow + steady to avoid rate limits)`);
  }, 1000);
  setStatus("Calling Qloo one request at a time (avoids rate limits)…");

  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        left: sidePayload("left"),
        right: sidePayload("right"),
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    if (!data.headline?.length) {
      const sample =
        data.buckets?.artists?.left_sample?.slice(0, 3)?.join(", ") ||
        "no artist samples";
      setStatus(
        `No shared bridges this run (${data.meta?.strategy || "unknown strategy"}). Artist sample: ${sample}. Try Reset demo.`,
        "error"
      );
      return;
    }
    setStatus(`Bridge ready in ${Math.round((Date.now() - started) / 1000)}s`);
    renderBridge(data);
  } catch (err) {
    console.error(err);
    const msg =
      err.name === "AbortError"
        ? "Timed out after 120s — wait a minute for rate limits to cool, restart server, try again."
        : err.message || "Bridge failed";
    setStatus(msg, "error");
  } finally {
    clearInterval(tick);
    clearTimeout(kill);
    findBtn.disabled = false;
  }
}

async function boot() {
  const res = await fetch("/api/demo");
  const data = await res.json();
  sectionMeta = data.sections || [];
  cloneDemo(data.demo);
  renderDiets();
}

findBtn.addEventListener("click", findBridge);
copyBtn.addEventListener("click", async () => {
  if (!lastBridgeData?.headline?.length) return;
  const lines = [
    `Truce bridge · ${lastBridgeData.left.label} × ${lastBridgeData.right.label}`,
    "",
    "Tonight's agenda:",
    ...pickAgenda(lastBridgeData.headline).map(
      (p, i) => `${i + 1}. ${p.verb} ${p.name} — ${p.prompt}`
    ),
    "",
    "All prompts + games:",
    ...lastBridgeData.headline.map(
      (h, i) => `${i + 1}. ${h.name}\n   Ask: ${h.prompt}\n   Game: ${h.game || ""}`
    ),
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    copyStatus.hidden = false;
    copyStatus.textContent = "Copied agenda + prompts to clipboard.";
  } catch {
    copyStatus.hidden = false;
    copyStatus.textContent = "Couldn’t copy — select the prompts manually.";
  }
});
resetBtn.addEventListener("click", async () => {
  const res = await fetch("/api/demo");
  const data = await res.json();
  cloneDemo(data.demo);
  renderDiets();
  setStatus("Demo tastes restored");
});
function goHome() {
  closeDeck();
  result.hidden = true;
  hero.hidden = false;
  setStatus("Edit either table, then find the bridge again");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDeckCard() {
  const list = lastBridgeData?.headline || [];
  if (!list.length) return;
  const item = list[deckIndex];
  const votes = deckVotes[item.name] || {};
  deckProgress.textContent = `${deckIndex + 1} / ${list.length}`;
  deckType.textContent = `${typeLabel(item.type)} · bridge ${pct(item.bridge_score)}`;
  deckName.textContent = item.name;
  deckWhy.textContent = item.why || "";
  deckPrompt.innerHTML = `<span class="prompt-label">Try asking</span> ${escapeHtml(item.prompt || "")}`;
  deckGame.innerHTML = `<span class="game-label">Table game</span> ${escapeHtml(item.game || "")}`;
  deckBars.innerHTML = `
    <div class="bar-row">
      <span>Left</span>
      <div class="bar-track"><div class="bar-fill blue" data-w="${item.affinity_left ?? 0}"></div></div>
      <span>${pct(item.affinity_left)}</span>
    </div>
    <div class="bar-row">
      <span>Right</span>
      <div class="bar-track"><div class="bar-fill red" data-w="${item.affinity_right ?? 0}"></div></div>
      <span>${pct(item.affinity_right)}</span>
    </div>
  `;
  requestAnimationFrame(() => {
    deckBars.querySelectorAll(".bar-fill").forEach((el) => {
      el.style.width = `${Math.max(4, Math.min(100, Number(el.dataset.w || 0) * 100))}%`;
    });
  });

  document.querySelectorAll("#deck-votes .vote").forEach((btn) => {
    const side = btn.dataset.side;
    const vote = btn.dataset.vote;
    btn.classList.toggle("is-on", votes[side] === vote);
  });

  if (votes.left === "love" && votes.right === "love") {
    deckLock.hidden = false;
    deckLock.textContent = `Common ground locked: ${item.name}`;
    deckLock.classList.add("pop");
  } else {
    deckLock.hidden = true;
    deckLock.classList.remove("pop");
  }

  deckPrev.disabled = deckIndex <= 0;
  deckNext.textContent = deckIndex >= list.length - 1 ? "Done" : "Next";
}

function openDeck() {
  if (!lastBridgeData?.headline?.length) return;
  deckEl.hidden = false;
  document.body.classList.add("deck-open");
  renderDeckCard();
}

function closeDeck() {
  deckEl.hidden = true;
  document.body.classList.remove("deck-open");
}

againBtn.addEventListener("click", goHome);
document.getElementById("brand-home").addEventListener("click", goHome);
openDeckBtn.addEventListener("click", openDeck);
closeDeckBtn.addEventListener("click", closeDeck);
deckPrev.addEventListener("click", () => {
  if (deckIndex > 0) {
    deckIndex -= 1;
    renderDeckCard();
  }
});
deckNext.addEventListener("click", () => {
  const list = lastBridgeData?.headline || [];
  if (deckIndex >= list.length - 1) {
    closeDeck();
    return;
  }
  deckIndex += 1;
  renderDeckCard();
});
document.getElementById("deck-votes").addEventListener("click", (e) => {
  const btn = e.target.closest(".vote");
  if (!btn || !lastBridgeData?.headline?.length) return;
  const item = lastBridgeData.headline[deckIndex];
  if (!deckVotes[item.name]) deckVotes[item.name] = {};
  deckVotes[item.name][btn.dataset.side] = btn.dataset.vote;
  renderDeckCard();
});

boot().catch((err) => {
  console.error(err);
  setStatus("Failed to load demo config", "error");
});
