import { ShaderLib, ShaderMaterial, UniformsUtils } from 'three';

class ChunkMaterial extends ShaderMaterial {
  constructor(atlas) {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    super({
      fog: true,
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        atlas: { value: atlas },
      },
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'attribute vec4 face;',
            'varying vec3 fragNormal;',
            ...(atlas ? [
              'varying vec3 fragUV;'
            ] : []),
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
            'fragNormal = objectNormal;',
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
            'fragNormal = normalMatrix * rot * fragNormal;',
            ...(atlas ? [
              'fragUV = vec3(uv, floor(face.w / 6.0));'
            ] : []),
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <common>',
          [
            'precision highp sampler2DArray;',
            '#include <common>',
            'layout(location = 1) out vec4 pc_fragNormal;',
            'varying vec3 fragNormal;',
            ...(atlas ? [
              'uniform sampler2DArray atlas;',
              'varying vec3 fragUV;',
            ] : []),
          ].join('\n')
        )
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            ...(atlas ? [
              'diffuseColor *= texture(atlas, fragUV);',
            ] : []),
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
  }
}

export default ChunkMaterial;
