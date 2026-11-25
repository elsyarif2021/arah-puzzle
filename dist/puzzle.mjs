export const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const key = ([x, y]) => x + ',' + y;
const add = ([x, y], [dx, dy]) => [x + dx, y + dy];
const inside = ([x, y], size) => x >= 0 && y >= 0 && x < size && y < size;

export function ray(path, size) {
  const head = path.at(-1);
  const neck = path.at(-2);
  const direction = [head[0] - neck[0], head[1] - neck[1]];
  const cells = [];
  for (let cell = add(head, direction); inside(cell, size); cell = add(cell, direction)) cells.push(key(cell));
  return cells;
}

export function findBlocker(path, remaining, size) {
  for (const cell of ray(path, size)) {
    const blocker = remaining.find(other => other !== path && other.some(point => key(point) === cell));
    if (blocker) return blocker;
  }
}

export function difficulty(level) {
  if (level <= 3) return {name: 'Mudah', first: 1, size: level === 3 ? 10 : 9};
  if (level <= 7) return {name: 'Sedang', first: 4, size: 12};
  return {name: 'Sulit', first: 8, size: 15};
}

export function makePuzzle(level, seed = level * 89729, legacy = false) {
  const size = legacy ? (level <= 2 ? 9 : level <= 5 ? 11 : 13) : difficulty(level).size;
  const target = legacy ? level + 6 : level <= 3 ? level + 9 : level <= 7 ? level + 13 : level + 19;
  const paths = [];
  const occupied = new Set();
  function pick(count) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * count);
  }
  // Each new path can escape the paths already placed, so reverse insertion order solves the board.
  for (let attempt = 0; paths.length < target && attempt < 6000; attempt++) {
    const head = [pick(size), pick(size)];
    if (occupied.has(key(head))) continue;
    const neck = add(head, directions[pick(4)]);
    if (!inside(neck, size) || occupied.has(key(neck))) continue;
    const path = [neck, head];
    const ahead = ray(path, size);
    if (ahead.some(cell => occupied.has(cell))) continue;
    const used = new Set([...ahead, key(head), key(neck)]);
    const length = 4 + pick(5);
    while (path.length < length) {
      const options = directions.map(step => add(path[0], step))
        .filter(cell => inside(cell, size) && !occupied.has(key(cell)) && !used.has(key(cell)));
      if (!options.length) break;
      const next = options[pick(options.length)];
      used.add(key(next));
      path.unshift(next);
    }
    if (path.length < 3) continue;
    path.forEach(cell => occupied.add(key(cell)));
    paths.push(path);
  }
  return {size, paths};
}
