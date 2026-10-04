import { clampPan, validAnnotation, zoomLevels, type ImageAnnotation } from './model.js';
import { styles } from './styles.js';
export type { ImageAnnotation } from './model.js';
export interface ViewerLabels {
  open: string;
  close: string;
  zoomIn: string;
  zoomOut: string;
}
export interface ZoomableImageEventMap {
  'zoomable-open': CustomEvent<void>;
  'zoomable-close': CustomEvent<void>;
  'zoomable-zoom': CustomEvent<{ scale: number }>;
  'zoomable-annotation': CustomEvent<{ annotation: ImageAnnotation }>;
  'zoomable-error': CustomEvent<{ src: string | null }>;
}
const scrollLocks = new WeakMap<Document, { count: number; overflow: string }>();
function lockScroll(doc: Document) {
  const lock = scrollLocks.get(doc);
  if (lock) lock.count++;
  else {
    scrollLocks.set(doc, { count: 1, overflow: doc.body.style.overflow });
    doc.body.style.overflow = 'hidden';
  }
}
function unlockScroll(doc: Document) {
  const lock = scrollLocks.get(doc);
  if (!lock || --lock.count > 0) return;
  doc.body.style.overflow = lock.overflow;
  scrollLocks.delete(doc);
}
function focusedElement(doc: Document): HTMLElement | undefined {
  let element = doc.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element && 'focus' in element ? (element as HTMLElement) : undefined;
}
// Importing on an SSR server must not access browser globals or register an element.
const ElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;
export class ZoomableImage extends ElementBase {
  static observedAttributes = ['src', 'alt', 'width', 'height', 'caption', 'display-width'];
  private root!: ShadowRoot;
  private dialog!: HTMLDialogElement;
  private trigger!: HTMLButtonElement;
  private image!: HTMLImageElement;
  private surface!: HTMLElement;
  private stage!: HTMLElement;
  private regions!: HTMLElement;
  private tooltip!: HTMLElement;
  private controls!: HTMLElement;
  private controller?: AbortController;
  private observer?: ResizeObserver;
  private data: ImageAnnotation[] = [];
  private strings: ViewerLabels = {
    open: 'Open image',
    close: 'Close image',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out'
  };
  private index = 2;
  private offset = { x: 0, y: 0 };
  private drag?: { id: number; x: number; y: number; originX: number; originY: number };
  private returnFocus?: HTMLElement;
  private opened = false;
  private lockedDocument?: Document;
  get src() {
    return this.getAttribute('src') ?? '';
  }
  set src(value: string | null | undefined) {
    if (value == null) this.removeAttribute('src');
    else this.setAttribute('src', value);
  }
  get alt() {
    return this.getAttribute('alt') ?? '';
  }
  set alt(value: string | null | undefined) {
    if (value == null) this.removeAttribute('alt');
    else this.setAttribute('alt', value);
  }
  get caption() {
    return this.getAttribute('caption') ?? '';
  }
  set caption(value: string | null | undefined) {
    if (value == null) this.removeAttribute('caption');
    else this.setAttribute('caption', value);
  }
  get displayWidth() {
    return this.getAttribute('display-width') ?? '';
  }
  set displayWidth(value: string | null | undefined) {
    if (value == null) this.removeAttribute('display-width');
    else this.setAttribute('display-width', value);
  }

  get annotations(): ImageAnnotation[] {
    return this.data.map((a) => ({ ...a }));
  }
  set annotations(value: ImageAnnotation[]) {
    if (
      !Array.isArray(value) ||
      !value.every(validAnnotation) ||
      new Set(value.map((a) => a.id)).size !== value.length
    ) {
      throw new TypeError('annotations must have unique IDs and valid percentage regions');
    }
    this.data = value.map((a) => ({ ...a }));
    if (this.root) this.renderAnnotations();
  }
  get labels(): ViewerLabels {
    return { ...this.strings };
  }
  set labels(value: ViewerLabels) {
    if (
      !value ||
      !['open', 'close', 'zoomIn', 'zoomOut'].every(
        (key) => typeof value[key as keyof ViewerLabels] === 'string'
      )
    )
      throw new TypeError('All viewer labels must be strings');
    this.strings = { ...value };
    if (this.root) this.sync();
  }
  get isOpen() {
    return this.dialog?.open ?? false;
  }
  get zoom() {
    return zoomLevels[this.index];
  }
  connectedCallback() {
    if (!this.root) this.initialize();
    // Upgrade properties set before customElements.define().
    for (const name of [
      'annotations',
      'labels',
      'src',
      'alt',
      'caption',
      'displayWidth'
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(this, name)) {
        const value = this[name];
        delete (this as unknown as Record<string, unknown>)[name];
        if (name === 'annotations') this.annotations = value as ImageAnnotation[];
        else if (name === 'labels') this.labels = value as ViewerLabels;
        else this[name] = value as string;
      }
    }
    this.controller?.abort();
    this.controller = new AbortController();
    this.ownerDocument.defaultView?.addEventListener('resize', () => this.updateTransform(), {
      signal: this.controller.signal
    });
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => {
      this.dialog.style.setProperty('--bottom-height', `${this.controls.offsetHeight}px`);
      this.updateTransform();
    });
    this.observer.observe(this.controls);
    this.observer.observe(this.image);
    this.renderAnnotations();
    this.sync();
  }
  disconnectedCallback() {
    this.close();
    this.controller?.abort();
    this.observer?.disconnect();
    this.drag = undefined;
  }
  attributeChangedCallback() {
    if (this.root) this.sync();
  }
  open() {
    if (!this.isConnected || this.isOpen) return;
    const focused = focusedElement(this.ownerDocument);
    this.returnFocus = focused && focused !== this.ownerDocument.body ? focused : this.trigger;
    this.index = 2;
    this.offset = { x: 0, y: 0 };
    this.dialog.showModal();
    this.opened = true;
    this.lockedDocument = this.ownerDocument;
    lockScroll(this.lockedDocument);
    this.updateTransform();
    this.root.querySelector<HTMLButtonElement>('.close')!.focus();
    this.emit('zoomable-open');
  }
  close() {
    if (!this.isOpen) return;
    this.dialog.close();
    this.finishClose();
  }
  zoomIn() {
    this.setZoomIndex(this.index + 1);
  }
  zoomOut() {
    this.setZoomIndex(this.index - 1);
  }
  reset() {
    this.offset = { x: 0, y: 0 };
    this.setZoomIndex(2);
    this.updateTransform();
  }
  private emit<K extends keyof ZoomableImageEventMap>(
    name: K,
    detail?: ZoomableImageEventMap[K]['detail']
  ) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  private finishClose() {
    if (!this.opened) return;
    this.opened = false;
    if (this.lockedDocument) unlockScroll(this.lockedDocument);
    this.lockedDocument = undefined;
    this.drag = undefined;
    this.hideTooltip();
    const target = this.returnFocus;
    this.returnFocus = undefined;
    if (this.isConnected) (target?.isConnected ? target : this.trigger).focus();
    this.emit('zoomable-close');
  }
  private initialize() {
    this.root = this.attachShadow({ mode: 'open' });
    // Only static, library-owned markup is parsed. Consumer text is assigned with textContent.
    this.root.innerHTML = `<style>${styles}</style><button type="button" class="trigger" part="trigger"><img loading="lazy" part="thumbnail"></button><dialog part="dialog"><div class="stage"><div class="surface"><img class="image" part="image" draggable="false"><div class="regions"></div></div></div><button type="button" class="close" part="close">×</button><div class="controls"><p class="caption" part="caption" id="caption"></p><div class="toolbar" part="toolbar"><button type="button" class="out">−</button><span class="level" aria-live="polite"></span><button type="button" class="in">+</button></div></div><div class="tooltip" part="tooltip" id="tooltip" role="tooltip" hidden></div></dialog>`;
    const get = <T extends Element>(s: string) => this.root.querySelector<T>(s)!;
    this.trigger = get('.trigger');
    this.dialog = get('dialog');
    this.image = get('.image');
    this.surface = get('.surface');
    this.stage = get('.stage');
    this.regions = get('.regions');
    this.tooltip = get('.tooltip');
    this.controls = get('.controls');
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });
    this.trigger.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    });
    get('.close').addEventListener('click', () => this.close());
    get('.in').addEventListener('click', () => this.zoomIn());
    get('.out').addEventListener('click', () => this.zoomOut());
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
    this.dialog.addEventListener('close', () => {
      if (!this.dialog.open) this.finishClose();
    });
    this.dialog.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoomIn();
      }
      if (e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      }
    });
    this.stage.addEventListener('click', (e) => {
      if (e.target === this.stage) this.close();
    });
    this.surface.addEventListener('pointerdown', (e) => {
      if (this.zoom <= 1 || e.button !== 0 || (e.target as Element).closest('.region')) return;
      e.preventDefault();
      this.hideTooltip();
      this.surface.setPointerCapture(e.pointerId);
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        originX: this.offset.x,
        originY: this.offset.y
      };
    });
    this.surface.addEventListener('pointermove', (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.offset = {
        x: this.drag.originX + e.clientX - this.drag.x,
        y: this.drag.originY + e.clientY - this.drag.y
      };
      this.updateTransform();
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.surface.addEventListener(event, () => {
        this.drag = undefined;
      });
    this.image.addEventListener('load', () => this.updateTransform());
    this.image.addEventListener('error', () =>
      this.emit('zoomable-error', { src: this.getAttribute('src') })
    );
  }
  private sync() {
    for (const image of this.root.querySelectorAll('img')) {
      for (const name of ['src', 'alt', 'width', 'height']) {
        const value = this.getAttribute(name);
        if (value === null) image.removeAttribute(name);
        else if (image.getAttribute(name) !== value) image.setAttribute(name, value);
      }
    }
    const displayWidth = this.getAttribute('display-width');
    if (displayWidth) this.style.setProperty('--zoomable-internal-width', displayWidth);
    else this.style.removeProperty('--zoomable-internal-width');
    const caption = this.root.querySelector<HTMLElement>('.caption')!;
    caption.textContent = this.getAttribute('caption') ?? '';
    caption.hidden = !caption.textContent.trim();
    this.dialog.classList.toggle('with-caption', !caption.hidden);
    this.dialog.style.setProperty('--bottom-height', `${this.controls.offsetHeight}px`);
    if (caption.hidden) this.dialog.removeAttribute('aria-describedby');
    else this.dialog.setAttribute('aria-describedby', 'caption');
    this.dialog.setAttribute('aria-label', this.getAttribute('alt') || this.strings.open);
    this.trigger.setAttribute(
      'aria-label',
      `${this.strings.open}: ${this.getAttribute('alt') ?? ''}`
    );
    for (const [selector, label] of [
      ['.close', this.strings.close],
      ['.in', this.strings.zoomIn],
      ['.out', this.strings.zoomOut]
    ])
      this.root.querySelector(selector)!.setAttribute('aria-label', label);
    this.updateTransform();
  }
  private setZoomIndex(index: number) {
    const next = Math.max(0, Math.min(zoomLevels.length - 1, index));
    if (next === this.index) return;
    const ratio = zoomLevels[next] / this.zoom;
    this.offset = { x: this.offset.x * ratio, y: this.offset.y * ratio };
    this.index = next;
    this.updateTransform();
    this.emit('zoomable-zoom', { scale: this.zoom });
  }
  private updateTransform() {
    if (!this.root) return;
    this.hideTooltip();
    this.offset = clampPan(
      this.offset.x,
      this.offset.y,
      this.image.offsetWidth,
      this.image.offsetHeight,
      this.zoom,
      this.stage.clientWidth -
        parseFloat(getComputedStyle(this.stage).paddingLeft) -
        parseFloat(getComputedStyle(this.stage).paddingRight),
      this.stage.clientHeight -
        parseFloat(getComputedStyle(this.stage).paddingTop) -
        parseFloat(getComputedStyle(this.stage).paddingBottom)
    );
    this.surface.style.transform = `translate(${this.offset.x}px,${this.offset.y}px) scale(${this.zoom})`;
    this.surface.style.cursor = this.zoom > 1 ? 'grab' : 'default';
    this.root.querySelector('.level')!.textContent = `${Math.round(this.zoom * 100)}%`;
    this.root.querySelector<HTMLButtonElement>('.out')!.disabled = this.index === 0;
    this.root.querySelector<HTMLButtonElement>('.in')!.disabled =
      this.index === zoomLevels.length - 1;
  }
  private hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hidden = true;
    this.regions
      .querySelectorAll('[aria-describedby]')
      .forEach((el) => el.removeAttribute('aria-describedby'));
  }
  private renderAnnotations() {
    this.hideTooltip();
    this.regions.replaceChildren();
    for (const a of this.data) {
      const button = this.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = 'region';
      button.setAttribute('part', 'annotation');
      button.setAttribute('aria-label', a.text);
      Object.assign(button.style, {
        left: `${a.x}%`,
        top: `${a.y}%`,
        width: `${a.width}%`,
        height: `${a.height}%`
      });
      const show = () => {
        this.hideTooltip();
        this.tooltip.textContent = a.tooltip ?? a.text;
        this.tooltip.hidden = false;
        button.setAttribute('aria-describedby', 'tooltip');
        const rect = button.getBoundingClientRect();
        this.tooltip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - this.tooltip.offsetWidth / 2, this.stage.clientWidth - this.tooltip.offsetWidth - 8))}px`;
        const above = rect.top - this.tooltip.offsetHeight - 8;
        const preferredTop = above >= 8 ? above : rect.bottom + 8;
        this.tooltip.style.top = `${Math.max(8, Math.min(preferredTop, this.stage.clientHeight - this.tooltip.offsetHeight - 8))}px`;
      };
      button.addEventListener('pointerenter', show);
      button.addEventListener('focus', show);
      button.addEventListener('pointerleave', () => this.hideTooltip());
      button.addEventListener('blur', () => this.hideTooltip());
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        show();
        this.emit('zoomable-annotation', { annotation: { ...a } });
      });
      this.regions.append(button);
    }
  }
}
export function defineZoomableImage(
  tagName = 'zoomable-image',
  registry = globalThis.customElements
): void {
  if (!registry) return;
  const existing = registry.get(tagName);
  if (existing && (existing === ZoomableImage || existing.prototype instanceof ZoomableImage))
    return;
  if (existing) throw new Error(`Custom element ${tagName} is already defined`);
  registry.define(
    tagName,
    tagName === 'zoomable-image' ? ZoomableImage : class extends ZoomableImage {}
  );
}
declare global {
  interface HTMLElementEventMap {
    'zoomable-open': ZoomableImageEventMap['zoomable-open'];
    'zoomable-close': ZoomableImageEventMap['zoomable-close'];
    'zoomable-zoom': ZoomableImageEventMap['zoomable-zoom'];
    'zoomable-annotation': ZoomableImageEventMap['zoomable-annotation'];
    'zoomable-error': ZoomableImageEventMap['zoomable-error'];
  }
  interface HTMLElementTagNameMap {
    'zoomable-image': ZoomableImage;
  }
}
