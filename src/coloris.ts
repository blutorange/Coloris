/*!
 * Copyright (c) 2021 Momo Bassit.
 * Licensed under the MIT License (MIT)
 * https://github.com/mdbassit/Coloris
 */

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

interface HslaColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

interface PagePosition {
  pageX: number;
  pageY: number;
}

interface Dims {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InternalOptions {
  parent: HTMLElement | null;
  margin: number;
  clearButton: Coloris.ClearButtonOptions;
  a11y: Coloris.Accessibility;
  el: string;
  wrap: boolean;
  theme: Coloris.ColorTheme;
  format: Coloris.ColorFormat;
  alpha: boolean;
  swatches?: string[];
}

((window, document, Math) => {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  const currentColor = { r: 0, g: 0, b: 0, h: 0, s: 0, v: 0, a: 1 };

  let picker: HTMLDivElement;
  let colorArea: HTMLElement;
  let colorAreaDims: Dims;
  let colorMarker: HTMLElement;
  let colorPreview: HTMLElement;
  let colorValue: HTMLInputElement;
  let clearButton: HTMLButtonElement;
  let hueSlider: HTMLInputElement;
  let hueMarker: HTMLElement;
  let alphaSlider: HTMLInputElement;
  let alphaMarker: HTMLElement;
  let currentEl: HTMLInputElement | null;
  let oldColor: string;

  // Default settings
  const settings: InternalOptions = {
    el: '[data-coloris]',
    parent: null,
    theme: 'light',
    wrap: true,
    margin: 2,
    format: 'hex',
    swatches: [],
    alpha: true,
    clearButton: {
      show: false,
      label: 'Clear'
    },
    a11y: {
      open: 'Open color picker',
      close: 'Close color picker',
      marker: 'Saturation: {s}. Brightness: {v}.',
      hueSlider: 'Hue slider',
      alphaSlider: 'Opacity slider',
      input: 'Color value field',
      swatch: 'Color swatch',
      instruction: 'Saturation and brightness selector. Use up, down, left and right arrow keys to select.'
    }
  };

  /**
   * Configure the color picker.
   * @param {object} options Configuration options.
   */
  function configure(options: Coloris.ColorisOptions): void {
    if (typeof options !== 'object') {
      return;
    }

    for (const key in options) {
      switch (key) {
        case 'el':
          bindFields(options.el);
          if (options.wrap !== false) {
            wrapFields(options.el);
          }
          break;
        case 'parent':
          settings.parent = document.querySelector(options.parent ?? "");
          if (settings.parent) {
            settings.parent.appendChild(picker);
          }
          break;
        case 'theme':
          picker.className = `clr-picker clr-${(options.theme ?? "light").split('-').join(' clr-')}`;
          break;
        case 'margin':
          options.margin = parseInt(String(options.margin ?? 0));
          settings.margin = !isNaN(options.margin) ? options.margin : settings.margin;
          break;
        case 'wrap':
          if (options.el && options.wrap) {
            wrapFields(options.el);
          }
          break;
        case 'format':
          settings.format = options.format ?? "hex";
          break;
        case 'swatches':
          if (Array.isArray(options.swatches)) {
            const swatches: string[] = [];

            options.swatches.forEach((swatch, i) => {
              swatches.push(`<button id="clr-swatch-${i}" aria-labelledby="clr-swatch-label clr-swatch-${i}" style="color: ${swatch};">${swatch}</button>`);
            });

            if (swatches.length) {
              const el = getEl('clr-swatches');
              if (el) {
                el.innerHTML = `<div>${swatches.join('')}</div>`;
              }
            }
          }
          break;
        case 'alpha':
          settings.alpha = !!options.alpha;
          picker.setAttribute('data-alpha', String(settings.alpha));
          break;
        case 'clearButton':
          let display = 'none'

          if (options.clearButton?.show) {
            display = 'block';
          }

          if (options.clearButton?.label) {
            clearButton.innerHTML = options.clearButton.label;
          }

          clearButton.style.display = display;
          break;
        case 'a11y':
          const labels = options.a11y;
          let update = false;

          if (typeof labels === 'object') {
            for (const label of Object.keys(labels) as (keyof Coloris.Accessibility)[]) {
              if (labels[label] && settings.a11y[label]) {
                settings.a11y[label] = labels[label];
                update = true;
              }
            }
          }

          if (update) {
            const openLabel = getEl('clr-open-label');
            const swatchLabel = getEl('clr-swatch-label');

            if (openLabel) {
              openLabel.innerHTML = settings.a11y.open;
            }
            if (swatchLabel) {
              swatchLabel.innerHTML = settings.a11y.swatch;
            }
            colorPreview.setAttribute('aria-label', settings.a11y.close);
            hueSlider.setAttribute('aria-label', settings.a11y.hueSlider);
            alphaSlider.setAttribute('aria-label', settings.a11y.alphaSlider);
            colorValue.setAttribute('aria-label', settings.a11y.input);
            colorArea.setAttribute('aria-label', settings.a11y.instruction);
          }
      }
    }
  }

  /**
   * Bind the color picker to input fields that match the selector.
   * @param selector One or more selectors pointing to input fields.
   */
  function bindFields(selector: string): void {
    // Show the color picker on click on the input fields that match the selector
    addDelegateListener(document, 'click', selector, event => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      const parent = settings.parent;
      const coords = event.target.getBoundingClientRect();
      const scrollY = window.scrollY;
      let reposition = { left: false, top: false };
      let offset = { x: 0, y: 0 };
      let left = coords.x;
      let top = scrollY + coords.y + coords.height + settings.margin;

      currentEl = event.target;
      oldColor = currentEl.value;
      picker.classList.add('clr-open');

      const pickerWidth = picker.offsetWidth;
      const pickerHeight = picker.offsetHeight;

      // If the color picker is inside a custom container
      // set the position relative to it
      if (parent) {
        const style = window.getComputedStyle(parent);
        const marginTop = parseFloat(style.marginTop);
        const borderTop = parseFloat(style.borderTopWidth);

        offset = parent.getBoundingClientRect();
        offset.y += borderTop + scrollY;
        left -= offset.x;
        top -= offset.y;

        if (left + pickerWidth > parent.clientWidth) {
          left += coords.width - pickerWidth;
          reposition.left = true;
        }

        if (top + pickerHeight > parent.clientHeight - marginTop) {
          top -= coords.height + pickerHeight + settings.margin * 2;
          reposition.top = true;
        }

        top += parent.scrollTop;

        // Otherwise set the position relative to the whole document
      } else {
        if (left + pickerWidth > document.documentElement.clientWidth) {
          left += coords.width - pickerWidth;
          reposition.left = true;
        }

        if (top + pickerHeight - scrollY > document.documentElement.clientHeight) {
          top = scrollY + coords.y - pickerHeight - settings.margin;
          reposition.top = true;
        }
      }

      picker.classList.toggle('clr-left', reposition.left);
      picker.classList.toggle('clr-top', reposition.top);
      picker.style.left = `${left}px`;
      picker.style.top = `${top}px`;
      colorAreaDims = {
        width: colorArea.offsetWidth,
        height: colorArea.offsetHeight,
        x: picker.offsetLeft + colorArea.offsetLeft + offset.x,
        y: picker.offsetTop + colorArea.offsetTop + offset.y
      };

      setColorFromStr(currentEl.value);
      colorValue.focus({ preventScroll: true });
    });

    // Update the color preview of the input fields that match the selector
    addDelegateListener(document, 'input', selector, event => {
      if (event.target instanceof HTMLInputElement) {
        const parent = event.target.parentNode;

        // Only update the preview if the field has been previously wrapped
        if (parent instanceof HTMLElement && parent.classList.contains('clr-field')) {
          parent.style.color = event.target.value;
        }
      }
    });
  }

  /**
   * Wrap the linked input fields in a div that adds a color preview.
   * @param selector One or more selectors pointing to input fields.
   */
  function wrapFields(selector: string): void {
    document.querySelectorAll(selector).forEach(field => {
      const parentNode = field.parentNode;

      if (field instanceof HTMLInputElement && parentNode instanceof HTMLElement && !parentNode.classList.contains('clr-field')) {
        const wrapper = document.createElement('div');

        wrapper.innerHTML = `<button aria-labelledby="clr-open-label"></button>`;
        parentNode.insertBefore(wrapper, field);
        wrapper.setAttribute('class', 'clr-field');
        wrapper.style.color = field.value;
        wrapper.appendChild(field);
      }
    });
  }

  /**
   * Close the color picker.
   * @param revert If true, revert the color to the original value.
   */
  function closePicker(revert?: boolean) {
    if (currentEl) {
      // Revert the color to the original value if needed
      if (revert && oldColor !== currentEl.value) {
        currentEl.value = oldColor;

        // Trigger an "input" event to force update the thumbnail next to the input field
        currentEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (oldColor !== currentEl.value) {
        currentEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      picker.classList.remove('clr-open');
      currentEl.focus({ preventScroll: true });
      currentEl = null;
    }
  }

  /**
   * Set the active color from a string.
   * @param {string} str String representing a color.
   */
  function setColorFromStr(str: string): void {
    const rgba = strToRGBA(str);
    const hsva = RGBAtoHSVA(rgba);

    updateMarkerA11yLabel(hsva.s, hsva.v);
    updateColor(rgba, hsva);

    // Update the UI
    hueSlider.value = String(hsva.h);
    picker.style.color = `hsl(${hsva.h}, 100%, 50%)`;
    hueMarker.style.left = `${hsva.h / 360 * 100}%`;

    colorMarker.style.left = `${colorAreaDims.width * hsva.s / 100}px`;
    colorMarker.style.top = `${colorAreaDims.height - (colorAreaDims.height * hsva.v / 100)}px`;

    alphaSlider.value = String(hsva.a * 100);
    alphaMarker.style.left = `${hsva.a * 100}%`;
  }

  /**
   * Copy the active color to the linked input field.
   * @param color Color value to override the active color.
   */
  function pickColor(color?: number | string): void {
    if (currentEl) {
      currentEl.value = color !== undefined ? String(color) : colorValue.value;
      currentEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Set the active color based on a specific point in the color gradient.
   * @param x Left position.
   * @param y Top position.
   */
  function setColorAtPosition(x: number, y: number): void {
    const hsva = {
      h: parseFloat(hueSlider.value),
      s: x / colorAreaDims.width * 100,
      v: 100 - (y / colorAreaDims.height * 100),
      a: parseFloat(alphaSlider.value) / 100
    };
    const rgba = HSVAtoRGBA(hsva);

    updateMarkerA11yLabel(hsva.s, hsva.v);
    updateColor(rgba, hsva);
    pickColor();
  }

  /**
   * Update the color marker's accessibility label.
   * @param saturation
   * @param value
   */
  function updateMarkerA11yLabel(saturation: number, value: number): void {
    let label = settings.a11y.marker;
    label = label.replace('{s}', saturation.toFixed(1));
    label = label.replace('{v}', value.toFixed(1));
    colorMarker.setAttribute('aria-label', label);
  }

  // 
  /**
   * Get the pageX and pageY positions of the pointer.
   * @param event The MouseEvent or TouchEvent object.
   * @return The pageX and pageY positions.
   */
  function getPointerPosition(event: TouchEvent | MouseEvent): PagePosition {
    if (event instanceof MouseEvent) {
      return {
        pageX: event.pageX,
        pageY: event.pageY,
      };
    }
    else {
      return {
        pageX: event.changedTouches[0].pageX,
        pageY: event.changedTouches[0].pageY,
      };
    }
  }

  /**
   * Move the color marker when dragged.
   * @param event The MouseEvent object.
   */
  function moveMarker(event: Event) {
    if (!(typeof TouchEvent === "function" && event instanceof TouchEvent) && !(event instanceof MouseEvent)) {
      return;
    }

    const pointer = getPointerPosition(event);
    let x = pointer.pageX - colorAreaDims.x;
    let y = pointer.pageY - colorAreaDims.y;

    if (settings.parent) {
      y += settings.parent.scrollTop;
    }

    x = (x < 0) ? 0 : (x > colorAreaDims.width) ? colorAreaDims.width : x;
    y = (y < 0) ? 0 : (y > colorAreaDims.height) ? colorAreaDims.height : y;

    colorMarker.style.left = `${x}px`;
    colorMarker.style.top = `${y}px`;

    setColorAtPosition(x, y);

    // Prevent scrolling while dragging the marker
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Move the color marker when the arrow keys are pressed.
   * @param offsetX The horizontal amount to move.
   * @param offsetY The vertical amount to move.
   */
  function moveMarkerOnKeydown(offsetX: number, offsetY: number): void {
    const x = parseFloat(colorMarker.style.left.replace('px', '')) + offsetX;
    const y = parseFloat(colorMarker.style.top.replace('px', '')) + offsetY;

    colorMarker.style.left = `${x}px`;
    colorMarker.style.top = `${y}px`;

    setColorAtPosition(x, y);
  }

  /**
   * Update the color picker's input field and preview thumb.
   * @param rgba Red, green, blue and alpha values.
   * @param hsva Hue, saturation, value and alpha values.
   */
  function updateColor(rgba: Partial<RgbaColor>, hsva = {}) {
    Object.assign(currentColor, rgba);
    Object.assign(currentColor, hsva);

    const hex = RGBAToHex(currentColor);
    const opaqueHex = hex.substring(0, 7);

    colorMarker.style.color = opaqueHex;
    if (alphaMarker.parentNode instanceof HTMLElement) {
      alphaMarker.parentNode.style.color = opaqueHex;
    }
    alphaMarker.style.color = hex;
    colorPreview.style.color = hex;
    colorValue.value = hex;

    // Force repaint the color and alpha gradients as a workaround for a Google Chrome bug
    colorArea.style.display = 'none';
    colorArea.offsetHeight;
    colorArea.style.display = '';
    if (alphaMarker.nextElementSibling instanceof HTMLElement) {
      alphaMarker.nextElementSibling.style.display = 'none';
      alphaMarker.nextElementSibling.offsetHeight;
      alphaMarker.nextElementSibling.style.display = '';
    }

    switch (settings.format) {
      case 'mixed':
        if (currentColor.a === 1) {
          break;
        }
      case 'rgb':
        colorValue.value = RGBAToStr(currentColor);
        break;
      case 'hsl':
        colorValue.value = HSLAToStr(HSVAtoHSLA(currentColor));
        break;
    }
  }

  /**
   * Set the hue when its slider is moved.
   */
  function setHue(): void {
    const hue = parseFloat(hueSlider.value);
    const x = parseFloat(colorMarker.style.left.replace('px', ''));
    const y = parseFloat(colorMarker.style.top.replace('px', ''));

    picker.style.color = `hsl(${hue}, 100%, 50%)`;
    hueMarker.style.left = `${hue / 360 * 100}%`;

    setColorAtPosition(x, y);
  }

  /**
   * Set the alpha when its slider is moved.
   */
  function setAlpha() {
    const alpha = parseFloat(alphaSlider.value) / 100;

    alphaMarker.style.left = `${alpha * 100}%`;
    updateColor({ a: alpha });
    pickColor();
  }

  /**
   * Convert HSVA to RGBA.
   * @param hsva Hue, saturation, value and alpha values.
   * @return Red, green, blue and alpha values.
   */
  function HSVAtoRGBA(hsva: HsvaColor) {
    const saturation = hsva.s / 100;
    const value = hsva.v / 100;
    let chroma = saturation * value;
    let hueBy60 = hsva.h / 60;
    let x = chroma * (1 - Math.abs(hueBy60 % 2 - 1));
    let m = value - chroma;

    chroma = (chroma + m);
    x = (x + m);
    m = m;

    const index = Math.floor(hueBy60) % 6;
    const red = [chroma, x, m, m, x, chroma][index];
    const green = [x, chroma, chroma, x, m, m][index];
    const blue = [m, m, x, chroma, chroma, x][index];

    return {
      r: Math.round(red * 255),
      g: Math.round(green * 255),
      b: Math.round(blue * 255),
      a: hsva.a
    }
  }

  /**
   * Convert HSVA to HSLA.
   * @param hsva Hue, saturation, value and alpha values.
   * @return Hue, saturation, lightness and alpha values.
   */
  function HSVAtoHSLA(hsva: HsvaColor): HslaColor {
    const value = hsva.v / 100;
    const lightness = value * (1 - (hsva.s / 100) / 2);
    let saturation;

    if (lightness > 0 && lightness < 1) {
      saturation = Math.round((value - lightness) / Math.min(lightness, 1 - lightness) * 100);
    }

    return {
      h: hsva.h,
      s: saturation || 0,
      l: Math.round(lightness * 100),
      a: hsva.a
    }
  }

  /**
   * Convert RGBA to HSVA.
   * @param {object} rgba Red, green, blue and alpha values.
   * @return {object} Hue, saturation, value and alpha values.
   */
  function RGBAtoHSVA(rgba: RgbaColor): HsvaColor {
    const red = rgba.r / 255;
    const green = rgba.g / 255;
    const blue = rgba.b / 255;
    const xmax = Math.max(red, green, blue);
    const xmin = Math.min(red, green, blue);
    const chroma = xmax - xmin;
    const value = xmax;
    let hue = 0;
    let saturation = 0;

    if (chroma) {
      if (xmax === red) { hue = ((green - blue) / chroma); }
      if (xmax === green) { hue = 2 + (blue - red) / chroma; }
      if (xmax === blue) { hue = 4 + (red - green) / chroma; }
      if (xmax) { saturation = chroma / xmax; }
    }

    hue = Math.floor(hue * 60);

    return {
      h: hue < 0 ? hue + 360 : hue,
      s: Math.round(saturation * 100),
      v: Math.round(value * 100),
      a: rgba.a
    }
  }

  /**
   * Parse a string to RGBA.
   * @param str String representing a color.
   * @return Red, green, blue and alpha values.
   */
  function strToRGBA(str: string): RgbaColor {
    const regex = /^((rgba)|rgb)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]*?([\d.]+|$)/i;
    let match, rgba;

    // Default to black for invalid color strings
    ctx.fillStyle = '#000';

    // Use canvas to convert the string to a valid color string 
    ctx.fillStyle = str;
    match = regex.exec(ctx.fillStyle);

    if (match) {
      rgba = {
        r: parseFloat(match[3]),
        g: parseFloat(match[4]),
        b: parseFloat(match[5]),
        a: parseFloat(match[6]),
      };

    } else {
      match = (ctx.fillStyle.replace('#', '').match(/.{2}/g) ?? []).map(h => parseInt(h, 16));
      rgba = {
        r: match[0],
        g: match[1],
        b: match[2],
        a: 1
      };
    }

    return rgba;
  }

  /**
   * Convert RGBA to Hex.
   * @param rgba Red, green, blue and alpha values.
   * @return Hex color string.
   */
  function RGBAToHex(rgba: RgbaColor): string {
    let R = rgba.r.toString(16);
    let G = rgba.g.toString(16);
    let B = rgba.b.toString(16);
    let A = '';

    if (rgba.r < 16) {
      R = '0' + R;
    }

    if (rgba.g < 16) {
      G = '0' + G;
    }

    if (rgba.b < 16) {
      B = '0' + B;
    }

    if (settings.alpha && rgba.a < 1) {
      const alpha = rgba.a * 255 | 0;
      A = alpha.toString(16);

      if (alpha < 16) {
        A = '0' + A;
      }
    }

    return '#' + R + G + B + A;
  }

  /**
   * Convert RGBA values to a CSS rgb/rgba string.
   * @param rgba Red, green, blue and alpha values.
   * @return CSS color string.
   */
  function RGBAToStr(rgba: RgbaColor): string {
    if (!settings.alpha || rgba.a === 1) {
      return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
    } else {
      return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
    }
  }

  /**
   * Convert HSLA values to a CSS hsl/hsla string.
   * @param hsla Hue, saturation, lightness and alpha values.
   * @return CSS color string.
   */
  function HSLAToStr(hsla: HslaColor): string {
    if (!settings.alpha || hsla.a === 1) {
      return `hsl(${hsla.h}, ${hsla.s}%, ${hsla.l}%)`;
    } else {
      return `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`;
    }
  }

  /**
   * Init the color picker.
   */
  function init(): void {
    // Render the UI
    picker = document.createElement('div');
    picker.setAttribute('id', 'clr-picker');
    picker.className = 'clr-picker';
    picker.innerHTML =
      `<input id="clr-color-value" class="clr-color" type="text" value="" aria-label="${settings.a11y.input}">` +
      `<div id="clr-color-area" class="clr-gradient" role="application" aria-label="${settings.a11y.instruction}">` +
      '<div id="clr-color-marker" class="clr-marker" tabindex="0"></div>' +
      '</div>' +
      '<div class="clr-hue">' +
      `<input id="clr-hue-slider" type="range" min="0" max="360" step="1" aria-label="${settings.a11y.hueSlider}">` +
      '<div id="clr-hue-marker"></div>' +
      '</div>' +
      '<div class="clr-alpha">' +
      `<input id="clr-alpha-slider" type="range" min="0" max="100" step="1" aria-label="${settings.a11y.alphaSlider}">` +
      '<div id="clr-alpha-marker"></div>' +
      '<span></span>' +
      '</div>' +
      '<div id="clr-swatches" class="clr-swatches"></div>' +
      `<button id="clr-clear" class="clr-clear">${settings.clearButton.label}</button>` +
      `<button id="clr-color-preview" class="clr-preview" aria-label="${settings.a11y.close}"></button>` +
      `<span id="clr-open-label" hidden>${settings.a11y.open}</span>` +
      `<span id="clr-swatch-label" hidden>${settings.a11y.swatch}</span>`;

    // Append the color picker to the DOM
    document.body.appendChild(picker);

    // Reference the UI elements
    colorArea = getElAs('clr-color-area', HTMLElement);
    colorMarker = getElAs('clr-color-marker', HTMLElement);
    clearButton = getElAs('clr-clear', HTMLButtonElement);
    colorPreview = getElAs('clr-color-preview', HTMLElement);
    colorValue = getElAs('clr-color-value', HTMLInputElement);
    hueSlider = getElAs('clr-hue-slider', HTMLInputElement);
    hueMarker = getElAs('clr-hue-marker', HTMLElement);
    alphaSlider = getElAs('clr-alpha-slider', HTMLInputElement);
    alphaMarker = getElAs('clr-alpha-marker', HTMLElement);

    // Bind the picker to the default selector
    bindFields(settings.el);
    wrapFields(settings.el);

    addListener(picker, 'mousedown', event => {
      picker.classList.remove('clr-keyboard-nav');
      event.stopPropagation();
    });

    addListener(colorArea, 'mousedown', () => {
      addListener(document, 'mousemove', moveMarker);
    });

    addListener(colorArea, 'touchstart', () => {
      document.addEventListener('touchmove', moveMarker, { passive: false })
    });

    addListener(colorMarker, 'mousedown', () => {
      addListener(document, 'mousemove', moveMarker);
    });

    addListener(colorMarker, 'touchstart', () => {
      document.addEventListener('touchmove', moveMarker, { passive: false })
    });

    addListener(colorValue, 'change', () => {
      setColorFromStr(colorValue.value);
      pickColor();
    });

    addListener(clearButton, 'click', () => {
      pickColor('');
      closePicker();
    });

    addListener(colorPreview, 'click', () => {
      pickColor();
      closePicker();
    });

    addDelegateListener(picker, 'click', '.clr-swatches button', event => {
      if (event.target instanceof HTMLElement) {
        setColorFromStr(event.target.style.color);
        pickColor();
      }
    });

    addListener(document, 'mouseup', () => {
      document.removeEventListener('mousemove', moveMarker);
    });

    addListener(document, 'touchend', () => {
      document.removeEventListener('touchmove', moveMarker);
    });

    addListener(document, 'mousedown', () => {
      picker.classList.remove('clr-keyboard-nav');
      closePicker();
    });

    addListener(document, 'keydown', event => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') {
          closePicker(true);
        } else if (event.key === 'Tab') {
          picker.classList.add('clr-keyboard-nav');
        }
      }
    });

    addDelegateListener(document, 'click', '.clr-field button', event => {
      if (event.target instanceof Element) {
        event.target.nextElementSibling?.dispatchEvent(new Event('click', { bubbles: true }));
      }
    });

    addListener(colorMarker, 'keydown', event => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }
      const movements: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
      };

      if (Object.keys(movements).indexOf(event.key) !== -1) {
        moveMarkerOnKeydown(...movements[event.key]);
        event.preventDefault();
      }
    });

    addListener(colorArea, 'click', moveMarker);
    addListener(hueSlider, 'input', setHue);
    addListener(alphaSlider, 'input', setAlpha);
  }

  /**
   * Shortcut for getElementById to optimize the minified JS.
   * @param id The element id.
   * @return The DOM element with the provided id.
   */
  function getEl(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  /**
   * Shortcut for getElementById to optimize the minified JS.
   * @param id The element id.
   * @return The DOM element with the provided id.
   */
  function getElAs<T extends HTMLElement>(id: string, type: new (...args: never[]) => T): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Expected to find element with ID ${id}, but no such element exists.`);
    }
    if (!(typeof type === "function" && element instanceof type)) {
      throw new Error(`Expected element with ${id} to be ${type}, but got ${element}.`);
    }
    return element;
  }

  /**
   * Shortcut for addEventListener to optimize the minified JS.
   * @param context The context to which the listener is attached.
   * @param type Event type.
   * @param fn Event handler.
   */
  function addListener(context: HTMLElement | Document, type: string, fn: (event: Event) => void): void {
    context.addEventListener(type, fn);
  }

  /**
   * Shortcut for addEventListener to optimize the minified JS.
   * @param context The context to which the listener is attached.
   * @param type Event type.
   * @param selector Event target if delegation is used.
   * @param fn Event handler.
   */
  function addDelegateListener(context: HTMLElement | Document, type: string, selector: string, fn: (event: Event) => void): void {
    const matches = Element.prototype.matches
      // @ts-expect-error
      || Element.prototype.msMatchesSelector;
    context.addEventListener(type, event => {
      if (matches.call(event.target, selector)) {
        fn.call(event.target, event);
      }
    });
  }

  /**
   * Call a function only when the DOM is ready.
   * @param fn The function to call.
   * @param args Arguments to pass to the function.
   */
  function DOMReady<A extends unknown[]>(fn: (...args: A) => void, args: A) {
    if (document.readyState !== 'loading') {
      fn(...args);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        fn(...args);
      });
    }
  }

  // Polyfill for NodeList.forEach
  if (NodeList !== undefined && NodeList.prototype && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = function (callbackFn, thisArg) {
      for (let index = 0; index < this.length; index += 1) {
        const item = this.item(index);
        if (item) {
          callbackFn.call(thisArg, item, index, this);
        }
      }
    };
  }

  const Coloris = (options: Coloris.ColorisOptions) => {
    DOMReady(() => {
      if (options) {
        if (typeof options === 'string') {
          bindFields(options);
        } else {
          configure(options);
        }
      }
    }, []);
  };

  Coloris.set = (options: Coloris.ColorisOptions) => DOMReady(configure, [options]);
  Coloris.wrap = (selector: string) => DOMReady(wrapFields, [selector]);
  Coloris.close = () => DOMReady(closePicker, []);

  // Expose the color picker to the global scope
  window["Coloris"] = Coloris;

  // Init the color picker when the DOM is ready
  DOMReady(init, []);

})(window, document, Math);
