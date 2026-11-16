// The hosted page for one model: the renderer's HTML, the counts visitors may see,
// and a few lines of plain script for responding. No framework runs on this page.

import "server-only";
import { LINK_SCRIPT, PAGE_CSS, THEME_CSS, escapeXml, modelHtml, piecesOf, type HunchModel } from "@hunch/model";
import type { CountRow, ResponseKind } from "./rows";

export type Counts = Record<string, Partial<Record<ResponseKind, number>>>;

export function countsByPiece(rows: CountRow[]): Counts {
    const out: Counts = {};
    for (const row of rows) {
        const key = row.piece_id ?? "";
        out[key] = { ...out[key], [row.kind]: row.n };
    }
    return out;
}

const RESPOND_CSS = `
.hm-intro{margin:-20px 0 32px;font-size:14px;color:var(--hm-muted)}
.hm-legend li[data-id],.hm-person h3{cursor:pointer}
.hm-legend li[data-id]:hover>span:last-child{color:var(--hm-strong)}
.hm-mark{cursor:pointer}
.hm-count{display:block;margin-top:2px;font:500 12px/1.4 ui-sans-serif,system-ui,sans-serif;font-style:normal;color:var(--hm-muted)}
.hm-count:empty{display:none}
.hm-count b{font-weight:600;color:var(--hm-text)}
.hm-mine{color:var(--hm-ask)}
.hm-overall{margin:56px 0 0;padding:24px;background:var(--hm-card);box-shadow:0 0 0 1px var(--hm-rule);display:grid;gap:12px}
.hm-overall h2{margin:0;color:var(--hm-strong);font-size:17px;font-weight:600}
.hm-overall p{margin:0}
.hm-button{appearance:none;border:0;border-radius:999px;padding:9px 16px;font:500 14px/1.2 ui-sans-serif,system-ui,sans-serif;background:var(--hm-strong);color:var(--hm-page);cursor:pointer;justify-self:start}
.hm-button[data-quiet]{background:transparent;color:var(--hm-text);box-shadow:inset 0 0 0 1px var(--hm-lo)}
.hm-button:focus-visible{outline:2px solid var(--hm-ask);outline-offset:2px}
.hm-button:disabled{opacity:.5;cursor:default}
dialog.hm-respond{width:min(480px,100vw - 32px);max-height:calc(100dvh - 32px);overflow:auto;margin:auto;padding:24px;border:0;border-radius:14px;background:var(--hm-card);color:var(--hm-text);box-shadow:0 0 0 1px var(--hm-rule),0 24px 64px #0008}
dialog.hm-respond::backdrop{background:#0009;backdrop-filter:blur(2px)}
.hm-respond h2{margin:0 0 4px;font:500 10.5px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--hm-muted)}
.hm-respond blockquote{margin:12px 0 20px;padding:0 0 0 14px;border-left:2px solid var(--hm-lo);color:var(--hm-strong);font-size:17px;line-height:1.45}
.hm-respond fieldset{border:0;margin:0 0 16px;padding:0;display:grid;gap:8px}
.hm-respond legend{padding:0;margin:0 0 8px;color:var(--hm-strong);font-weight:600}
.hm-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hm-choice{position:relative}
.hm-choice input{position:absolute;opacity:0;pointer-events:none}
.hm-choice span{display:block;padding:12px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--hm-lo);text-align:center;cursor:pointer;color:var(--hm-text)}
.hm-choice input:checked+span{box-shadow:inset 0 0 0 1.5px var(--hm-strong);color:var(--hm-strong);background:var(--hm-ask-soft)}
.hm-choice input:focus-visible+span{outline:2px solid var(--hm-ask);outline-offset:2px}
.hm-respond label.hm-field{display:grid;gap:6px;margin:0 0 14px;font-size:14px}
.hm-respond textarea,.hm-respond input[type=text]{width:100%;padding:10px 12px;border-radius:10px;border:0;box-shadow:inset 0 0 0 1px var(--hm-lo);background:var(--hm-page);color:var(--hm-strong);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
.hm-respond textarea{min-height:96px;resize:vertical}
.hm-respond textarea:focus,.hm-respond input[type=text]:focus{outline:none;box-shadow:inset 0 0 0 1.5px var(--hm-mid)}
.hm-optional{color:var(--hm-muted)}
.hm-check{display:flex;gap:8px;align-items:center;margin:-4px 0 16px;font-size:14px}
.hm-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
.hm-status{margin-right:auto;font-size:14px;color:var(--hm-muted)}
.hm-status[data-error]{color:var(--hm-ask)}
`;

/** Runs on the page. Kept dependency-free and small; every write goes through one fetch. */
const RESPOND_SCRIPT = `
(() => {
  const config = JSON.parse(document.getElementById("hm-config").textContent);
  const root = document.querySelector(".hm");
  const dialog = document.getElementById("hm-respond");
  const form = dialog.querySelector("form");
  const status = dialog.querySelector(".hm-status");
  const send = dialog.querySelector("[data-send]");
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  };

  let responder = store.get("hm-responder");
  if (!responder || !/^[A-Za-z0-9]{24}$/.test(responder)) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    responder = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => letters[byte % 62]).join("");
    store.set("hm-responder", responder);
  }
  const mineKey = "hm-mine:" + config.slug;
  let mine = {};
  try { mine = JSON.parse(store.get(mineKey) || "{}") || {}; } catch {}

  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  function countLine(piece) {
    const c = config.counts[piece] || {};
    const parts = [];
    if (c.resonates) parts.push("<b>" + plural(c.resonates, "resonates", "resonate") + "</b>");
    if (c.differs) parts.push(plural(c.differs, "differs", "differ"));
    const said = (c.note || 0) + (c.idea || 0);
    if (said) parts.push(said + " said more");
    if (mine[piece]) parts.push('<span class="hm-mine">you: ' + (mine[piece] === "resonates" ? "resonates" : "differs") + "</span>");
    return parts.join(" · ");
  }
  function decorate() {
    root.querySelectorAll(".hm-legend li[data-id], .hm-person[data-id] > h3, [data-count-for]").forEach((el) => {
      const piece = el.hasAttribute("data-count-for") ? el.getAttribute("data-count-for") : (el.getAttribute("data-id") || el.parentElement.getAttribute("data-id"));
      let slot = el.hasAttribute("data-count-for") ? el : el.querySelector(":scope .hm-count");
      if (!slot) {
        slot = document.createElement("span");
        slot.className = "hm-count";
        (el.tagName === "LI" ? el.lastElementChild : el).appendChild(slot);
      }
      slot.innerHTML = countLine(piece);
    });
  }

  let current = null;
  function open(piece) {
    const info = config.pieces[piece];
    if (!info) return;
    current = piece;
    dialog.querySelector("h2").textContent = info.label;
    dialog.querySelector("blockquote").textContent = info.text;
    form.reset();
    const prior = mine[piece];
    if (prior) form.querySelector('input[name=reaction][value="' + prior + '"]').checked = true;
    form.elements.name.value = store.get("hm-name") || "";
    status.textContent = "";
    status.removeAttribute("data-error");
    send.disabled = false;
    dialog.showModal();
  }

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const trigger = target.closest(".hm-legend li[data-id], .hm-mark[data-id], .hm-person > h3, [data-respond]");
    if (!trigger) return;
    const piece = trigger.hasAttribute("data-respond") ? trigger.getAttribute("data-respond")
      : trigger.tagName === "H3" ? trigger.parentElement.getAttribute("data-id") : trigger.getAttribute("data-id");
    open(piece);
  });
  root.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.matches(".hm-legend li[data-id]") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      open(target.getAttribute("data-id"));
    }
  });
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());

  async function post(body) {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, piece: current || null, responder, key: config.key }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "That did not send. Try again in a moment.");
    if (result.counts) config.counts[current] = result.counts;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const reaction = form.querySelector("input[name=reaction]:checked")?.value || null;
    const text = form.elements.body.value.trim();
    const idea = form.elements.idea.checked;
    const name = form.elements.name.value.trim();
    if (!reaction && !text) {
      status.textContent = "Choose one, or say something.";
      status.setAttribute("data-error", "");
      return;
    }
    store.set("hm-name", name);
    send.disabled = true;
    status.removeAttribute("data-error");
    status.textContent = "Sending…";
    try {
      if (reaction) await post({ kind: reaction, body: idea ? null : text || null, name });
      if (text && (idea || !reaction)) await post({ kind: idea ? "idea" : "note", body: text, name });
      if (reaction) { mine[current] = reaction; store.set(mineKey, JSON.stringify(mine)); }
      decorate();
      status.textContent = "Thank you.";
      setTimeout(() => dialog.open && dialog.close(), 900);
    } catch (error) {
      status.textContent = error.message;
      status.setAttribute("data-error", "");
      send.disabled = false;
    }
  });

  decorate();
})();
`;

const DIALOG = `
<dialog class="hm-respond" id="hm-respond" aria-labelledby="hm-respond-title">
  <form method="dialog">
    <h2 id="hm-respond-title"></h2>
    <blockquote></blockquote>
    <fieldset>
      <legend>Does this match your world?</legend>
      <div class="hm-choices">
        <label class="hm-choice"><input type="radio" name="reaction" value="resonates"><span>Yes, it does</span></label>
        <label class="hm-choice"><input type="radio" name="reaction" value="differs"><span>Not for me</span></label>
      </div>
    </fieldset>
    <label class="hm-field"><span>Say more <span class="hm-optional">(optional)</span></span><textarea name="body" maxlength="1000" placeholder="How is it for you?"></textarea></label>
    <label class="hm-check"><input type="checkbox" name="idea"> This is an idea, not my experience</label>
    <label class="hm-field"><span>Your name <span class="hm-optional">(optional)</span></span><input type="text" name="name" maxlength="60" autocomplete="name"></label>
    <div class="hm-actions">
      <span class="hm-status" role="status" aria-live="polite"></span>
      <button type="button" class="hm-button" data-quiet data-close>Close</button>
      <button type="submit" class="hm-button" data-send>Send</button>
    </div>
  </form>
</dialog>`;

const LABELS: Record<string, string> = { scene: "A scene", person: "A person", does: "What they do", thinks: "What they think" };

export interface PageInput {
    model: HunchModel;
    slug: string;
    key: string | null;
    counts: Counts;
    nonce: string;
}

export function modelPage({ model, slug, key, counts, nonce }: PageInput): string {
    const pieces: Record<string, { label: string; text: string }> = { "": { label: "The whole model", text: model.premise ?? model.title } };
    for (const [id, piece] of piecesOf(model)) pieces[id] = { label: LABELS[piece.kind], text: piece.text };
    const config = JSON.stringify({ slug, key, counts, pieces, endpoint: `/m/${slug}/respond` }).replace(/</g, "\\u003c");
    const overall = `<section class="hm-overall"><h2>Does this model match your world?</h2><p>Say whether it fits how things go for you, or tap any line above to respond to just that.</p><span class="hm-count" data-count-for=""></span><button type="button" class="hm-button" data-respond="">Respond to the whole model</button></section>`;
    const body = modelHtml(model).replace("</header>", `</header><p class="hm-intro">Tap any line, person or marker to say whether it matches your world.</p>`);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeXml(model.title)} · Hunch model</title><style>${THEME_CSS}${PAGE_CSS}${RESPOND_CSS}</style></head><body><div class="hm" data-theme="auto"><main class="hm-page">${body}${overall}<p class="hm-foot">A hunch model: how someone thinks things go for people. Your response goes to the person who made it; other visitors see only the counts.</p></main>${DIALOG}</div><script type="application/json" id="hm-config">${config}</script><script nonce="${nonce}">${LINK_SCRIPT}${RESPOND_SCRIPT}</script></body></html>`;
}
