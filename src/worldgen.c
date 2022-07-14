#define FNL_IMPL
#include "../vendor/FastNoiseLite/C/FastNoiseLite.h"

void generate(
  unsigned char* voxels,
  const int width,
  const int height,
  const int depth,
  const unsigned char grass,
  const unsigned char lights,
  const float frequency,
  const float gain,
  const float lacunarity,
  const int octaves,
  const int seed
) {
  fnl_state fbm = fnlCreateState();
  fbm.fractal_type = FNL_FRACTAL_FBM;
  fbm.frequency = frequency;
  fbm.gain = gain;
  fbm.lacunarity = lacunarity;
  fbm.octaves = octaves;
  fbm.seed = seed;
  fnl_state simplex = fnlCreateState();
  simplex.frequency = fbm.frequency * 4.0f;
  simplex.gain = fbm.gain;
  simplex.lacunarity = fbm.lacunarity;
  simplex.octaves = fbm.octaves;
  simplex.seed = fbm.seed;
  const float radius = fmax(width, depth) * 0.5f;
  for (int i = 0, z = 0; z < depth; z++) {
    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++, i++) {
        const float dx = (x - width * 0.5f + 0.5f);
        const float dz = (z - depth * 0.5f + 0.5f);
        const float d = sqrt(dx * dx + dz * dz);
        if (d > radius) {
          continue;
        }
        const float n = fabs(fnlGetNoise3D(&fbm, x, y, z));
        if (
          y < (height - 2) * n
          && d < radius * (0.8f + 0.2f * n)
        ) {
          voxels[i] = 2 - round(fabs(fnlGetNoise3D(&simplex, z, x, y)));
          continue;
        }
        if (
          (grass || lights)
          && y > 0
          && !voxels[i]
          && (voxels[i - width] == 1 || voxels[i - width] == 2)
        ) {
          if (grass) {
            voxels[i - width] = 3;
          }
          if (lights && fabs(fnlGetNoise3D(&simplex, z * 10, x  * 10, y * 10)) > 0.98f) {
            voxels[i] = 2;
            voxels[i + width] = 4 + round(fabs(fnlGetNoise3D(&simplex, x, y, z)) * 2);
          }
        }
      }
    }
  }
}
