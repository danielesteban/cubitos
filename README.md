[cubitos](https://github.com/danielesteban/cubitos/)
[![npm-version](https://img.shields.io/npm/v/cubitos.svg)](https://www.npmjs.com/package/cubitos)
==

[![screenshot](example/public/screenshot.png)](https://github.com/danielesteban/cubitos)

### Examples

* World:
  * Demo: [cubitos.gatunes.com](https://cubitos.gatunes.com)
  * Source: [example/src/gameplay.js](example/src/gameplay.js)

* Random walkers:
  * Demo: [cubitos-walkers.glitch.me](https://cubitos-walkers.glitch.me)
  * Source: [glitch.com/edit/#!/cubitos-walkers](https://glitch.com/edit/#!/cubitos-walkers)
  * Demo (react-three-fiber): [bp2ljx.csb.app](https://bp2ljx.csb.app)
  * Source (react-three-fiber): [codesandbox.io/s/cubitos-bp2ljx](https://codesandbox.io/s/cubitos-bp2ljx)

### Installation

```bash
npm install cubitos
```

### Basic usage

```js
import { ChunkMaterial, Volume, World } from 'cubitos';
import { PerspectiveCamera, Scene, sRGBEncoding, WebGLRenderer } from 'three';

const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.1, 1000);
const renderer = new WebGLRenderer({ antialias: true });
const scene = new Scene();
camera.position.set(64, 64, 64);
renderer.outputEncoding = sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(() => renderer.render(scene, camera));

const volume = new Volume({
  width: 128,
  height: 128,
  depth: 128,
  onLoad: () => {
    const world = new World({
      material: new ChunkMaterial({ light: false }),
      volume,
    });
    world.update({ x: 64, y: 64, z: 60 }, 2, 1);
    scene.add(world);
  },
});
```

### ChunkMaterial

```js
new ChunkMaterial({
  // A DataArrayTexture or Texture to use as the atlas
  atlas: new Texture(),
  // Light === max(ambientColor, lightColor * lightLevel);
  ambientColor: new Color(0, 0, 0),
  lightColor: new Color(1, 1, 1),
  // Enable/Disable lighting (default: true)
  light: true,
});
```

### Volume

```js
const volume = new Volume({
  // Volume width
  width: 128,
  // Volume height
  height: 128,
  // Volume depth
  depth: 128,
  // Render chunks size (default: 32)
  chunkSize: 32,
  // Will be called by the mesher to determine a texture from the atlas (optional)
  mapping: (face, value, x, y, z) => (value - 1),
  // Will be called when the volume has allocated the memory and is ready. (optional)
  onLoad: () => {
    // Generates terrain in a worker
    Worldgen({
      // Noise frequency (default: 0.01)
      frequency: 0.01,
      // Noise gain (default: 0.5)
      gain: 0.5,
      // Noise lacunarity (default: 2)
      lacunarity: 2,
      // Noise octaves (default: 3)
      octaves: 3,
      // Noise seed (default: random)
      seed = 1337,
      // Volume instance
      volume,
    })
      .then(() => {
        // Runs the initial light propagation
        volume.propagate();
      })
  },
  // Will be called if there's an error loading the volume. (optional)
  onError: () => {},
});

// Returns the closest ground
// to a position where the height fits
const ground = volume.ground(
  // Position
  new Vector3(0, 0, 0),
  // Height (default: 1)
  4
);

// Returns a list of positions
// to move an actor from A to B
const path = volume.pathfind({
  // Starting position
  from: new Vector3(0, 0, 0),
  // Destination
  to: new Vector3(0, 10, 0),
  // Minimum height it can go through (default: 1)
  height: 4,
  // Maximum nodes it can visit before it bails (default: 4096)
  maxVisited: 2048,
  // Minimum Y it can step at (default: 0)
  minY: 0,
  // Maximum Y it can step at (default: Infinity)
  maxY: Infinity,
});
```

### World

```js
const world = new World({
  // ChunkMaterial (or compatible material)
  material,
  // Volume instance
  volume,
});

world.update(
  // Position
  new Vector3(0, 0, 0),
  // Radius
  1,
  // Value
  1
);
```

### Modifying the WASM programs

To build the C code, you'll need to install LLVM:

 * Win: [https://chocolatey.org/packages/llvm](https://chocolatey.org/packages/llvm)
 * Mac: [https://formulae.brew.sh/formula/llvm](https://formulae.brew.sh/formula/llvm)
 * Linux: [https://releases.llvm.org/download.html](https://releases.llvm.org/download.html)

On the first build, it will complain about a missing file that you can get here:
[libclang_rt.builtins-wasm32-wasi-16.0.tar.gz](https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-16/libclang_rt.builtins-wasm32-wasi-16.0.tar.gz). Just put it on the same path that the error specifies and you should be good to go.

To build [wasi-libc](https://github.com/WebAssembly/wasi-libc), you'll need to install [GNU make](https://chocolatey.org/packages/make)

```bash
# clone this repo and it's submodules
git clone --recursive https://github.com/danielesteban/cubitos.git
cd cubitos
# build wasi-libc
cd vendor/wasi-libc && make -j8 && cd ../..
# install dev dependencies
npm install
# start the dev environment:
npm start
# open http://localhost:8080/ in your browser
```
