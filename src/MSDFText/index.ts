import * as THREE from 'three/webgpu'
import { attribute } from 'three/tsl'

import type { BMFontJSON } from '@/types/bmfont-json'
import { MSDFTextGeometry } from '@/MSDFTextGeometry';
import { MSDFTextNodeMaterial } from '@/MSDFTextMaterial';
import { collectDomTextMetrics, constructDomTextMetrics, TextStyles } from '@/MSDFText/measure';

// Flexible input types for per-glyph colors
export type GlyphColorInput =
  | Float32Array                           // Raw RGBA float array (4 components per glyph)
  | THREE.Color[]                          // Array of THREE.Color (alpha = 1)
  | { color: THREE.ColorRepresentation; opacity?: number }[]  // Color + opacity objects
  | null;

export type MSDFTextOptions = { text: string, textStyles?: Partial<TextStyles>, glyphColors?: GlyphColorInput }

export class MSDFText extends THREE.Mesh<MSDFTextGeometry, MSDFTextNodeMaterial> {
  private _glyphColors: Float32Array | null = null
  private _usingAttributeColors: boolean = false

  constructor(options: MSDFTextOptions, font: { atlas: THREE.Texture, data: BMFontJSON }) {
    const metrics = constructDomTextMetrics(options)

    // Process glyph colors if provided
    const processedColors = options.glyphColors
      ? MSDFText.processGlyphColors(options.glyphColors, options.text.length)
      : null

    const geometry = new MSDFTextGeometry({ metrics, font: font.data, glyphColors: processedColors })
    const material = new MSDFTextNodeMaterial({ fontAtlas: font.atlas, metrics })

    super(geometry, material)
    this._glyphColors = processedColors

    // If initial glyph colors provided, set up attribute-based coloring
    if (processedColors) {
      this._enableAttributeColors()
    }
  }

  // Enable reading colors from the glyphColors attribute (color only, not opacity)
  private _enableAttributeColors() {
    if (this._usingAttributeColors) return
    const glyphColor = attribute('glyphColors')
    this.material.letterColorNode = glyphColor.rgb
    // Note: We don't set letterOpacityNode here so animated opacity effects can be combined
    this._usingAttributeColors = true
  }

  public update(options: Partial<MSDFTextOptions>) {
    const currentOptions = this.getCurrentOptions()
    const mergedOptions: MSDFTextOptions = { ...currentOptions, ...options, textStyles: { ...currentOptions.textStyles, ...options.textStyles } }
    const metrics = constructDomTextMetrics(mergedOptions)

    // Process glyph colors if provided in update
    if (options.glyphColors !== undefined) {
      this._glyphColors = options.glyphColors
        ? MSDFText.processGlyphColors(options.glyphColors, mergedOptions.text.length)
        : null
      if (this._glyphColors) {
        this._enableAttributeColors()
      } else {
        this.material.letterColorNode = null  // Only clear color, keep opacity effects
        this._usingAttributeColors = false
      }
    }

    this.geometry.update(metrics, this._glyphColors)
    this.material.update(metrics)
  }

  // Set colors for all glyphs at once (updates geometry attribute, keeps opacity effects)
  public setGlyphColors(colors: GlyphColorInput) {
    const glyphCount = this.geometry.glyphCount
    this._glyphColors = colors
      ? MSDFText.processGlyphColors(colors, glyphCount)
      : null

    this.geometry.setGlyphColors(this._glyphColors)

    if (this._glyphColors) {
      this._enableAttributeColors()
    } else {
      this.material.letterColorNode = null  // Only clear color, keep opacity effects
      this._usingAttributeColors = false
    }
  }

  // Set color for a single glyph
  public setGlyphColor(index: number, color: THREE.ColorRepresentation, opacity: number = 1.0) {
    const glyphCount = this.geometry.glyphCount
    if (index < 0 || index >= glyphCount) return

    // Initialize colors array if needed (default to white with full opacity)
    if (!this._glyphColors) {
      this._glyphColors = new Float32Array(glyphCount * 4)
      for (let i = 0; i < glyphCount; i++) {
        this._glyphColors[i * 4] = 1.0
        this._glyphColors[i * 4 + 1] = 1.0
        this._glyphColors[i * 4 + 2] = 1.0
        this._glyphColors[i * 4 + 3] = 1.0
      }
    }

    const threeColor = new THREE.Color(color)
    const offset = index * 4
    this._glyphColors[offset] = threeColor.r
    this._glyphColors[offset + 1] = threeColor.g
    this._glyphColors[offset + 2] = threeColor.b
    this._glyphColors[offset + 3] = opacity

    this.geometry.setGlyphColors(this._glyphColors)
    this._enableAttributeColors()
  }

  // Clear all per-glyph colors (revert to uniform color, keeps opacity effects)
  public clearGlyphColors() {
    this._glyphColors = null
    this.geometry.setGlyphColors(null)
    this.material.letterColorNode = null  // Only clear color, keep opacity effects
    this._usingAttributeColors = false
  }

  // Static helper to convert various input formats to Float32Array
  private static processGlyphColors(input: GlyphColorInput, glyphCount: number): Float32Array | null {
    if (!input) return null

    // Already a Float32Array
    if (input instanceof Float32Array) {
      return input
    }

    // Array of THREE.Color or {color, opacity} objects
    if (Array.isArray(input) && input.length > 0) {
      const result = new Float32Array(glyphCount * 4)

      for (let i = 0; i < glyphCount; i++) {
        const entry = input[i % input.length] // Repeat if fewer colors than glyphs
        const offset = i * 4

        if (entry instanceof THREE.Color) {
          result[offset] = entry.r
          result[offset + 1] = entry.g
          result[offset + 2] = entry.b
          result[offset + 3] = 1.0 // Default full opacity
        } else if (typeof entry === 'object' && 'color' in entry) {
          const color = new THREE.Color(entry.color)
          result[offset] = color.r
          result[offset + 1] = color.g
          result[offset + 2] = color.b
          result[offset + 3] = entry.opacity ?? 1.0
        }
      }

      return result
    }

    return null
  }

  private getCurrentOptions(): MSDFTextOptions {
    return {
      text: this.geometry.text,
      textStyles: {
        ...this.geometry.textStyles,
        color: this.material.color,
        opacity: this.material.opacity
      },
      glyphColors: this._glyphColors
    }
  }
}

export class SyncMSDFText extends THREE.Mesh<MSDFTextGeometry, MSDFTextNodeMaterial> {
  readonly element: HTMLElement | undefined
  
  constructor(element: HTMLElement, font: { atlas: THREE.Texture, data: BMFontJSON }) {
    const metrics = collectDomTextMetrics(element)
        
    const geometry = new MSDFTextGeometry({ metrics, font: font.data })
    const material = new MSDFTextNodeMaterial({ fontAtlas: font.atlas, metrics })
    
    super(geometry, material)
    
    this.element = element
  }

  // Update the transform of the mesh to match the position of a DOM element on a perpendicular plane at a given depth from the camera
  public update(camera: { position: THREE.Vector3, quaternion: THREE.Quaternion, fov: number, aspect: number }, depthFromCamera: number = 5) {
    if (!this.element) {
      console.log("Unable to align MSDFText with element when using the fromString constructor")
      return
    }
    
    const { top, left } = this.element.getBoundingClientRect()

    const yFovRadians = camera.fov * (Math.PI / 180);
    const window3DHeight = 2 * Math.abs(depthFromCamera) * Math.tan(yFovRadians / 2);
    const window3DWidth = window3DHeight * camera.aspect;

    const positionCameraSpace = new THREE.Vector3(
      -(window3DWidth / 2) + (left / window.innerWidth)*window3DWidth,
      (window3DHeight / 2) - (top / window.innerHeight)*window3DHeight,
      -depthFromCamera,
    )

    const matrixWorld = new THREE.Matrix4();
    matrixWorld.compose(camera.position, camera.quaternion, new THREE.Vector3(1,1,1));
  
    const positionWorldSpace = positionCameraSpace.clone().applyMatrix4(matrixWorld)
    const quaternionWorldSpace = new THREE.Quaternion().setFromRotationMatrix(matrixWorld);

    const scaleX = (window3DWidth / window.innerWidth)

    this.scale.set(scaleX, scaleX, 1)
    this.position.copy(positionWorldSpace)
    this.quaternion.copy(quaternionWorldSpace)

    // Update geometry
    const metrics = collectDomTextMetrics(this.element)
    this.geometry.update(metrics)
    this.material.update(metrics)
  }
}