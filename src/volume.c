#include <stdbool.h>
#include "../vendor/AStar/AStar.c"

typedef struct {
  struct {
    int x;
    int y;
    int z;
  } min;
  struct {
    int x;
    int y;
    int z;
  } max;
} Box;

typedef struct {
  const int width;
  const int height;
  const int depth;
} Volume;

typedef struct {
  int x;
  int y;
  int z;
} PathNode;

typedef struct {
  const Volume* volume;
  const unsigned char* voxels;
  const unsigned char* obstacles;
  const int height;
  const int maxVisited;
  const int minY;
  const int maxY;
} PathContext;

static const unsigned char maxLight = 32;

static const int lightNeighbors[] = {
  0, -1, 0,
  0, 1, 0,
  -1, 0, 0,
  1, 0, 0,
  0, 0, -1,
  0, 0, 1
};

static const int meshNormals[] = {
  0, 0, 1,    0, 1, 0,    1, 0, 0,
  0, 1, 0,    0, 0, -1,   1, 0, 0,
  0, -1, 0,   0, 0, 1,    1, 0, 0,
  -1, 0, 0,   0, 1, 0,    0, 0, 1,
  1, 0, 0,    0, 1, 0,    0, 0, 1,
  0, 0, -1,   0, 1, 0,    -1, 0, 0
};

static const int meshLightSamples[] = {
  0, 0,
  -1, 0,
  1, 0,
  0, -1,
  0, 1
};

static const int horizontalNeighbors[] = {
  -1, 0,
  1, 0,
  0, -1,
  0, 1
};

static const int verticalNeighbors[] = {
  0, 1, -1
};

const int voxel(
  const Volume* volume,
  const int x,
  const int y,
  const int z
) {
  if (
    x < 0 || x >= volume->width
    || y < 0 || y >= volume->height
    || z < 0 || z >= volume->depth
  ) {
    return -1;
  }
  return z * volume->width * volume->height + y * volume->width + x;
}

static void grow(
  Box* box,
  const int x,
  const int y,
  const int z
) {
  if (box == NULL) return;
  if (box->min.x > x) box->min.x = x;
  if (box->min.y > y) box->min.y = y;
  if (box->min.z > z) box->min.z = z;
  if (box->max.x < x) box->max.x = x;
  if (box->max.y < y) box->max.y = y;
  if (box->max.z < z) box->max.z = z;
}

static void floodLight(
  Box* bounds,
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  unsigned char* light,
  int* queue,
  const unsigned int size,
  int* next
) {
  unsigned int nextLength = 0;
  for (unsigned int q = 0; q < size; q++) {
    const int i = queue[q];
    const unsigned char level = light[i];
    if (level == 0) {
      continue;
    }
    const int z = floor(i / (volume->width * volume->height)),
              y = floor((i % (volume->width * volume->height)) / volume->width),
              x = floor((i % (volume->width * volume->height)) % volume->width);
    for (unsigned char n = 0; n < 6; n++) {
      const int nx = x + lightNeighbors[n * 3],
                ny = y + lightNeighbors[n * 3 + 1],
                nz = z + lightNeighbors[n * 3 + 2],
                neighbor = voxel(volume, nx, ny, nz);
      const unsigned char nl = level - (n == 0 && level == maxLight ? 0 : 1);
      if (
        neighbor == -1
        || light[neighbor] >= nl
        || voxels[neighbor]
        || (
          n != 0
          && level == maxLight
          && ny > height[(nz * volume->width) + nx]
        )
      ) {
        continue;
      }
      light[neighbor] = nl;
      next[nextLength++] = neighbor;
      grow(bounds, nx, ny, nz);
    }
  }
  if (nextLength > 0) {
    floodLight(
      bounds,
      volume,
      voxels,
      height,
      light,
      next,
      nextLength,
      queue
    );
  }
}

static void removeLight(
  Box* bounds,
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  unsigned char* light,
  int* queue,
  const unsigned int size,
  int* next,
  int* floodQueue,
  unsigned int floodQueueSize
) {
  unsigned int nextLength = 0;
  for (int q = 0; q < size; q += 2) {
    const int i = queue[q];
    const unsigned char level = queue[q + 1];
    const int z = floor(i / (volume->width * volume->height)),
              y = floor((i % (volume->width * volume->height)) / volume->width),
              x = floor((i % (volume->width * volume->height)) % volume->width);
    for (unsigned char n = 0; n < 6; n++) {
      const int nx = x + lightNeighbors[n * 3],
                ny = y + lightNeighbors[n * 3 + 1],
                nz = z + lightNeighbors[n * 3 + 2],
                neighbor = voxel(volume, nx, ny, nz);
      if (neighbor == -1 || voxels[neighbor]) {
        continue;
      }
      const unsigned char nl = light[neighbor];
      if (nl == 0) {
        continue;
      }
      if (
        nl < level
        || (
          n == 0
          && level == maxLight
          && nl == maxLight
        )
      ) {
        next[nextLength++] = neighbor;
        next[nextLength++] = nl;
        light[neighbor] = 0;
        grow(bounds, nx, ny, nz);
      } else if (nl >= level) {
        floodQueue[floodQueueSize++] = neighbor;
      }
    }
  }
  if (nextLength > 0) {
    removeLight(
      bounds,
      volume,
      voxels,
      height,
      light,
      next,
      nextLength,
      queue,
      floodQueue,
      floodQueueSize
    );
  } else if (floodQueueSize > 0) {
    floodLight(
      bounds,
      volume,
      voxels,
      height,
      light,
      floodQueue,
      floodQueueSize,
      queue
    );
  }
}

static const float lighting(
  const Volume* volume,
  const unsigned char* voxels,
  const unsigned char* light,
  const unsigned char face,
  const int x,
  const int y,
  const int z
) {
  const int vx = meshNormals[face * 9 + 3],
            vy = meshNormals[face * 9 + 4],
            vz = meshNormals[face * 9 + 5],
            ux = meshNormals[face * 9 + 6],
            uy = meshNormals[face * 9 + 7],
            uz = meshNormals[face * 9 + 8];
  float level = 0.0f;
  unsigned char count = 0;
  for (int s = 0; s < 5; s++) {
    const int u = meshLightSamples[s * 2],
              v = meshLightSamples[s * 2 + 1],
              n = voxel(
                volume,
                x + ux * u + vx * v,
                y + uy * u + vy * v,
                z + uz * u + vz * v
              );
    if (n != -1 && !voxels[n]) {
      level += light[n];
      count++;
    }
  }
  return level / count / maxLight;
}

static const bool canGoThrough(
  const PathContext* context,
  const int x,
  const int y,
  const int z
) {
  for (int h = 0; h < context->height; h++) {
    const int i = voxel(context->volume, x, y + h, z);
    if (i == -1 || context->voxels[i] || context->obstacles[i]) {
      return false;
    }
  }
  return true;
}

static const bool canStepAt(
  const PathContext* context,
  const int x,
  const int y,
  const int z
) {
  if ((y - 1) < context->minY || (y - 1) > context->maxY) {
    return false;
  }
  const int i = voxel(context->volume, x, y - 1, z);
  if (i == -1 || !context->voxels[i] || context->obstacles[i]) {
    return false;
  }
  return canGoThrough(context, x, y, z);
}

static void PathNodeNeighbors(ASNeighborList neighbors, void* pathNode, void* pathContext) {
  PathNode* node = (PathNode*) pathNode;
  PathContext* context = (PathContext*) pathContext;
  for (int i = 0; i < 8; i += 2) {
    const int x = horizontalNeighbors[i];
    const int z = horizontalNeighbors[i + 1];
    for (int j = 0; j < 3; j++) {
      const int y = verticalNeighbors[j];
      if (canStepAt(context, node->x + x, node->y + y, node->z + z)) {
        ASNeighborListAdd(neighbors, &(PathNode){node->x + x, node->y + y, node->z + z}, j > 0 ? 2 : 1);
      }
    }
  }
}

static float PathNodeHeuristic(void* fromNode, void* toNode, void* context) {
  PathNode* from = (PathNode*) fromNode;
  PathNode* to = (PathNode*) toNode;
  return abs(from->x - to->x) + abs(from->y - to->y) + abs(from->z - to->z);
}

static int EarlyExit(size_t visitedCount, void* visitingNode, void* goalNode, void* context) {
  if (visitedCount > ((PathContext*) context)->maxVisited) {
    return -1;
  }
  return 0;
}

static const ASPathNodeSource PathNodeSource = {
  sizeof(PathNode),
  &PathNodeNeighbors,
  &PathNodeHeuristic,
  &EarlyExit,
  NULL
};

const int ground(
  const Volume* volume,
  const unsigned char* voxels,
  const int height,
  const int x,
  int y,
  const int z
) {
  if (
    x < 0 || x >= volume->width
    || y < 0 || y >= volume->height
    || z < 0 || z >= volume->depth
    || voxels[voxel(volume, x, y, z)]
  ) {
    return -1;
  }
  y--;
  for (; y >= 0; y--) {
    if (!voxels[voxel(volume, x, y, z)]) {
      continue;
    }
    for (int h = 1; h <= height; h++) {
      if (voxels[voxel(volume, x, y + h, z)]) {
        return -1;
      }
    }
    return y + 1;
  }
  return 0;
}

int mapping(int face, int value, int x, int y, int z);

int mesh(
  const Volume* volume,
  const unsigned char* voxels,
  const unsigned char* light,
  float* faces,
  float* sphere,
  const char chunkSize,
  const int chunkX,
  const int chunkY,
  const int chunkZ
) {
  int count = 0;
  int offset = 0;
  unsigned char box[6] = { chunkSize, chunkSize, chunkSize, 0, 0, 0 };
  for (int z = chunkZ; z < chunkZ + chunkSize; z++) {
    for (int y = chunkY; y < chunkY + chunkSize; y++) {
      for (int x = chunkX; x < chunkX + chunkSize; x++) {
        const unsigned char value = voxels[voxel(volume, x, y, z)];
        if (value) {
          const int cx = x - chunkX,
                    cy = y - chunkY,
                    cz = z - chunkZ;
          bool isVisible = false;
          for (unsigned char face = 0; face < 6; face++) {
            const int nx = x + meshNormals[face * 9],
                      ny = y + meshNormals[face * 9 + 1],
                      nz = z + meshNormals[face * 9 + 2],
                      neighbor = voxel(volume, nx, ny, nz);
            if (neighbor != -1 && !voxels[neighbor]) {
              isVisible = true;
              const float texture = mapping(face, value, x, y, z);
              faces[offset++] = cx + 0.5f;
              faces[offset++] = cy + 0.5f;
              faces[offset++] = cz + 0.5f;
              faces[offset++] = texture * 6.0f + (float) face;
              faces[offset++] = lighting(volume, voxels, light, face, nx, ny, nz);
              count++;
            }
          }
          if (isVisible) {
            if (box[0] > cx) box[0] = cx;
            if (box[1] > cy) box[1] = cy;
            if (box[2] > cz) box[2] = cz;
            if (box[3] < cx + 1) box[3] = cx + 1;
            if (box[4] < cy + 1) box[4] = cy + 1;
            if (box[5] < cz + 1) box[5] = cz + 1;
          }
        }
      }
    }
  }
  const float halfWidth = 0.5f * (box[3] - box[0]),
              halfHeight = 0.5f * (box[4] - box[1]),
              halfDepth = 0.5f * (box[5] - box[2]);
  sphere[0] = 0.5f * (box[0] + box[3]);
  sphere[1] = 0.5f * (box[1] + box[4]);
  sphere[2] = 0.5f * (box[2] + box[5]);
  sphere[3] = sqrt(
    halfWidth * halfWidth
    + halfHeight * halfHeight
    + halfDepth * halfDepth
  );
  return count;
}

const int pathfind(
  const Volume* volume,
  const unsigned char* voxels,
  const unsigned char* obstacles,
  int* results,
  const int height,
  const int maxVisited,
  const int minY,
  const int maxY,
  const int fromX,
  const int fromY,
  const int fromZ,
  const int toX,
  const int toY,
  const int toZ
) {
  if (
    fromX < 0 || fromX >= volume->width
    || fromY < 0 || fromY >= volume->height
    || fromZ < 0 || fromZ >= volume->depth
    || toX < 0 || toX >= volume->width
    || toY < 0 || toY >= volume->height
    || toZ < 0 || toZ >= volume->depth
  ) {
    return 0;
  }
  ASPath path = ASPathCreate(
    &PathNodeSource,
    &(PathContext){volume, voxels, obstacles, height, maxVisited, minY, maxY},
    &(PathNode){fromX, fromY, fromZ},
    &(PathNode){toX, toY, toZ}
  );
  const int nodes = ASPathGetCount(path);
  for (int i = 0, p = 0; i < nodes; i++, p += 3) {
    PathNode* node = ASPathGetNode(path, i);
    results[p] = node->x;
    results[p + 1] = node->y;
    results[p + 2] = node->z;
  }
  ASPathDestroy(path);
  return nodes;
}

void propagate(
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  unsigned char* light,
  int* queueA,
  int* queueB
) {
  unsigned int count = 0;
  for (int z = 0, index = 0; z < volume->depth; z++) {
    for (int x = 0; x < volume->width; x++, index++) {
      for (int y = volume->height - 1; y >= 0; y--) {
        const int i = voxel(volume, x, y, z);
        if (y == volume->height - 1 && !voxels[i]) {
          light[i] = maxLight;
          queueA[count++] = i;
        }
        if (y == 0 || voxels[i]) {
          height[index] = y;
          break;
        }
      }
    }
  }
  floodLight(
    NULL,
    volume,
    voxels,
    height,
    light,
    queueA,
    count,
    queueB
  );
}

void update(
  Box* bounds,
  const Volume* volume,
  unsigned char* voxels,
  int* height,
  unsigned char* light,
  int* queueA,
  int* queueB,
  int* queueC,
  const int x,
  const int y,
  const int z,
  const unsigned char value,
  const unsigned char updateLight
) {
  bounds->min.x = bounds->max.x = x;
  bounds->min.y = bounds->max.y = y;
  bounds->min.z = bounds->max.z = z;

  const int i = voxel(volume, x, y, z);
  if (i == -1) {
    return;
  }
  const unsigned char current = voxels[i];
  if (current == value) {
    return;
  }
  voxels[i] = value;

  if (!updateLight) {
    return;
  }

  const int iheight = z * volume->width + x;
  const int currentHeight = height[iheight];
  if (!value) {
    if (y == currentHeight) {
      for (int h = y - 1; h >= 0; h--) {
        if (h == 0 || voxels[voxel(volume, x, h, z)]) {
          height[iheight] = h;
          break;
        }
      }
    }
  } else if (currentHeight < y) {
    height[iheight] = y;
  }

  if (value && !current) {
    const unsigned char level = light[i];
    if (level != 0) {
      light[i] = 0;
      queueA[0] = i;
      queueA[1] = level;
      removeLight(
        bounds,
        volume,
        voxels,
        height,
        light,
        queueA,
        2,
        queueB,
        queueC,
        0
      );
    }
  }
  if (!value && current) {
    unsigned int queueSize = 0;
    for (unsigned char n = 0; n < 6; n++) {
      const int neighbor = voxel(
        volume,
        x + lightNeighbors[n * 3],
        y + lightNeighbors[n * 3 + 1],
        z + lightNeighbors[n * 3 + 2]
      );
      if (neighbor != -1 && light[neighbor]) {
        queueA[queueSize++] = neighbor;
      }
    }
    if (queueSize > 0) {
      floodLight(
        bounds,
        volume,
        voxels,
        height,
        light,
        queueA,
        queueSize,
        queueC
      );
    }
  }
}
