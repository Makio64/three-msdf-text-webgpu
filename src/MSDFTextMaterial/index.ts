// THREE WEBGPU
import * as THREE from 'three/webgpu'
import { uv, mix, uniform, texture, fwidth, clamp, smoothstep, max, min, div, sub, add, mul, oneMinus } from 'three/tsl';

// THREE
import { Color } from 'three';

export interface MSDFTextNodeMaterialOptions {
  transparent?: boolean,
  alphaTest?: number,
  opacity?: number,
  color?: THREE.ColorRepresentation,
  isSmooth?: number,
  threshold?: number,
  strokeColor?: THREE.ColorRepresentation,
  strokeOutsetWidth?: number,
  strokeInsetWidth?: number,
}

const defaultOptions = {
    transparent: true,
    opacity: 1,
    alphaTest: 0.01,
    threshold: 0.2,
    color: '#ffffff',
    strokeColor: '#000000',
    strokeOutsetWidth: 0,
    strokeInsetWidth: 0.3,
    isSmooth: 0,
};

export class MSDFTextNodeMaterial extends THREE.NodeMaterial {
  private map: THREE.Texture // MSDF atlas texture

  constructor(fontAtlas: THREE.Texture, options: MSDFTextNodeMaterialOptions = defaultOptions) {
    super();

    /**
     * Build in properties
     */
    this.transparent = options.transparent || defaultOptions.transparent;
    this.alphaTest = options.alphaTest || defaultOptions.alphaTest;

    /**
     * Uniforms: basic
     */
    const opacity = uniform(options?.opacity || defaultOptions.opacity);
    const color = uniform(new Color(options.color || defaultOptions.color));
    this.map = fontAtlas;

    /**
     * Uniforms small font sizes
     */
    const isSmooth = uniform(options.isSmooth || defaultOptions.isSmooth);
    const threshold = uniform(options.threshold || defaultOptions.threshold);

    /**
     * Uniforms: stroke
     */
    const strokeColor = uniform(new Color(options.strokeColor || defaultOptions.strokeColor));
    const strokeOutsetWidth = uniform(options.strokeOutsetWidth || defaultOptions.strokeOutsetWidth);
    const strokeInsetWidth = uniform(options.strokeInsetWidth || defaultOptions.strokeInsetWidth);

    const afwidth = 1.4142135623730951 / 2.0;
    const median = (r: THREE.Node, g: THREE.Node, b: THREE.Node) => max(min(r, g), min(max(r, g), b));

    /**
     * Texture Sampling
     */
    const s = texture(this.map, uv());

    /**
     * Fill
     */
    const sigDist = sub(median(s.r, s.g, s.b), 0.5);
    let alpha = clamp(add(div(sigDist, fwidth(sigDist)), 0.5), 0.0, 1.0);

    /**
     * Fill Smooth
     */
    const smoothAlpha = smoothstep(sub(threshold, afwidth), add(threshold, afwidth), sigDist);
    alpha = mix(alpha, smoothAlpha, isSmooth);

    /**
     * Strokes
     */
    const sigDistOutset = add(sigDist, mul(strokeOutsetWidth, 0.5));
    const sigDistInset = add(sigDist, mul(strokeOutsetWidth, 0.5));

    let outset = clamp(add(div(sigDistOutset, fwidth(sigDistOutset)), 0.5), 0.0, 1.0);
    let inset = oneMinus(clamp(add(div(sigDistInset, fwidth(sigDistInset)), 0.5), 0.0, 1.0));

    /**
     * Strokes Smooth
     */
    const smoothOutset = smoothstep(sub(threshold, afwidth), add(threshold, afwidth), sigDistOutset);
    const smoothInset = oneMinus(smoothstep(sub(threshold, afwidth), add(threshold, afwidth), sigDistInset));

    outset = mix(outset, smoothOutset, isSmooth);
    inset = mix(inset, smoothInset, isSmooth);

    const border = mul(outset, inset);

    /**
     * Outputs: filled
     */
    // this.colorNode = this.color;
    // this.opacityNode = mul(this.opacity, alpha);

    /**
     * Outputs: stroked
     */
    // this.colorNode = this.strokeColor;
    // this.opacityNode = mul(this.opacity, border);

    /**
     * Outputs: Filled + stroked
     */
    this.colorNode = mix(color, strokeColor, border);
    this.opacityNode = mul(opacity, add(alpha, border));
  }
}
