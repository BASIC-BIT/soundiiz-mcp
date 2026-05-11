// Single source of truth for the Soundiiz MCP brand mark.
// Both assets/logo.svg and assets/social-preview.svg are generated from this
// module by scripts/build-assets.ts. Do not duplicate this geometry inline.

export interface MarkGeometry {
  /** Center x in target SVG coordinates. */
  cx: number;
  /** Center y in target SVG coordinates. */
  cy: number;
  /** Distance from center to each satellite center (and end of each spoke). */
  spokeLength: number;
  /** Outer radius of each satellite ring. */
  satelliteRadius: number;
  /** Inner accent dot radius inside each satellite. */
  satelliteCoreRadius: number;
  /** Radius of the central hub circle. */
  hubRadius: number;
  /** Inner white dot radius inside the hub. */
  hubCoreRadius: number;
  /** Width of the spoke lines and hub stroke. */
  strokeWidth: number;
  /** Width of the white ring around the hub. */
  hubRingStrokeWidth: number;
  /** Optional radial glow radius behind the hub. Set 0 to disable. */
  glowRadius: number;
  /** Suffix applied to gradient ids so multiple marks can co-exist in one SVG. */
  idSuffix?: string;
}

/** Returns the gradient/glow definitions the mark depends on. Place inside a `<defs>` block. */
export function renderMarkDefs(idSuffix = ''): string {
  const hub = `hub${idSuffix}`;
  const line = `line${idSuffix}`;
  const glow = `glow${idSuffix}`;
  return [
    `<linearGradient id="${hub}" x1="0" y1="0" x2="1" y2="1">`,
    `  <stop offset="0" stop-color="#f472b6" />`,
    `  <stop offset="0.55" stop-color="#a855f7" />`,
    `  <stop offset="1" stop-color="#6366f1" />`,
    `</linearGradient>`,
    `<linearGradient id="${line}" x1="0" y1="0" x2="1" y2="1">`,
    `  <stop offset="0" stop-color="#fbcfe8" stop-opacity="0.85" />`,
    `  <stop offset="1" stop-color="#c7d2fe" stop-opacity="0.85" />`,
    `</linearGradient>`,
    `<radialGradient id="${glow}" cx="0.5" cy="0.5" r="0.5">`,
    `  <stop offset="0" stop-color="#a855f7" stop-opacity="0.55" />`,
    `  <stop offset="1" stop-color="#a855f7" stop-opacity="0" />`,
    `</radialGradient>`,
  ].join('\n  ');
}

/** Returns the SVG fragment for the mark itself (no defs). Place inside the SVG body. */
export function renderMark(g: MarkGeometry): string {
  const idSuffix = g.idSuffix ?? '';
  const hubId = `hub${idSuffix}`;
  const lineId = `line${idSuffix}`;
  const glowId = `glow${idSuffix}`;

  // Four satellites at compass points: N, E, S, W.
  const satellites: { x: number; y: number; label: string }[] = [
    { x: g.cx, y: g.cy - g.spokeLength, label: 'N' },
    { x: g.cx + g.spokeLength, y: g.cy, label: 'E' },
    { x: g.cx, y: g.cy + g.spokeLength, label: 'S' },
    { x: g.cx - g.spokeLength, y: g.cy, label: 'W' },
  ];

  const parts: string[] = [];

  if (g.glowRadius > 0) {
    parts.push(
      `<circle cx="${g.cx}" cy="${g.cy}" r="${g.glowRadius}" fill="url(#${glowId})" />`
    );
  }

  // Spokes.
  parts.push(
    `<g stroke="url(#${lineId})" stroke-width="${g.strokeWidth}" stroke-linecap="round" fill="none">`
  );
  for (const s of satellites) {
    parts.push(`  <line x1="${g.cx}" y1="${g.cy}" x2="${s.x}" y2="${s.y}" />`);
  }
  parts.push(`</g>`);

  // Satellite outer rings (white).
  parts.push(`<g fill="#f8fafc">`);
  for (const s of satellites) {
    parts.push(`  <circle cx="${s.x}" cy="${s.y}" r="${g.satelliteRadius}" />`);
  }
  parts.push(`</g>`);

  // Satellite accent cores.
  parts.push(`<g fill="#a855f7">`);
  for (const s of satellites) {
    parts.push(`  <circle cx="${s.x}" cy="${s.y}" r="${g.satelliteCoreRadius}" />`);
  }
  parts.push(`</g>`);

  // Central hub.
  parts.push(
    `<circle cx="${g.cx}" cy="${g.cy}" r="${g.hubRadius}" fill="url(#${hubId})" />`
  );
  parts.push(
    `<circle cx="${g.cx}" cy="${g.cy}" r="${g.hubRadius}" fill="none" stroke="#f8fafc" stroke-width="${g.hubRingStrokeWidth}" />`
  );
  parts.push(
    `<circle cx="${g.cx}" cy="${g.cy}" r="${g.hubCoreRadius}" fill="#f8fafc" />`
  );

  return parts.join('\n  ');
}
