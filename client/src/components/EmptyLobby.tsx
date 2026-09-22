import { useEffect, useRef, useState, type RefObject } from "react";

function arrowPath(length: number) {
  const shoulder = length - Math.min(24, length * 0.45);
  // One outline keeps the 15px shaft and symmetric head joined without seams.
  const points = [
    [0, 10.5],
    [shoulder, 10.5],
    [shoulder, 0],
    [length, 18],
    [shoulder, 36],
    [shoulder, 25.5],
    [0, 25.5],
  ];
  const corners = points.map(([x, y], index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const before = Math.hypot(previous[0] - x, previous[1] - y);
    const after = Math.hypot(next[0] - x, next[1] - y);
    const cosine =
      ((previous[0] - x) * (next[0] - x) + (previous[1] - y) * (next[1] - y)) /
      (before * after);
    const tangent = Math.tan(Math.acos(Math.max(-1, Math.min(1, cosine))) / 2);
    const inset = Math.min(3.75 / tangent, before / 2, after / 2);
    const start = [
      x + ((previous[0] - x) * inset) / before,
      y + ((previous[1] - y) * inset) / before,
    ];
    const end = [
      x + ((next[0] - x) * inset) / after,
      y + ((next[1] - y) * inset) / after,
    ];
    const sweep =
      (x - previous[0]) * (next[1] - y) - (y - previous[1]) * (next[0] - x) > 0
        ? 1
        : 0;
    const radius = inset * tangent;
    return { start, end, sweep, radius };
  });
  return (
    corners
      .map(
        (corner, index) =>
          `${index === 0 ? "M" : "L"} ${corner.start.join(" ")} A ${corner.radius} ${corner.radius} 0 0 ${corner.sweep} ${corner.end.join(" ")}`,
      )
      .join(" ") + " Z"
  );
}

export default function EmptyLobby({
  buttonRef,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [arrow, setArrow] = useState<{
    x: number;
    y: number;
    length: number;
    angle: number;
  } | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const text = textRef.current;
    const button = buttonRef.current;
    if (!overlay || !text || !button) return;
    const observer = new ResizeObserver(() => {
      const bounds = overlay.getBoundingClientRect();
      const label = text.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      const x = label.left + label.width / 2 - bounds.left;
      const y = label.top + label.height / 2 - bounds.top;
      const dx = target.left + target.width / 2 - bounds.left - x;
      const dy = target.top + target.height / 2 - bounds.top - y;
      setArrow({
        x: x + dx / 2,
        y: y + dy / 2,
        length: Math.hypot(dx, dy) / 4,
        angle: Math.atan2(dy, dx),
      });
    });
    observer.observe(overlay);
    observer.observe(text);
    observer.observe(button);
    return () => observer.disconnect();
  }, [buttonRef]);

  return (
    <div className="empty-lobby" ref={overlayRef}>
      <p ref={textRef}>No current games. Go create one!</p>
      {arrow && (
        <div
          className="empty-lobby-arrow"
          aria-hidden="true"
          style={{
            left: arrow.x,
            top: arrow.y,
            width: arrow.length,
            transform: `translate(-50%, -50%) rotate(${arrow.angle}rad)`,
          }}
        >
          <svg width="100%" height="36" viewBox={`0 0 ${arrow.length} 36`}>
            <path d={arrowPath(arrow.length)} />
          </svg>
        </div>
      )}
    </div>
  );
}
