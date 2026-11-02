// Вид «Граф»: SVG-визуализация заметок (узлы) и ссылок (рёбра) с масштабированием,
// панорамированием, перетаскиванием узлов и подсветкой соседей.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { selectGraphData, VaultFacade } from '@lingua/core/data-access';
import { hashString } from '@lingua/shared/util';
import { ForceSimulation, SimEdge, SimNode } from './force-simulation';

/** Узел для отрисовки. */
interface DrawNode {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
  isTag: boolean;
}

@Component({
  selector: 'lv-graph-view',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './graph-view.component.html',
  styleUrl: './graph-view.component.scss',
})
export class GraphViewComponent {
  private readonly store = inject(Store);
  private readonly vault = inject(VaultFacade);
  private readonly graph = this.store.selectSignal(selectGraphData);

  /** Показывать ли теги как отдельные узлы. */
  readonly showTags = signal(false);
  /** Фильтр по названию. */
  readonly filter = signal('');
  /** Узел под курсором. */
  readonly hovered = signal<string | null>(null);
  /** Масштаб и смещение. */
  readonly scale = signal(1);
  readonly offset = signal({ x: 0, y: 0 });
  /** Номер кадра — сигнал для перерисовки после шага симуляции. */
  private readonly frame = signal(0);

  private simulation: ForceSimulation | null = null;
  private rafId = 0;
  /** Предыдущие позиции, чтобы граф не «взрывался» при изменении данных. */
  private readonly positions = new Map<string, { x: number; y: number }>();
  /** Состояние перетаскивания. */
  private drag:
    | { kind: 'node'; node: SimNode }
    | { kind: 'pan'; x: number; y: number; ox: number; oy: number }
    | null = null;
  private moved = false;

  /** Узлы и рёбра с учётом опции «теги». */
  private readonly data = computed(() => {
    const { nodes, edges } = this.graph();
    const result = {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.title,
        degree: n.degree,
        isTag: false,
        group: n.tags[0] ?? '',
      })),
      edges: edges.map((e) => ({ ...e })) as SimEdge[],
    };
    if (this.showTags()) {
      const tags = new Set(nodes.flatMap((n) => n.tags));
      tags.forEach((t) =>
        result.nodes.push({ id: `tag:${t}`, label: `#${t}`, degree: 1, isTag: true, group: t }),
      );
      nodes.forEach((n) =>
        n.tags.forEach((t) => result.edges.push({ source: n.id, target: `tag:${t}` })),
      );
    }
    return result;
  });

  /** Соседи узла под курсором. */
  private readonly neighbours = computed(() => {
    const id = this.hovered();
    const set = new Set<string>();
    if (!id) return set;
    set.add(id);
    for (const e of this.data().edges) {
      if (e.source === id) set.add(e.target);
      if (e.target === id) set.add(e.source);
    }
    return set;
  });

  /** Узлы для шаблона (пересчитываются каждый кадр симуляции). */
  readonly drawNodes = computed<DrawNode[]>(() => {
    this.frame();
    const sim = this.simulation;
    if (!sim) return [];
    const meta = new Map(this.data().nodes.map((n) => [n.id, n]));
    return sim.nodes.map((n) => {
      const m = meta.get(n.id)!;
      return {
        id: n.id,
        label: m.label,
        x: n.x,
        y: n.y,
        r: m.isTag ? 5 : 5 + Math.min(10, Math.sqrt(m.degree) * 2.5),
        color: m.isTag
          ? 'var(--lv-text-faint)'
          : m.group
            ? `hsl(${parseInt(hashString(m.group), 36) % 360} 65% 62%)`
            : 'var(--lv-text-muted)',
        isTag: m.isTag,
      };
    });
  });

  /** Рёбра для шаблона. */
  readonly drawEdges = computed(() => {
    const nodes = new Map(this.drawNodes().map((n) => [n.id, n]));
    return this.data()
      .edges.map((e) => ({
        a: nodes.get(e.source),
        b: nodes.get(e.target),
        key: `${e.source}>${e.target}`,
      }))
      .filter((e) => e.a && e.b)
      .map((e) => ({
        x1: e.a!.x,
        y1: e.a!.y,
        x2: e.b!.x,
        y2: e.b!.y,
        key: e.key,
        source: e.key.split('>')[0],
        target: e.key.split('>')[1],
      }));
  });

  /** Трансформация SVG-группы. */
  readonly transform = computed(
    () => `translate(${this.offset().x} ${this.offset().y}) scale(${this.scale()})`,
  );

  constructor() {
    // Пересоздаём симуляцию при изменении данных, сохраняя позиции уже известных узлов.
    effect(() => {
      const data = this.data();
      untracked(() =>
        this.restart(
          data.nodes.map((n) => n.id),
          data.edges,
        ),
      );
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.rafId));
  }

  /** Состояние подсветки узла: обычный / выделенный / приглушённый. */
  nodeState(id: string, label: string): 'normal' | 'active' | 'dim' {
    const q = this.filter().trim().toLowerCase();
    if (q && !label.toLowerCase().includes(q)) return 'dim';
    const n = this.neighbours();
    if (!n.size) return q ? 'active' : 'normal';
    return n.has(id) ? 'active' : 'dim';
  }

  /** Подсвечено ли ребро. */
  edgeActive(source: string, target: string): boolean {
    const h = this.hovered();
    return !!h && (source === h || target === h);
  }

  /** Масштабирование колесом мыши относительно курсора. */
  onWheel(event: WheelEvent, svg: Element): void {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const px = event.clientX - rect.left - rect.width / 2;
    const py = event.clientY - rect.top - rect.height / 2;
    const old = this.scale();
    const next = Math.min(4, Math.max(0.2, old * (event.deltaY < 0 ? 1.12 : 0.89)));
    const o = this.offset();
    this.offset.set({ x: px - ((px - o.x) * next) / old, y: py - ((py - o.y) * next) / old });
    this.scale.set(next);
  }

  /** Нажатие на узел — начало перетаскивания узла. */
  onNodeDown(event: PointerEvent, id: string): void {
    event.stopPropagation();
    const node = this.simulation?.nodes.find((n) => n.id === id);
    if (!node) return;
    node.fixed = true;
    this.drag = { kind: 'node', node };
    this.moved = false;
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  /** Нажатие на фон — начало панорамирования. */
  onBackgroundDown(event: PointerEvent): void {
    const o = this.offset();
    this.drag = { kind: 'pan', x: event.clientX, y: event.clientY, ox: o.x, oy: o.y };
  }

  /** Движение указателя: перемещение узла или панорамирование. */
  onMove(event: PointerEvent): void {
    if (!this.drag) return;
    this.moved = true;
    if (this.drag.kind === 'pan') {
      this.offset.set({
        x: this.drag.ox + event.clientX - this.drag.x,
        y: this.drag.oy + event.clientY - this.drag.y,
      });
    } else {
      const s = this.scale();
      this.drag.node.x += event.movementX / s;
      this.drag.node.y += event.movementY / s;
      this.simulation?.reheat(0.3);
      this.loop();
    }
  }

  /** Отпускание указателя. */
  onUp(): void {
    if (this.drag?.kind === 'node') this.drag.node.fixed = false;
    this.drag = null;
  }

  /** Клик по узлу открывает заметку (или поиск по тегу). */
  onNodeClick(id: string): void {
    if (this.moved) return;
    if (id.startsWith('tag:')) this.vault.search(`tag:#${id.slice(4)}`);
    else this.vault.open(id);
  }

  /** Сброс масштаба и положения. */
  resetView(): void {
    this.scale.set(1);
    this.offset.set({ x: 0, y: 0 });
    this.simulation?.reheat(0.8);
    this.loop();
  }

  /** Пересоздаёт симуляцию. */
  private restart(ids: string[], edges: SimEdge[]): void {
    this.simulation?.nodes.forEach((n) => this.positions.set(n.id, { x: n.x, y: n.y }));
    const nodes: SimNode[] = ids.map((id, i) => {
      const p = this.positions.get(id);
      const angle = i * 2.399963; // «золотой угол» для равномерного начального размещения
      const radius = 20 * Math.sqrt(i + 1);
      return {
        id,
        x: p?.x ?? Math.cos(angle) * radius,
        y: p?.y ?? Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    this.simulation = new ForceSimulation(nodes, edges);
    this.loop();
  }

  /** Цикл анимации на requestAnimationFrame. */
  private loop(): void {
    if (this.rafId) return;
    const step = () => {
      const sim = this.simulation;
      if (!sim) return;
      sim.tick();
      sim.tick();
      this.frame.update((f) => f + 1);
      this.rafId = sim.running ? requestAnimationFrame(step) : 0;
    };
    this.rafId = requestAnimationFrame(step);
  }
}
