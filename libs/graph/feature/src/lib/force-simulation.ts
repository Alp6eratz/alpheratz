// Простая силовая симуляция (force-directed layout) без внешних библиотек:
// отталкивание узлов, притяжение по рёбрам и к центру, затухание (alpha).

/** Узел симуляции. */
export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Зафиксирован пользователем (перетаскивание). */
  fixed?: boolean;
}

/** Ребро симуляции. */
export interface SimEdge {
  source: string;
  target: string;
}

export class ForceSimulation {
  /** «Температура» симуляции: при 0 узлы перестают двигаться. */
  alpha = 1;
  private readonly index = new Map<string, SimNode>();

  constructor(
    readonly nodes: SimNode[],
    readonly edges: SimEdge[],
  ) {
    nodes.forEach((n) => this.index.set(n.id, n));
  }

  /** Активна ли ещё симуляция. */
  get running(): boolean {
    return this.alpha > 0.005;
  }

  /** Перезапускает «нагрев» (например, после перетаскивания). */
  reheat(alpha = 0.6): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /** Один шаг симуляции. */
  tick(): void {
    const { nodes, edges, alpha } = this;
    // Отталкивание всех пар узлов (O(n²) — достаточно для личного хранилища).
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 0.25;
        }
        const force = (6000 * alpha) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    // Притяжение по рёбрам к желаемой длине.
    for (const e of edges) {
      const a = this.index.get(e.source);
      const b = this.index.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (d - 140) * 0.04 * alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    // Притяжение к центру и интегрирование скоростей с трением.
    for (const n of nodes) {
      n.vx -= n.x * 0.01 * alpha;
      n.vy -= n.y * 0.01 * alpha;
      if (n.fixed) {
        n.vx = n.vy = 0;
        continue;
      }
      n.vx *= 0.6;
      n.vy *= 0.6;
      n.x += n.vx;
      n.y += n.vy;
    }
    this.alpha *= 0.985;
  }
}
