/* 障害を避けた折れ線。毎フレームでは引き直さない。 */
(function (root) {
  "use strict";

  function hits(x, y, radius, colliders) {
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      if (c.t === "circle") {
        if (Math.hypot(x - c.x, y - c.y) < c.r + radius) return true;
      } else {
        const nx = (x - c.x) / (c.rx + radius);
        const ny = (y - c.y) / (c.ry + radius);
        if (nx * nx + ny * ny < 1) return true;
      }
    }
    return false;
  }

  function clearLine(a, b, colliders, radius) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / 10));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      if (hits(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius, colliders)) return false;
    }
    return true;
  }

  function pull(points, colliders, radius) {
    if (points.length < 2) return points.slice();
    const out = [points[0]];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !clearLine(points[i], points[j], colliders, radius)) j -= 1;
      out.push(points[j]);
      i = j;
    }
    return out;
  }

  function route(from, to, colliders, world, radius) {
    const list = colliders || [];
    const pad = world.pad || 0;
    if (clearLine(from, to, list, radius)) return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
    const cell = 32;
    const cols = Math.ceil(world.width / cell);
    const rows = Math.ceil(world.height / cell);
    function blocked(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
      const x = cx * cell + cell / 2;
      const y = cy * cell + cell / 2;
      if (x < pad || y < pad || x > world.width - pad || y > world.height - pad) return true;
      return hits(x, y, radius, list);
    }
    function of(p) {
      return {
        x: Math.max(0, Math.min(cols - 1, Math.floor(p.x / cell))),
        y: Math.max(0, Math.min(rows - 1, Math.floor(p.y / cell))),
      };
    }
    function openNear(c) {
      if (!blocked(c.x, c.y)) return c;
      for (let r = 1; r <= 6; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (!blocked(c.x + dx, c.y + dy)) return { x: c.x + dx, y: c.y + dy };
          }
        }
      }
      return c;
    }
    const start = openNear(of(from));
    const goal = openNear(of(to));
    const sk = start.x + "," + start.y;
    const gScore = {};
    const parent = {};
    gScore[sk] = 0;
    const open = [start];
    const closed = {};
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    let found = null;
    let guard = 0;
    while (open.length && guard < 5000) {
      guard += 1;
      let best = 0;
      let bestF = Infinity;
      for (let i = 0; i < open.length; i += 1) {
        const c = open[i];
        const f = gScore[c.x + "," + c.y] + Math.hypot(c.x - goal.x, c.y - goal.y);
        if (f < bestF) {
          bestF = f;
          best = i;
        }
      }
      const cur = open.splice(best, 1)[0];
      const ck = cur.x + "," + cur.y;
      if (closed[ck]) continue;
      closed[ck] = true;
      if (cur.x === goal.x && cur.y === goal.y) {
        found = cur;
        break;
      }
      for (let d = 0; d < dirs.length; d += 1) {
        const nx = cur.x + dirs[d][0];
        const ny = cur.y + dirs[d][1];
        if (blocked(nx, ny)) continue;
        if (dirs[d][0] !== 0 && dirs[d][1] !== 0) {
          if (blocked(cur.x + dirs[d][0], cur.y) || blocked(cur.x, cur.y + dirs[d][1])) continue;
        }
        const nk = nx + "," + ny;
        if (closed[nk]) continue;
        const step = dirs[d][0] !== 0 && dirs[d][1] !== 0 ? 1.414 : 1;
        const ng = gScore[ck] + step;
        if (gScore[nk] == null || ng < gScore[nk]) {
          gScore[nk] = ng;
          parent[nk] = ck;
          open.push({ x: nx, y: ny });
        }
      }
    }
    if (!found) return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
    const cells = [];
    let k = found.x + "," + found.y;
    cells.push(found);
    while (parent[k]) {
      const parts = parent[k].split(",");
      const c = { x: Number(parts[0]), y: Number(parts[1]) };
      cells.push(c);
      k = parent[k];
    }
    cells.reverse();
    const points = cells.map(function (c) {
      return { x: c.x * cell + cell / 2, y: c.y * cell + cell / 2 };
    });
    points[0] = { x: from.x, y: from.y };
    points[points.length - 1] = { x: to.x, y: to.y };
    return pull(points, list, radius);
  }

  root.Nav = {
    hits: hits,
    clearLine: clearLine,
    route: route,
  };
})(globalThis);
