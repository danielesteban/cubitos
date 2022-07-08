import { DataArrayTexture } from 'three';

class ChunkAtlas extends DataArrayTexture {
  constructor() {
    const textures = 3;
    const width = 16;
    const height = 16;
    const data = new Uint8Array(textures * width * height * 4);
    for (let i = 0, t = 0; t < textures; t++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++, i += 4) {
          const c = [0xFF, 0xFF, 0xFF, 0xFF];
          switch (t) {
            case 1:
              c[0] = c[2] = 0x66;
              break;
            case 2:
              if (y > 11 + Math.sin(x * 4.0) * 1.5) {
                c[0] = c[2] = 0x66;
              }
              break;
          }
          data.set(c, i);
        }
      }
    }
    super(data, width, height, textures);
    this.needsUpdate = true;
  }

  map(face, value) {
    if (value === 2 && face === 1) {
      return 1;
    }
    if (value === 2 && face !== 2) {
      return 2;
    }
    return 0;
  }
}

export default ChunkAtlas;
