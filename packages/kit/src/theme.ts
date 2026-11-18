// theme.ts
//
// The two backdrops. Near-black and paper, the shading in four close steps, thin lines,
// mono corner labels — the Anatomy look, kept quiet so the people read first. One
// accent, used only for what the author asked to be told about.
//
// `data-theme="auto"` follows the reader's system setting; "dark" and "light" pin it.

const DARK = `
--hm-page:#0b0b0b;--hm-card:#131313;--hm-text:#a3a3a3;--hm-strong:#e8e8e8;--hm-muted:#6e6e6e;
--hm-face:#25231f;--hm-top:#302d27;--hm-lit-top:#354139;--hm-lit-face:#2c3731;
--hm-shade-0:#171612;--hm-shade-1:#1c1b17;--hm-shade-2:#211f1b;--hm-shade-3:#24221e;
--hm-hi:#c8c8c8;--hm-mid:#6a6a6a;--hm-lo:#3e3e3e;--hm-faint:#262626;
--hm-halo:#000;--hm-halo-opacity:.9;
--hm-ask:#f0b45a;--hm-ask-soft:#f0b45a26;--hm-rule:#232323;
`;

const LIGHT = `
--hm-page:#f3f0e9;--hm-card:#fdfbf6;--hm-text:#5e5a55;--hm-strong:#211f1c;--hm-muted:#918b82;
--hm-face:#eee8dc;--hm-top:#faf6ed;--hm-lit-top:#eef3ea;--hm-lit-face:#dfe8dc;
--hm-shade-0:#c7bfb2;--hm-shade-1:#d3ccbf;--hm-shade-2:#dfd8cc;--hm-shade-3:#e8e1d5;
--hm-hi:#4b4742;--hm-mid:#8e877d;--hm-lo:#a8a095;--hm-faint:#d7d0c5;
--hm-halo:#7c7265;--hm-halo-opacity:.22;
--hm-ask:#b86a00;--hm-ask-soft:#b86a0018;--hm-rule:#e2e2df;
`;

export const THEME_CSS = `
.hm{${DARK}}
.hm[data-theme="light"]{${LIGHT}}
@media (prefers-color-scheme:light){.hm[data-theme="auto"]{${LIGHT}}}
.hm{color-scheme:dark}
.hm[data-theme="light"]{color-scheme:light}
@media (prefers-color-scheme:light){.hm[data-theme="auto"]{color-scheme:light}}

.hm-svg{display:block;width:100%;height:auto;overflow:visible}
.hm-svg path,.hm-svg circle{vector-effect:non-scaling-stroke}
.hm-solid{--hm-solid-face:var(--hm-face);--hm-solid-top:var(--hm-top);--hm-solid-0:var(--hm-shade-0);--hm-solid-1:var(--hm-shade-1);--hm-solid-2:var(--hm-shade-2);--hm-solid-3:var(--hm-shade-3)}
.hm-solid[data-lit]{--hm-solid-face:var(--hm-lit-face);--hm-solid-top:var(--hm-lit-top)}
.hm-fill{fill:var(--hm-solid-face);stroke:none}
.hm-shade{stroke:none}
.hm-shade[data-shade="0"]{fill:var(--hm-solid-0)}
.hm-shade[data-shade="1"]{fill:var(--hm-solid-1)}
.hm-shade[data-shade="2"]{fill:var(--hm-solid-2)}
.hm-shade[data-shade="3"]{fill:var(--hm-solid-3)}
.hm-top{fill:var(--hm-solid-top);stroke:none}
.hm-halo{fill:var(--hm-halo);stroke:none;filter:blur(8px);opacity:var(--hm-halo-opacity);transform:translateY(3px)}
.hm-line{fill:none;stroke:var(--hm-lo);stroke-width:.65px;stroke-linecap:round;stroke-linejoin:round}
.hm-line[data-tone="hi"]{stroke:var(--hm-hi)}
.hm-line[data-tone="mid"]{stroke:var(--hm-mid)}
.hm-line[data-tone="faint"]{stroke:var(--hm-faint)}
.hm-line[data-tone="ask"]{stroke:var(--hm-ask)}
.hm-line[data-dotted]{stroke-dasharray:.01 3.5;stroke-width:1.1px}

.hm-mark circle,.hm-mark path.hm-bubble{fill:var(--hm-card);stroke:var(--hm-mid);stroke-width:1px}
.hm-mark text{fill:var(--hm-strong);font-weight:600;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;line-height:1;text-anchor:middle;dominant-baseline:central}
.hm-mark .hm-trail{fill:var(--hm-card);stroke:var(--hm-mid);stroke-width:.8px}
.hm-mark[data-ask] circle,.hm-mark[data-ask] path.hm-bubble{stroke:var(--hm-ask)}
.hm-mark[data-ask] text{fill:var(--hm-ask)}
.hm-mark,.hm-legend [data-id]{transition:opacity .25s cubic-bezier(.32,.72,0,1)}
.hm-label{fill:var(--hm-text);font:500 11px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.04em;paint-order:stroke;stroke:var(--hm-card);stroke-width:2.6px;stroke-linejoin:round}
@container hm-scene (max-width:560px){.hm-label{font-size:13px}}
@container hm-scene (max-width:420px){.hm-label{font-size:15px}}
.hm-label[data-tone="muted"]{fill:var(--hm-muted)}
.hm-face-eye{fill:var(--hm-strong)}
.hm-face-mouth{fill:none;stroke:var(--hm-strong);stroke-width:1.3px;stroke-linecap:round}

.hm[data-hot] .hm-mark:not([data-hot]){opacity:.28}
.hm-mark[data-hot] circle,.hm-mark[data-hot] path.hm-bubble{stroke:var(--hm-hi);stroke-width:1.3px}
@media (prefers-reduced-motion:reduce){.hm-mark,.hm-legend [data-id]{transition:none}}
`;

export const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:var(--hm-page);color:var(--hm-text);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.hm{background:var(--hm-page);color:var(--hm-text);min-height:100vh}
.hm-page{width:min(720px,100% - 32px);margin:0 auto;padding:56px 0 96px}
.hm-kicker,.hm-corner,.hm-then{font:500 10.5px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--hm-muted)}
.hm-head{margin:0 0 36px}
.hm-head h1{margin:12px 0 0;color:var(--hm-strong);font-size:clamp(24px,5vw,32px);line-height:1.15;font-weight:600;letter-spacing:-.015em}
.hm-premise{margin:14px 0 0;font-size:17px;color:var(--hm-text);max-width:56ch}
.hm-card{position:relative;margin:0;padding:52px 20px 52px;background:var(--hm-card);box-shadow:0 0 0 1px var(--hm-rule);container:hm-scene/inline-size}
.hm-corner{position:absolute;white-space:nowrap}
.hm-corner[data-at="fig"]{top:18px;left:20px;color:var(--hm-text)}
.hm-corner[data-at="title"]{top:18px;right:20px;max-width:calc(100% - 90px);overflow:hidden;text-overflow:ellipsis}
.hm-corner[data-at="hint"]{bottom:18px;left:20px;max-width:calc(100% - 200px);overflow:hidden;text-overflow:ellipsis}
.hm-corner[data-at="readout"]{bottom:18px;right:20px;color:var(--hm-text);letter-spacing:.04em;text-transform:none;font-variant-numeric:tabular-nums}
.hm-legend{display:grid;gap:24px;margin:20px 0 0;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.hm-person h3{margin:0 0 8px;color:var(--hm-strong);font-size:15px;font-weight:600}
.hm-person h3 span{color:var(--hm-muted);font-weight:400}
.hm-legend ol,.hm-legend ul{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:6px}
.hm-legend li{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:baseline;padding:2px 0;border-radius:4px;outline-offset:3px}
.hm-legend li:focus-visible{outline:1px solid var(--hm-mid)}
.hm-key{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;box-shadow:0 0 0 1px var(--hm-mid);font:600 10.5px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--hm-strong);transform:translateY(-1px)}
.hm-thinks .hm-key{border-radius:8px 8px 8px 2px}
.hm-thinks li{color:var(--hm-strong);font-style:italic}
.hm-legend li[data-ask] .hm-key{box-shadow:0 0 0 1px var(--hm-ask);color:var(--hm-ask)}
.hm-tag{display:inline-block;margin-left:8px;padding:1px 7px;border-radius:999px;background:var(--hm-ask-soft);color:var(--hm-ask);font:500 11px/1.5 ui-sans-serif,system-ui,sans-serif;font-style:normal;white-space:nowrap}
.hm-legend h4{margin:10px 0 6px;font:500 10.5px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--hm-muted)}
.hm-scene + .hm-then{display:flex;align-items:center;gap:12px;margin:40px 0}
.hm-then::before,.hm-then::after{content:"";flex:1;height:1px;background:var(--hm-rule)}
.hm-legend [data-hot]{background:var(--hm-ask-soft)}
.hm-foot{margin-top:56px;font-size:13px;color:var(--hm-muted)}
@media (max-width:560px){.hm-page{padding-top:36px}.hm-card{padding:44px 8px 48px}.hm-corner[data-at="fig"],.hm-corner[data-at="hint"]{left:12px}.hm-corner[data-at="title"],.hm-corner[data-at="readout"]{right:12px}}
`;
