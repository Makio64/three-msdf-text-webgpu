import * as THREE from "three/webgpu";

import type { BMFontJSON } from "@/types/bmfont-json";
import { collectDomTextMetrics, TextStyles, type DomTextMetrics } from "@/MSDFText/measure";
import { layoutText } from "./layout";
import { buildGeometryAttributes } from "./geometry";

export interface MSDFTextGeometryOptions {
  font: BMFontJSON;
  metrics: DomTextMetrics;
  glyphColors?: Float32Array | null;
}

export class MSDFTextGeometry extends THREE.BufferGeometry {
  private width!: number;
  private height!: number;
  private verticalAlign: 'top' | 'center' | 'bottom' = 'top';
  private textAlign: 'left' | 'center' | 'right' | 'start' | 'end' = 'left';

  private currentMetrics!: DomTextMetrics // Metrics last used to generate the geometry
  private currentGlyphCount: number | null = null
  private font: BMFontJSON
  private _glyphColors: Float32Array | null = null

  get textStyles(): Omit<Partial<TextStyles>, 'color' | 'opacity'> {
    const { opacity, color, ...geometryStyles } = this.currentMetrics?.fontCssStyles || {}
    return geometryStyles
  }
  get text(): string {
    return this.currentMetrics?.text
  }
  get hasGlyphColors(): boolean {
    return this._glyphColors !== null && this._glyphColors.length > 0
  }
  get glyphCount(): number {
    return this.currentGlyphCount || 0
  }

  constructor(options: MSDFTextGeometryOptions) {
    super();

    this.font = options.font;
    this._glyphColors = options.glyphColors ?? null;
    this.update(options.metrics)
  }

  computeBoundingBox(): void {
    const xOffset = this.textAlign === 'center' ? -this.width / 2 : (this.textAlign === 'right' || this.textAlign === 'end') ? -this.width : 0;
    const yOffset = this.verticalAlign === 'center' ? -this.height / 2 : this.verticalAlign === 'top' ? -this.height : 0;

    this.boundingBox = new THREE.Box3(
      new THREE.Vector3(xOffset, yOffset, 0),
      new THREE.Vector3(xOffset + this.width, yOffset + this.height, 0)
    )
  }

  public update(metrics: DomTextMetrics, glyphColors?: Float32Array | null) {
    // Update stored colors if provided
    if (glyphColors !== undefined) {
      this._glyphColors = glyphColors;
    }

    // TODO: Compare against previously given metrics before recalculating
    const { glyphs, width, height } = layoutText({ metrics, font: this.font });
    const { positions, uvs, centers, indices, glyphIndices, glyphColors: builtColors, glyphCount } = buildGeometryAttributes({
      glyphs,
      font: this.font,
      flipY: true,
      glyphColors: this._glyphColors
    })

    this.width = width;
    this.height = height;
    this.verticalAlign = metrics.fontCssStyles.verticalAlign;
    this.textAlign = metrics.fontCssStyles.textAlign;

    // If number of glyphs is the same, attr array lengths are the same and can update in place
    // Slightly more efficient as reuses existing GPU buffer
    if (this.currentGlyphCount == glyphCount) {
      this.attributes.position.array.set(positions)
      this.attributes.uv.array.set(uvs)
      this.attributes.center.array.set(centers)
      this.attributes.glyphColors.array.set(builtColors)

      this.attributes.position.needsUpdate = true;
      this.attributes.uv.needsUpdate = true;
      this.attributes.center.needsUpdate = true;
      this.attributes.glyphColors.needsUpdate = true;
    } else {
      this.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      this.setAttribute('center', new THREE.BufferAttribute(centers, 2));
      this.setAttribute('glyphIndices', new THREE.BufferAttribute(glyphIndices, 1));
      this.setAttribute('glyphColors', new THREE.BufferAttribute(builtColors, 4));
      this.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    this.computeBoundingBox();
    this.computeBoundingSphere();

    // Cache the previous metrics used to generate the geometry
    this.currentMetrics = metrics
    this.currentGlyphCount = glyphCount
  }

  public setGlyphColors(colors: Float32Array | null) {
    this._glyphColors = colors;

    // Rebuild the color attribute (always exists, defaults to white)
    const glyphCount = this.currentGlyphCount || 0;
    const builtColors = new Float32Array(glyphCount * 4 * 4);

    for (let i = 0; i < glyphCount; i++) {
      const colorIndex = i * 16;
      const srcIndex = i * 4;

      const r = colors?.[srcIndex] ?? 1.0;
      const g = colors?.[srcIndex + 1] ?? 1.0;
      const b = colors?.[srcIndex + 2] ?? 1.0;
      const a = colors?.[srcIndex + 3] ?? 1.0;

      for (let v = 0; v < 4; v++) {
        const offset = colorIndex + v * 4;
        builtColors[offset] = r;
        builtColors[offset + 1] = g;
        builtColors[offset + 2] = b;
        builtColors[offset + 3] = a;
      }
    }

    if (this.attributes.glyphColors) {
      (this.attributes.glyphColors.array as Float32Array).set(builtColors);
      this.attributes.glyphColors.needsUpdate = true;
    } else {
      this.setAttribute('glyphColors', new THREE.BufferAttribute(builtColors, 4));
    }
  }
} 