# Three MSDF Text WebGPU

Text rendering in Three.js with WebGPU using MSDF fonts.

Forked from [three-msdf-text-utils](https://github.com/leochocolat/three-msdf-text-utils).

## MSDFs Font

This package requires using MSDF fonts which can be created using either the [msdf-bmfont-xml](https://github.com/soimy/msdf-bmfont-xml) cmd line tool or with [Dom McCurdy's web tool](https://msdf-bmfont.donmccurdy.com/).

## Installation

```bash
npm install three-msdf-text-webgpu
```

## Usage

There are two main methods to create a MSDFText mesh:

### From Text
This method involves manually defining the text string along with various CSS options to determine how the mesh is rendered.

```js
import * as THREE from "three/webgpu";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { MSDFText, type BMFontJSON } from "three-msdf-text-webgpu";

const fontLoader = new FontLoader();
const textureLoader = new THREE.TextureLoader();

// Load generated MSDF font files
const font = await this.fontLoader.loadAsync("/font/Roboto-Regular-msdf.json"), 
const atlas = await this.textureLoader.loadAsync("/font/Roboto-Regular.png")

const options = {
    text: "MSDF Text",
    textStyles: {
      widthPx: 500,
      fontFamily: "Roboto",
      fontSize: 32,
      fontWeight: "400",
      lineHeightPx: 50,
      letterSpacingPx: 0,
      textAlign: 'left',
      whiteSpace: 'normal',
      color: '#ff0000',
      opacity: 1
    }
  }
const textMesh = new MSDFText(options, { atlas, data: font.data })
```

Note: The width/height of the resultant geometry will be equal to the pixel width/height of the rendered text, so the resulting mesh will need to be scaled.

The available options are:
- `text` (string: required)
- `textStyles`

With `textStyles`:
- `widthPx` (number: required) - Width of the text in pixels. Determines where text is wrapped.
- `fontFamily` (string): Default - Roboto
- `fontSize` (number px): Default - 16
- `fontWeight` (string): Default - "400"
- `fontStyle` (string): Default - "normal"
- `lineHeightPx` (number): Default - 16
- `letterSpacingPx` (number): Default - 0
- `textAlign` ("center" | "end" | "left" | "right" | "start"): Default - "left"
- `verticalAlign` ("top" | "center" | "bottom"): Default - "center"
- `whiteSpace` ("normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line" | "break-spaces"): Default - "normal"
- `color` (string): Default - "#000000"
- `opacity` (number): Default - 1

The method `.update(options)` can be called with partial options to update the text geometry and material.

### From DOM element
By passing a HTMLElement, the styling of the text will match that of the element.

```js
import * as THREE from "three/webgpu";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { MSDFText, type BMFontJSON } from "three-msdf-text-webgpu";

const fontLoader = new FontLoader();
const textureLoader = new THREE.TextureLoader();

// Load generated MSDF font files
const font = await this.fontLoader.loadAsync("/font/Roboto-Regular-msdf.json"), 
const atlas = await this.textureLoader.loadAsync("/font/Roboto-Regular.png")

const textElement = document.querySelector<HTMLDivElement>('[data-3d]')!;
const textMesh = new SyncMSDFText(
  textElement,
  { atlas, data: font.data as unknown as BMFontJSON },
)
```

Using this method also allows `mesh.update(camera: THREE.Camera)` to be called which will update the transform of the mesh to align with the DOM element in the camera's view at a given depth (5 units by default).

## Text Alignment

Control text positioning with `textAlign` and `verticalAlign`:

```js
const textMesh = new MSDFText({
  text: "Centered Text",
  textStyles: {
    widthPx: 500,
    textAlign: 'center',      // 'left' | 'center' | 'right' | 'start' | 'end'
    verticalAlign: 'center'   // 'top' | 'center' | 'bottom'
  }
}, { atlas, data: font.data })
```

When both are set to `'center'`, the text block is positioned at the mesh's origin (0, 0), making it easy to position in your scene.

## Per-Letter Color & Opacity

Customize individual letter colors and opacity using either static values or animated GPU-based effects.

### Static Per-Glyph Colors

Set colors for all glyphs at once:

```js
// Rainbow effect - each letter a different hue
const text = "Rainbow";
const colors = [];
for (let i = 0; i < text.length; i++) {
  const hue = i / text.length;
  colors.push({
    color: new THREE.Color().setHSL(hue, 1.0, 0.5),
    opacity: 1.0
  });
}
textMesh.setGlyphColors(colors);

// Gradient effect - interpolate between two colors
const start = new THREE.Color('#0066ff');
const end = new THREE.Color('#ff0066');
const gradientColors = [];
for (let i = 0; i < text.length; i++) {
  const t = i / (text.length - 1);
  gradientColors.push({
    color: new THREE.Color().lerpColors(start, end, t),
    opacity: 1.0
  });
}
textMesh.setGlyphColors(gradientColors);
```

Set a single glyph's color:

```js
// Make the first letter red with full opacity
textMesh.setGlyphColor(0, '#ff0000', 1.0);

// Make the third letter semi-transparent blue
textMesh.setGlyphColor(2, '#0000ff', 0.5);
```

Clear all per-glyph colors to revert to the material's base color:

```js
textMesh.clearGlyphColors();
```

### Animated Effects (TSL Nodes)

For GPU-accelerated animations, use Three.js Shading Language (TSL) nodes. The `glyphIndices` attribute provides the index of each letter for creating per-letter effects:

```js
import { attribute, float, mod, add, sin, sub, time, vec3, mx_hsvtorgb } from 'three/tsl';

// Animated rainbow - hue shifts over time per letter
const index = float(attribute('glyphIndices'));
const hue = mod(add(time.mul(0.5), index.mul(0.1)), 1.0);
const colorNode = mx_hsvtorgb(vec3(hue, 1.0, 1.0));
textMesh.material.letterColorNode = colorNode;

// Animated fade wave - opacity pulses through the text
const opacityNode = add(sin(sub(time.mul(3), index.mul(0.5))), 1.0).mul(0.5);
textMesh.material.letterOpacityNode = opacityNode;
```

Clear animated effects:

```js
textMesh.material.clearLetterEffects();
```

## Material Options

The `MSDFTextNodeMaterial` exposes additional properties:

```js
textMesh.material.color = '#ff0000';  // Base text color
textMesh.material.opacity = 0.8;      // Base opacity (0-1)
textMesh.material.isSmooth = true;    // Enable smooth rendering (auto-enabled for fontSize < 20)
textMesh.material.threshold = 0.2;    // Smoothing threshold (0-1)
```

## Examples:

See the [github pages site](https://casulornstein.github.io/three-msdf-text-webgpu/) for a sandbox demo.

To run the example demo locally, run:
```bash
npm i
npm run example
```

For more information on this package, see this [blog page](https://www.madewithdove.co.uk/blog/webgpu-text).