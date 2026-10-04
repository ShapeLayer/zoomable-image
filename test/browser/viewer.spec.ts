import { test, expect } from '@playwright/test';
import type { ZoomableImage } from '../../src/index.js';
declare global {
  interface Window {
    hostEvents: string[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/examples/');
  await expect(page.locator('zoomable-image .trigger')).toBeVisible();
});

test('opens a native modal, zooms to limits, resets and restores focus', async ({ page }) => {
  const image = page.locator('zoomable-image');
  await image.locator('.trigger').click();
  await expect(image.locator('dialog')).toBeVisible();
  await expect(image.locator('.close')).toBeFocused();
  await expect(image.locator('.caption')).toHaveText('A framework-independent image viewer');
  for (let i = 0; i < 5; i++) await page.keyboard.press('+');
  await expect(image.locator('.level')).toHaveText('400%');
  await expect(image.locator('.in')).toBeDisabled();
  for (let i = 0; i < 8; i++) await page.keyboard.press('-');
  await expect(image.locator('.level')).toHaveText('50%');
  await expect(image.locator('.out')).toBeDisabled();
  await image.evaluate((el) => (el as ZoomableImage).reset());
  await expect(image.locator('.level')).toHaveText('100%');
  await page.keyboard.press('Escape');
  await expect(image.locator('dialog')).not.toBeVisible();
  await expect(image.locator('.trigger')).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('annotations work by keyboard and tap, text is not parsed as HTML', async ({ page }) => {
  const image = page.locator('zoomable-image');
  await image.evaluate((node) => {
    const el = node as ZoomableImage;
    el.caption = '<b>plain caption</b>';
    el.annotations = [
      {
        id: 'a',
        x: 33,
        y: 25,
        width: 34,
        height: 50,
        text: 'Circle',
        tooltip: '<img src=x onerror=alert(1)>'
      }
    ];
    el.open();
  });
  await expect(image.locator('.caption')).toHaveText('<b>plain caption</b>');
  await image.locator('.region').focus();
  await expect(image.locator('.tooltip')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(image.locator('.tooltip img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(image.locator('.tooltip')).not.toBeVisible();
  await expect(image.locator('dialog')).not.toBeVisible();
  await image.evaluate((el) => (el as ZoomableImage).open());
  await image.locator('.region').click();
  await expect(image.locator('.tooltip')).toBeVisible();
  const rect = await image.locator('.tooltip').boundingBox();
  const viewport = page.viewportSize()!;
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height);
  await page.keyboard.press('+');
  await expect(image.locator('.tooltip')).not.toBeVisible();
});

test('dynamic attributes, labels and annotations update without losing focused region', async ({
  page
}) => {
  const image = page.locator('zoomable-image');
  await image.evaluate((el) => (el as ZoomableImage).open());
  await image.locator('.region').focus();
  await image.evaluate((node) => {
    const el = node as ZoomableImage;
    el.caption = 'Updated';
    el.alt = 'Updated image';
    el.labels = { open: '열기', close: '닫기', zoomIn: '확대', zoomOut: '축소' };
  });
  await expect(image.locator('.region')).toBeFocused();
  await expect(image.locator('.close')).toHaveAttribute('aria-label', '닫기');
  await expect(image.locator('dialog')).toHaveAttribute('aria-label', 'Updated image');
  await image.evaluate((node) => {
    const el = node as ZoomableImage;
    el.annotations = [];
    el.caption = '';
  });
  await expect(image.locator('.region')).toHaveCount(0);
  await expect(image.locator('.caption')).not.toBeVisible();
  await expect(image.locator('dialog')).not.toHaveAttribute('aria-describedby');
});

test('panning is bounded and image and annotation geometry stay aligned', async ({ page }) => {
  const image = page.locator('zoomable-image');
  await image.evaluate((node) => {
    const el = node as ZoomableImage;
    el.open();
    el.zoomIn();
    el.zoomIn();
  });
  await expect(image.locator('.level')).toHaveText('200%');
  const box = await image.locator('.image').boundingBox();
  const x = Math.max(30, box!.x + box!.width * 0.15);
  const y = Math.max(60, box!.y + box!.height * 0.15);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 1200, y + 1200, { steps: 5 });
  await page.mouse.up();
  const geometry = await image.evaluate((node) => {
    const el = node as ZoomableImage;
    const root = el.shadowRoot!;
    const img = root.querySelector('.image')!.getBoundingClientRect();
    const region = root.querySelector('.region')!.getBoundingClientRect();
    return {
      x: (region.left - img.left) / img.width,
      y: (region.top - img.top) / img.height,
      transform: root.querySelector<HTMLElement>('.surface')!.style.transform
    };
  });
  expect(geometry.x).toBeCloseTo(0.33, 2);
  expect(geometry.y).toBeCloseTo(0.25, 2);
  expect(geometry.transform).not.toContain('NaN');
  expect(geometry.transform).not.toBe('translate(0px, 0px) scale(2)');
});

test('multiple instances preserve scroll lock, cleanup, reconnection and event order', async ({
  page
}) => {
  const result = await page.evaluate(async () => {
    const first = document.querySelector('zoomable-image')!;
    const second = document.createElement('zoomable-image');
    second.src = first.src;
    second.alt = 'Second';
    document.body.append(second);
    const events: string[] = [];
    first.addEventListener('zoomable-open', () => events.push('open'));
    first.addEventListener('zoomable-close', () => events.push('close'));
    document.body.style.overflow = 'scroll';
    first.open();
    second.open();
    first.close();
    const locked = document.body.style.overflow;
    second.remove();
    const restored = document.body.style.overflow;
    document.body.append(second);
    second.open();
    second.close();
    second.remove();
    first.open();
    first.close();
    first.open();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stillOpen = first.isOpen;
    first.close();
    return { locked, restored, stillOpen, events };
  });
  expect(result.locked).toBe('hidden');
  expect(result.restored).toBe('scroll');
  expect(result.stillOpen).toBe(true);
  expect(result.events).toEqual(['open', 'close', 'open', 'close', 'open', 'close']);
});

test('pre-definition properties upgrade, duplicate registration and invalid data are handled', async ({
  page
}) => {
  const result = await page.evaluate(async () => {
    const { defineZoomableImage } = (await import(
      '/dist/' + 'index.js'
    )) as typeof import('../../src/index.js');
    const element = document.createElement('future-image') as ZoomableImage;
    element.annotations = [{ id: 'a', x: 0, y: 0, width: 10, height: 10, text: 'Future' }];
    element.caption = 'Future caption';
    document.body.append(element);
    defineZoomableImage('future-image');
    defineZoomableImage('future-image');
    let invalid = false;
    try {
      element.annotations = [{ id: 'x', x: -1, y: 0, width: 10, height: 10, text: 'Invalid' }];
    } catch {
      invalid = true;
    }
    return {
      caption: element.getAttribute('caption'),
      regions: element.shadowRoot!.querySelectorAll('.region').length,
      invalid
    };
  });
  expect(result).toEqual({ caption: 'Future caption', regions: 1, invalid: true });
});

test('modal remains above transformed ancestors and isolates host click and Escape handlers', async ({
  page
}) => {
  await page.evaluate(() => {
    const image = document.querySelector('zoomable-image')!;
    const host = document.createElement('div');
    host.style.transform = 'translateZ(0)';
    host.style.overflow = 'hidden';
    host.style.height = '180px';
    image.parentNode!.insertBefore(host, image);
    host.append(image);
    window.hostEvents = [];
    host.addEventListener('click', () => window.hostEvents.push('click'));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.hostEvents.push('escape');
    });
  });
  await page.locator('.trigger').click();
  await expect(page.locator('.close')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.hostEvents)).toEqual([]);
});

test('native dialog contains tab focus and prevents background interaction', async ({ page }) => {
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.id = 'background';
    button.textContent = 'Background';
    document.body.append(button);
  });
  await page.locator('.trigger').click();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('background');
  }
  expect(await page.locator('dialog').evaluate((el) => el.matches(':modal'))).toBe(true);
});

test('touch activation and viewport resizing keep caption and controls usable', async ({
  page
}, testInfo) => {
  const image = page.locator('zoomable-image');
  await image.evaluate((node) => {
    (node as ZoomableImage).caption = 'A long caption '.repeat(100);
  });
  if (testInfo.project.use.hasTouch) await image.locator('.trigger').tap();
  else await image.locator('.trigger').click();
  await expect(image.locator('.caption')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(image.locator('.in')).toBeInViewport();
  await expect(image.locator('.out')).toBeInViewport();
  if (testInfo.project.use.hasTouch) await image.locator('.in').tap();
  else await image.locator('.in').click();
  await expect(image.locator('.level')).toHaveText('150%');
  await image.locator('.close').click();
  await expect(image.locator('dialog')).not.toBeVisible();
});

test('open, zoom and annotation events reach the host and image errors are reported', async ({
  page
}) => {
  const result = await page.evaluate(async () => {
    const image = document.querySelector('zoomable-image')!;
    const events: { name: string; composed: boolean; bubbles: boolean; scale?: number }[] = [];
    for (const name of [
      'zoomable-open',
      'zoomable-zoom',
      'zoomable-annotation',
      'zoomable-error'
    ]) {
      document.addEventListener(name, (event) => {
        events.push({
          name,
          composed: event.composed,
          bubbles: event.bubbles,
          scale: (event as CustomEvent).detail?.scale
        });
      });
    }
    image.open();
    image.zoomIn();
    image.shadowRoot!.querySelector<HTMLButtonElement>('.region')!.click();
    const failed = new Promise<void>((resolve) =>
      image.addEventListener('zoomable-error', () => resolve(), { once: true })
    );
    image.src = '/missing-image.png';
    await failed;
    image.close();
    return events;
  });
  expect(result.map((event) => event.name)).toEqual([
    'zoomable-open',
    'zoomable-zoom',
    'zoomable-annotation',
    'zoomable-error'
  ]);
  expect(result.every((event) => event.composed && event.bubbles)).toBe(true);
  expect(result[1].scale).toBe(1.5);
});

test('automatic entry registers and public constructor works after registration', async ({
  page
}) => {
  await page.goto('/examples/auto.html');
  await expect(page.locator('zoomable-image .trigger')).toBeVisible();
  const result = await page.evaluate(async () => {
    await import('/dist/' + 'register.js');
    const { ZoomableImage } = (await import(
      '/dist/' + 'index.js'
    )) as typeof import('../../src/index.js');
    const image = new ZoomableImage();
    image.src = document.querySelector('zoomable-image')!.src;
    image.style.width = '240px';
    document.body.append(image);
    image.zoomIn();
    image.reset();
    image.open();
    image.close();
    image.displayWidth = '80%';
    image.removeAttribute('display-width');
    return {
      registered: !!customElements.get('zoomable-image'),
      width: image.style.width,
      zoom: image.zoom
    };
  });
  expect(result).toEqual({ registered: true, width: '240px', zoom: 1 });
});

test('original sizing, absent caption, annotation defaults and tooltip placement are preserved', async ({
  page
}, testInfo) => {
  const image = page.locator('zoomable-image');
  await image.evaluate((node) => {
    const viewer = node as ZoomableImage;
    viewer.caption = undefined;
    viewer.style.fontSize = '24px';
    viewer.open();
  });
  await expect(image).not.toHaveAttribute('caption');
  await expect(image.locator('.caption')).not.toBeVisible();
  await expect(image.locator('dialog')).not.toHaveAttribute('aria-describedby');
  const viewport = page.viewportSize()!;
  const box = await image.locator('.image').boundingBox();
  expect(box!.height).toBeCloseTo(
    Math.min(800, viewport.height - 96, ((viewport.width - 32) * 800) / 1200),
    0
  );
  expect(box!.y + box!.height / 2).toBeCloseTo(viewport.height / 2, 0);
  const touch = !!testInfo.project.use.hasTouch || viewport.width <= 600;
  const toolbar = await image.locator('.toolbar').boundingBox();
  expect(toolbar!.height).toBeCloseTo(touch ? 51.3 : 29.7, 1);
  for (const selector of ['.in', '.out', '.level']) {
    const control = await image.locator(selector).boundingBox();
    expect(control!.y + control!.height / 2).toBeCloseTo(toolbar!.y + toolbar!.height / 2, 1);
  }
  const closeButton = await image.locator('.close').boundingBox();
  expect(closeButton!.height).toBeCloseTo(touch ? 62.7 : 36.3, 1);
  await expect(image.locator('.level')).toHaveCSS('font-size', touch ? '20px' : '15px');
  await expect(image.locator('.region')).toHaveCSS('background-color', 'rgba(28, 32, 40, 0.15)');
  await expect(image.locator('.region')).toHaveCSS('border-top-color', 'rgba(28, 32, 40, 0.2)');
  await image.locator('.region').focus();
  await expect(image.locator('.tooltip')).toHaveCSS('font-size', '13px');
  const region = await image.locator('.region').boundingBox();
  const tooltip = await image.locator('.tooltip').boundingBox();
  expect(tooltip!.y + tooltip!.height).toBeLessThanOrEqual(region!.y - 7);
  await image.evaluate((node) => {
    (node as ZoomableImage).annotations = [
      { id: 'top', x: 20, y: 0, width: 20, height: 1, text: 'Top' }
    ];
  });
  await image.locator('.region').focus();
  const topRegion = await image.locator('.region').boundingBox();
  const topTooltip = await image.locator('.tooltip').boundingBox();
  if (topRegion!.y < topTooltip!.height + 16)
    expect(topTooltip!.y).toBeGreaterThanOrEqual(topRegion!.y + topRegion!.height);
});

test('clicking the dark background closes without activating the host', async ({ page }) => {
  await page.goto('/examples/');
  const image = page.locator('zoomable-image').first();
  await image.locator('.trigger').click();
  await expect(image.locator('dialog')).toBeVisible();
  await image.locator('.stage').click({ position: { x: 2, y: 2 } });
  await expect(image.locator('dialog')).not.toBeVisible();
  await expect(image.locator('.trigger')).toBeFocused();
});
