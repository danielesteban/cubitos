import {
  Color,
  DataArrayTexture,
  ShaderLib,
  ShaderMaterial,
  sRGBEncoding,
  UniformsUtils,
} from 'three';

class ChunkMaterial extends ShaderMaterial {
  constructor({
    atlas,
    ambientColor = new Color(0, 0, 0),
    light1Color = new Color(1, 1, 1),
    light2Color = new Color(1, 1, 1),
    light3Color = new Color(1, 1, 1),
    sunlightColor = new Color(1, 1, 1),
    light = true,
  } = {}) {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    super({
      defines: {
        USE_LIGHT: !!light,
      },
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        atlas: { value: null },
        ambientColor: { value: ambientColor },
        light1Color: { value: light1Color },
        light2Color: { value: light2Color },
        light3Color: { value: light3Color },
        sunlightColor: { value: sunlightColor },
      },
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'attribute vec4 face;',
            'varying vec3 fragNormal;',
            '#ifdef USE_ATLAS',
            'varying vec3 fragUV;',
            '#endif',
            '#ifdef USE_LIGHT',
            'attribute vec4 light;',
            'uniform vec3 ambientColor;',
            'uniform vec3 light1Color;',
            'uniform vec3 light2Color;',
            'uniform vec3 light3Color;',
            'uniform vec3 sunlightColor;',
            'varying vec3 fragLight;',
            '#endif',
            'mat3 rotateX(const in float rad) {',
            '  float c = cos(rad);',
            '  float s = sin(rad);',
            '  return mat3(',
            '    1.0, 0.0, 0.0,',
            '    0.0, c, s,',
            '    0.0, -s, c',
            '  );',
            '}',
            'mat3 rotateY(const in float rad) {',
            '  float c = cos(rad);',
            '  float s = sin(rad);',
            '  return mat3(',
            '    c, 0.0, -s,',
            '    0.0, 1.0, 0.0,',
            '    s, 0.0, c',
            '  );',
            '}',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <defaultnormal_vertex>',
          '',
        )
        .replace(
          '#include <project_vertex>',
          [
            'vec4 mvPosition = vec4(transformed, 1.0);',
            'mat3 rot;',
            'switch (int(mod(face.w, 6.0))) {',
            '  default:',
            '   rot = mat3(1.0);',
            '   break;',
            '  case 1:',
            '    rot = rotateX(PI * -0.5);',
            '    break;',
            '  case 2:',
            '    rot = rotateX(PI * 0.5);',
            '    break;',
            '  case 3:',
            '    rot = rotateY(PI * -0.5);',
            '    break;',
            '  case 4:',
            '    rot = rotateY(PI * 0.5);',
            '    break;',
            '  case 5:',
            '    rot = rotateY(PI);',
            '    break;',
            '}',
            'mvPosition.xyz = (rot * mvPosition.xyz) + face.xyz;',
            'mvPosition = modelViewMatrix * mvPosition;',
            'gl_Position = projectionMatrix * mvPosition;',
            'fragNormal = normalMatrix * rot * objectNormal;',
            '#ifdef USE_ATLAS',
            'fragUV = vec3(uv, floor(face.w / 6.0));',
            '#endif',
            '#ifdef USE_LIGHT',
            'vec3 lightColor = sunlightColor * light.x + light1Color * light.y + light2Color * light.z + light3Color * light.w;',
            'fragLight = max(ambientColor, lightColor);',
            '#endif',
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'layout(location = 1) out vec4 pc_fragNormal;',
            'varying vec3 fragNormal;',
            '#ifdef USE_ATLAS',
            'precision highp sampler2DArray;',
            'uniform sampler2DArray atlas;',
            'varying vec3 fragUV;',
            '#endif',
            '#ifdef USE_LIGHT',
            'varying vec3 fragLight;',
            '#endif',
          ].join('\n')
        )
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            '#ifdef USE_ATLAS',
            'diffuseColor *= texture(atlas, fragUV);',
            '#endif',
            '#ifdef USE_LIGHT',
            'diffuseColor.rgb *= fragLight;',
            '#endif',
          ].join('\n'),
        )
        .replace(
          '#include <dithering_fragment>',
          [
            '#include <dithering_fragment>',
            'pc_fragNormal = vec4(normalize(fragNormal), 0.0);',
          ].join('\n')
        ),
    });
    this.setAtlas(atlas);
  }

  setAtlas(atlas) {
    const { defines, uniforms } = this;
    if (atlas && !atlas.isDataArrayTexture) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = atlas.image.width;
      canvas.height = atlas.image.height;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas.image, 0, 0);
      atlas = new DataArrayTexture(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.width,
        canvas.height / canvas.width
      );
      atlas.encoding = sRGBEncoding;
      atlas.needsUpdate = true;
    }
    if (defines.USE_ATLAS !== !!atlas) {
      defines.USE_ATLAS = !!atlas;
      this.needsUpdate = true;
    }
    uniforms.atlas.value = atlas || null;
  }
}

export default ChunkMaterial;
