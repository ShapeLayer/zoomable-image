export const styles = `
:host{display:block;width:var(--zoomable-image-width,var(--zoomable-internal-width,100%));font-family:inherit}
button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
.trigger{display:block;width:100%;padding:0;margin:0;border:0;background:none;cursor:zoom-in}
.trigger img{display:block;width:100%;height:auto}
dialog{position:fixed;inset:0;box-sizing:border-box;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;color:white;overflow:hidden;font-size:16px;--icon-size:14px;--button-padding:4px;--radius:6px;--zoom-font-size:11px;--caption-font-size:12px;--level-width:36px}
dialog::backdrop{background:var(--zoomable-image-backdrop,rgba(0,0,0,.75))}
.stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;box-sizing:border-box;padding:0;cursor:zoom-out}
dialog.with-caption .stage{padding-bottom:calc(12px + var(--bottom-height,0px))}
.surface{position:relative;line-height:0;flex:none;user-select:none}
.image{display:block;max-width:calc(100vw - 32px);max-height:calc(100dvh - 96px);width:auto;height:auto;object-fit:contain}
dialog.with-caption .image{max-height:calc(100dvh - 112px - var(--bottom-height,0px))}
.close{position:absolute;right:12px;top:12px}.controls{position:absolute;bottom:12px;left:12px;right:12px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.controls>*{pointer-events:auto}.caption{margin:0;max-width:min(640px,100%);max-height:30dvh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;font-size:var(--caption-font-size);text-align:center;padding:5px 10px}
.caption,.toolbar{background:var(--zoomable-image-controls,rgba(72,72,72,.92));border-radius:var(--radius)}
.toolbar{display:flex;align-items:center;padding:0 6px}.level{min-width:var(--level-width);text-align:center;font-size:var(--zoom-font-size);color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}
.close,.toolbar button{display:flex;align-items:center;justify-content:center;padding:var(--button-padding);margin:0;background:transparent;color:inherit;border:0;font-size:var(--icon-size);line-height:1;width:calc(var(--icon-size) + 2 * var(--button-padding));height:calc(var(--icon-size) + 2 * var(--button-padding));box-sizing:border-box}button:disabled{opacity:.35;cursor:default}
.regions{position:absolute;inset:0;pointer-events:none}.region{position:absolute;pointer-events:auto;padding:0;box-sizing:border-box;border:1px solid var(--zoomable-image-annotation-border-color,rgba(28,32,40,.2));background:var(--zoomable-image-annotation-background,rgba(28,32,40,.15));border-radius:4px;cursor:help}.region:hover,.region:focus-visible{background:var(--zoomable-image-annotation-active-background,rgba(28,32,40,.25));outline:2px solid #93c5fd;outline-offset:1px}
.tooltip{position:fixed;z-index:1;box-sizing:border-box;max-width:min(320px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;padding:8px 12px;background:rgba(20,24,32,.96);color:white;border-radius:6px;font-size:12px;line-height:1.5;pointer-events:none;overflow-wrap:anywhere;box-shadow:0 2px 12px rgba(0,0,0,.3)}
@media(max-width:600px),(pointer:coarse){dialog{--icon-size:22px;--button-padding:8px;--radius:8px;--zoom-font-size:15px;--caption-font-size:14px;--level-width:48px}.toolbar{padding:0 12px}.caption{padding:10px 20px}}
[hidden]{display:none!important}
`;
