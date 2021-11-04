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
