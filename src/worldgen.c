#define FNL_IMPL
#include "../vendor/FastNoiseLite/C/FastNoiseLite.h"

void generate(
  unsigned char* voxels,
  const int width,
  const int height,
  const int depth,
  const float frequency,
  const int seed
) {
  fnl_state fbm = fnlCreateState();
  fbm.fractal_type = FNL_FRACTAL_FBM;
  fbm.frequency = frequency;
  fbm.seed = seed;
  fnl_state simplex = fnlCreateState();
  simplex.frequency = frequency * 4.0f;
  simplex.seed = seed;
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
        } else if (y > 0 && voxels[i - width] != 0) {
          voxels[i - width] = 3;
        }
      }
    }
  }
}