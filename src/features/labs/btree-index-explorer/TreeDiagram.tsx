'use client';

import {
  getPage,
  pageLabel,
  type Frame,
  type Page,
  type Tree,
} from '@/core/labs/btree-index-explorer';

/*
 * The tree as a drawing: one row per level, a page as a row of key cells, hairline
 * pointers from the boundary between two keys down to the page that boundary leads to,
 * and the leaf chain as arrows along the bottom row. Geometry only: every colour is a
 * token, and the layout is computed from the data, never measured from the DOM.
 */

const CELL = 34;
const PAGE_H = 26;
const LABEL_H = 16;
const LEVEL_GAP = 44;
const ROW = LABEL_H + PAGE_H + LEVEL_GAP;
const GAP = 20;
const PAD = 2;

interface Box {
  readonly page: Page;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly level: number;
}

interface Layout {
  readonly boxes: readonly Box[];
  readonly width: number;
  readonly height: number;
}

const pageWidth = (page: Page): number => Math.max(1, page.keys.length) * CELL;

function layout(tree: Tree): Layout {
  const boxes: Box[] = [];
  let cursor = PAD;

  const place = (id: number, level: number): Box => {
    const page = getPage(tree, id);
    const w = pageWidth(page);
    const y = PAD + level * ROW + LABEL_H;
    if (page.kind === 'leaf') {
      const box = { page, x: cursor, y, w, level };
      cursor += w + GAP;
      boxes.push(box);
      return box;
    }
    const children = page.children.map((child) => place(child, level + 1));
    const first = children[0]!;
    const last = children[children.length - 1]!;
    const centre = (first.x + last.x + last.w) / 2;
    const box = { page, x: centre - w / 2, y, w, level };
    boxes.push(box);
    return box;
  };

  const root = place(tree.rootId, 0);
  const levels = Math.max(...boxes.map((b) => b.level)) + 1;
  // A root wider than its children can start left of the margin; shift everything back.
  const left = Math.min(root.x, PAD);
  const shift = left < PAD ? PAD - left : 0;
  const moved = boxes.map((b) => ({ ...b, x: b.x + shift }));
  const width = Math.max(...moved.map((b) => b.x + b.w)) + PAD;
  return { boxes: moved, width, height: PAD * 2 + levels * ROW - LEVEL_GAP };
}

interface TreeDiagramProps {
  frame: Frame;
}

export function TreeDiagram({ frame }: TreeDiagramProps) {
  const { tree, active, visited, matched } = frame;
  const { boxes, width, height } = layout(tree);
  const byId = new Map(boxes.map((b) => [b.page.id, b]));
  const isActive = (id: number) => active.includes(id);
  const isVisited = (id: number) => visited.includes(id);
  const found = new Set(matched);
  const levels = Math.max(...boxes.map((b) => b.level)) + 1;

  return (
    <div
      role="region"
      aria-label="B+ tree pages"
      tabIndex={0}
      className="border-border rounded-control overflow-x-auto border p-1"
    >
      <svg
        aria-hidden
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block"
        fill="none"
      >
        {boxes
          .filter((box) => box.page.kind === 'internal')
          .flatMap((box) =>
            box.page.children.map((childId, j) => {
              const child = byId.get(childId);
              if (!child) return null;
              return (
                <path
                  key={`${box.page.id}-${childId}`}
                  d={`M${box.x + j * CELL} ${box.y + PAGE_H} V${box.y + PAGE_H + LEVEL_GAP / 2} H${child.x + child.w / 2} V${child.y}`}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              );
            }),
          )}

        {boxes
          .filter((box) => box.page.kind === 'leaf' && box.page.next !== null)
          .map((box) => {
            const next = byId.get(box.page.next!);
            if (!next) return null;
            const y = box.y + PAGE_H / 2;
            return (
              <g key={`chain-${box.page.id}`} stroke="var(--border)" strokeWidth="1">
                <line x1={box.x + box.w} x2={next.x} y1={y} y2={y} />
                <path d={`M${next.x - 6} ${y - 3} L${next.x} ${y} L${next.x - 6} ${y + 3}`} />
              </g>
            );
          })}

        {boxes.map((box) => {
          const on = isActive(box.page.id);
          const seen = isVisited(box.page.id);
          return (
            <g key={box.page.id}>
              <text
                x={box.x}
                y={box.y - 5}
                fill="currentColor"
                textAnchor="start"
                className={on ? 'text-accent font-mono text-sm' : 'text-muted font-mono text-sm'}
              >
                {pageLabel(box.page.id)}
              </text>
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={PAGE_H}
                rx="4"
                fill={on ? 'var(--accent-tint)' : seen ? 'var(--sunken)' : 'var(--surface)'}
                stroke={on ? 'var(--accent)' : 'var(--border)'}
                strokeWidth="1"
              />
              {box.page.keys.length === 0 ? (
                <text
                  x={box.x + box.w / 2}
                  y={box.y + PAGE_H / 2}
                  fill="currentColor"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-faint font-mono text-sm"
                >
                  {'—'}
                </text>
              ) : null}
              {box.page.keys.map((key, i) => {
                const cx = box.x + (i + 0.5) * CELL;
                const hit = box.page.kind === 'leaf' && found.has(key);
                return (
                  <g key={key}>
                    {i > 0 ? (
                      <line
                        x1={box.x + i * CELL}
                        x2={box.x + i * CELL}
                        y1={box.y}
                        y2={box.y + PAGE_H}
                        stroke="var(--border)"
                        strokeWidth="1"
                      />
                    ) : null}
                    <text
                      x={cx}
                      y={box.y + PAGE_H / 2}
                      fill="currentColor"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={on ? 'text-accent font-mono text-sm' : 'text-fg font-mono text-sm'}
                      fontWeight={hit || on ? 500 : 400}
                    >
                      {key}
                    </text>
                    {hit ? (
                      <line
                        x1={cx - 11}
                        x2={cx + 11}
                        y1={box.y + PAGE_H - 5}
                        y2={box.y + PAGE_H - 5}
                        stroke="currentColor"
                        strokeWidth="1"
                        className={on ? 'text-accent' : 'text-fg'}
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <ol className="sr-only">
        {Array.from({ length: levels }, (_, level) => (
          <li key={level}>
            {`Level ${level + 1} of ${levels}: `}
            {boxes
              .filter((box) => box.level === level)
              .map(
                (box) =>
                  `${pageLabel(box.page.id)} holds ${
                    box.page.keys.length === 0 ? 'no keys' : box.page.keys.join(', ')
                  }${isActive(box.page.id) ? ', being read now' : isVisited(box.page.id) ? ', read earlier' : ''}`,
              )
              .join('. ')}
          </li>
        ))}
      </ol>
    </div>
  );
}
