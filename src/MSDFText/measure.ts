export interface DomTextMetrics {
  text: string;
  fontCssStyles: DomStyleSnapshot;
  canvasRenderMeasurements: {
    width: number;
    actualAscent: number;
    actualDescent: number;
    fontAscent: number;
    fontDescent: number;
    baselineOffsetTop: number;
    baselineOffsetBottom: number;
    lineGap: number;
  };
  size: { width: number, height: number };
  element?: HTMLElement
}

interface DomStyleSnapshot {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: CanvasTextAlign;
  whiteSpace: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';
  color: string
}

const DEFAULT_FONT_STYLES: DomStyleSnapshot = {
  fontFamily: 'Roboto',
  fontSize: 16,
  fontWeight: '400',
  fontStyle: 'normal',
  lineHeight: 16,
  letterSpacing: 0,
  textAlign: 'left',
  whiteSpace: 'normal',
  color: '#000000'
}

let canvasContext: CanvasRenderingContext2D | null = null;

function getContext(): CanvasRenderingContext2D {
    if (canvasContext) {
        return canvasContext;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    canvasContext = canvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for font measurements.');
    }
    return canvasContext;
}

function parsePx(value: string): number {
  if (value === 'normal' || value === '' || value === 'initial' || value === 'inherit') {
      return NaN;
  }
  if (value.endsWith('px')) {
      return parseFloat(value);
  }
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function captureCssStyles(style: CSSStyleDeclaration): DomStyleSnapshot {
  return {
      fontFamily: style.fontFamily,
      fontSize: parsePx(style.fontSize) || 16,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      lineHeight: computeLineHeight(style, parsePx(style.fontSize) || 16),
      letterSpacing: parseLetterSpacing(style),
      textAlign: (style.textAlign as CanvasTextAlign) || 'left',
      whiteSpace: (style.whiteSpace as DomStyleSnapshot['whiteSpace']) || 'normal',
      color: style.color
  };
}

const DEFAULT_LINE_HEIGHT_RATIO = 1.2;

function computeLineHeight(style: CSSStyleDeclaration, fontSize: number): number {
  const parsed = parsePx(style.lineHeight);
  if (Number.isFinite(parsed)) {
      return parsed;
  }
  return fontSize * DEFAULT_LINE_HEIGHT_RATIO;
}

function parseLetterSpacing(style: CSSStyleDeclaration): number {
  const raw = style.letterSpacing;
  if (!raw || raw === 'normal') {
      return 0;
  }
  return parsePx(raw) || 0;
}

function getMeasurementFromCanvas(style: DomStyleSnapshot, text: string) {
  const ctx = getContext();
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  ctx.textAlign = style.textAlign;
  const metrics = ctx.measureText(text);

  const actualAscent = metrics.actualBoundingBoxAscent ?? 0;
  const actualDescent = metrics.actualBoundingBoxDescent ?? 0;
  const fontAscent = metrics.fontBoundingBoxAscent ?? actualAscent;
  const fontDescent = metrics.fontBoundingBoxDescent ?? actualDescent;

  const lineGap = Math.max(0, style.lineHeight - (actualAscent + actualDescent));
  const baselineOffsetTop = actualAscent + lineGap * 0.5;
  const baselineOffsetBottom = actualDescent + lineGap * 0.5;

  return {
      width: metrics.width,
      actualAscent,
      actualDescent,
      fontAscent,
      fontDescent,
      baselineOffsetTop,
      baselineOffsetBottom,
      lineGap,
  };
}

export function collectDomTextMetrics(element: HTMLElement): DomTextMetrics {
  const style = window.getComputedStyle(element);
  const fontCssStyles = captureCssStyles(style);
  const canvasRenderMeasurements = getMeasurementFromCanvas(fontCssStyles, element.textContent);
  
  const { width, height } = element.getBoundingClientRect()

  return {
    text: element.textContent,
    fontCssStyles,
    canvasRenderMeasurements,
    size: { width, height },
    element
  }
}

export type MetricsContsructionOptions = { width: number, height: number, cssStyles?: Partial<DomStyleSnapshot> }

export function constructDomTextMetrics(text: string, options: MetricsContsructionOptions = { width: 500, height: 500 }) {
  const cssStyles: DomStyleSnapshot = {...DEFAULT_FONT_STYLES, ...options.cssStyles }
  const canvasRenderMeasurements = getMeasurementFromCanvas(cssStyles, text);
  return {
    text,
    fontCssStyles: cssStyles,
    canvasRenderMeasurements,
    size: { width: options.width, height: options.height },
  }
}