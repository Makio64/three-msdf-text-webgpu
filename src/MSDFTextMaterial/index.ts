import * as THREE from 'three/webgpu'
import { uv, mix, uniform, texture, fwidth, clamp, smoothstep, max, min, div, sub, add, mul, oneMinus, materialOpacity, float, vec3 } from 'three/tsl';

import { DomTextMetrics } from '@/MSDFText/measure';

export interface MSDFTextNodeMaterialOptions {
  transparent: boolean,
  alphaTest: number,
  isSmooth: number,
  threshold: number,
}

export class MSDFTextNodeMaterial extends THREE.NodeMaterial {
  private map: THREE.Texture // MSDF atlas texture

  private colorUniform: THREE.UniformNode<THREE.Color> = uniform(new THREE.Color('#ffffff'))
  private isSmoothUniform: THREE.UniformNode<number> = uniform(0)
  private thresholdUniform: THREE.UniformNode<number> = uniform(0.2)

  readonly defaultColorNode: THREE.Node
  readonly defaultOpacityNode: THREE.Node

  // TSL nodes for per-letter effects (can be set by user for animated effects)
  private _letterColorNode: THREE.Node = vec3(1.0, 1.0, 1.0)
  private _letterOpacityNode: THREE.Node = float(1.0)

  // Internal nodes for rebuilding output
  private _alphaNode!: THREE.Node
  private _strokeColorNode!: THREE.Node
  private _borderNode!: THREE.Node

  // Getters & Setters
  public get color() { return `#${this.colorUniform.value.getHexString()}` }
  public set color(val: THREE.ColorRepresentation) { this.colorUniform.value.set(val) }

  public get isSmooth() { return Boolean(this.isSmoothUniform.value) }
  public set isSmooth(val: boolean) { this.isSmoothUniform.value = val ? 1 : 0 }

  public get threshold() { return this.thresholdUniform.value }
  public set threshold(val: number) { this.thresholdUniform.value = THREE.MathUtils.clamp(val, 0, 1) }

  // Per-letter TSL nodes (set these for animated per-letter effects)
  public get letterColorNode() { return this._letterColorNode }
  public set letterColorNode(node: THREE.Node | null) {
    this._letterColorNode = node ?? vec3(1.0, 1.0, 1.0)
    this.rebuildOutputNodes()
  }

  public get letterOpacityNode() { return this._letterOpacityNode }
  public set letterOpacityNode(node: THREE.Node | null) {
    this._letterOpacityNode = node ?? float(1.0)
    this.rebuildOutputNodes()
  }

  constructor(options: { fontAtlas: THREE.Texture, metrics: DomTextMetrics }) {
    super();

    const { fontAtlas, metrics } = options

    // Set defaults
    this.alphaTest = 0.01
    this.transparent = true
    this.map = fontAtlas;

    this.update(metrics)

    // Set default is smooth
    const defaultIsSmooth = metrics.fontCssStyles.fontSize < 20 ? 1 : 0;
    this.isSmoothUniform.value = defaultIsSmooth

    /**
     * Uniforms: stroke
     */
    // TODO: Fix stroke rendering
    const _strokeColor = new THREE.Color('#000000')
    const _stokeWidth = 0
    this._strokeColorNode = uniform(_strokeColor);
    const strokeOutsetWidth = uniform(_stokeWidth);

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
    const smoothAlpha = smoothstep(sub(this.thresholdUniform, afwidth), add(this.thresholdUniform, afwidth), sigDist);
    alpha = mix(alpha, smoothAlpha, this.isSmoothUniform);
    this._alphaNode = alpha;

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
    const smoothOutset = smoothstep(sub(this.thresholdUniform, afwidth), add(this.thresholdUniform, afwidth), sigDistOutset);
    const smoothInset = oneMinus(smoothstep(sub(this.thresholdUniform, afwidth), add(this.thresholdUniform, afwidth), sigDistInset));

    outset = mix(outset, smoothOutset, this.isSmoothUniform);
    inset = mix(inset, smoothInset, this.isSmoothUniform);

    this._borderNode = mul(outset, inset);

    /**
     * Build default output nodes
     */
    this.defaultColorNode = mix(mul(this.colorUniform, this._letterColorNode), this._strokeColorNode, this._borderNode);
    this.defaultOpacityNode = mul(mul(materialOpacity, this._letterOpacityNode), add(this._alphaNode, this._borderNode));

    this.colorNode = this.defaultColorNode;
    this.opacityNode = this.defaultOpacityNode;
  }

  private rebuildOutputNodes() {
    // Rebuild color and opacity nodes with new letter nodes
    this.colorNode = mix(mul(this.colorUniform, this._letterColorNode), this._strokeColorNode, this._borderNode);
    this.opacityNode = mul(mul(materialOpacity, this._letterOpacityNode), add(this._alphaNode, this._borderNode));
    this.needsUpdate = true
  }

  public update(metrics: DomTextMetrics) {
    this.colorUniform.value.set(metrics.fontCssStyles.color)
    this.opacity = metrics.fontCssStyles.opacity

    this.needsUpdate = true
  }

  // Clear per-letter effects (reset to defaults)
  public clearLetterEffects() {
    this._letterColorNode = vec3(1.0, 1.0, 1.0)
    this._letterOpacityNode = float(1.0)
    this.rebuildOutputNodes()
  }
}
