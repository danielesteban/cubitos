#include <stdbool.h>
#include "../vendor/AStar/AStar.c"

typedef struct {
  const int width;
  const int height;
  const int depth;
} Volume;

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

static const int horizontalNeighbors[] = {
  -1, 0,
  1, 0,
  0, -1,
  0, 1,
};

static const int verticalNeighbors[] = {
  0, 1, -1
};

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
    return -1;
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
