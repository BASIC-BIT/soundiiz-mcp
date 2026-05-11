#!/usr/bin/env node
// Build assets/logo.svg, assets/social-preview.svg, and assets/social-preview.png
// from the single mark module in scripts/lib/mark.ts. Re-run any time the mark
// changes to keep both surfaces in lockstep.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderMark, renderMarkDefs, type MarkGeometry } from './lib/mark.js';

const ASSETS_DIR = path.resolve(process.cwd(), 'assets');

function buildLogoSvg(): string {
  // 256x256 art board, mark sized to match a friendly favicon/avatar appearance.
  const geom: MarkGeometry = {
    cx: 128,
    cy: 128,
    spokeLength: 96,
    satelliteRadius: 16,
    satelliteCoreRadius: 6,
    hubRadius: 34,
    hubCoreRadius: 10,
    strokeWidth: 9,
    hubRingStrokeWidth: 3,
    glowRadius: 78,
  };

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">',
    '  <title id="title">Soundiiz MCP logo</title>',
    '  <desc id="desc">A central hub node connected by lines to four satellite nodes at compass points, on a dark rounded square.</desc>',
    '  <defs>',
    `    ${renderMarkDefs()}`,
    '  </defs>',
    '  <rect width="256" height="256" rx="56" fill="#0b0721" />',
    `  ${renderMark(geom)}`,
    '</svg>',
    '',
  ].join('\n');
}

function buildSocialPreviewSvg(): string {
  // 1280x640 OpenGraph card. Mark on the right, text block on the left.
  const geom: MarkGeometry = {
    cx: 1040,
    cy: 320,
    spokeLength: 120,
    satelliteRadius: 20,
    satelliteCoreRadius: 7.5,
    hubRadius: 42,
    hubCoreRadius: 13,
    strokeWidth: 11,
    hubRingStrokeWidth: 4,
    glowRadius: 170,
  };

  // Generate a subtle dot grid as decoration. Two horizontal bands of dots.
  const dots: string[] = [];
  for (const y of [80, 560]) {
    for (let x = 80; x <= 1200; x += 80) {
      dots.push(`<circle cx="${x}" cy="${y}" r="2"/>`);
    }
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" role="img" aria-labelledby="title">',
    '  <title id="title">Soundiiz MCP — social preview</title>',
    '  <defs>',
    '    <linearGradient id="bg" x1="0" y1="0" x2="1280" y2="640" gradientUnits="userSpaceOnUse">',
    '      <stop offset="0" stop-color="#13082e" />',
    '      <stop offset="0.55" stop-color="#1f0a44" />',
    '      <stop offset="1" stop-color="#0b0721" />',
    '    </linearGradient>',
    `    ${renderMarkDefs()}`,
    '  </defs>',
    '  <rect width="1280" height="640" fill="url(#bg)" />',
    `  <g fill="#ffffff" fill-opacity="0.05">${dots.join('')}</g>`,
    `  ${renderMark(geom)}`,
    `  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">`,
    '    <text x="80" y="270" fill="#ffffff" font-size="92" font-weight="800" letter-spacing="-2">Soundiiz MCP</text>',
    '    <text x="80" y="340" fill="#e9d5ff" font-size="34" font-weight="500">Inspect, trigger, and clean up your</text>',
    '    <text x="80" y="385" fill="#e9d5ff" font-size="34" font-weight="500">music sync jobs and SmartLinks.</text>',
    '    <text x="80" y="570" fill="#a5b4fc" font-size="22" font-weight="500" opacity="0.85">github.com/BASIC-BIT/soundiiz-mcp</text>',
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

function renderPng(svgPath: string, pngPath: string, width: number): void {
  // Use the locally installed resvg-js-cli (npx will fetch it on first run).
  // shell:true so Windows finds npx.cmd via PATH without us hard-coding the suffix.
  const result = spawnSync(
    'npx',
    ['-y', '@resvg/resvg-js-cli', '--fit-width', `${width}`, svgPath, pngPath],
    { stdio: 'inherit', shell: true }
  );
  if (result.status !== 0) {
    throw new Error(`resvg-js exited with status ${result.status ?? 'null'}`);
  }
}

function main(): void {
  mkdirSync(ASSETS_DIR, { recursive: true });

  const logoPath = path.join(ASSETS_DIR, 'logo.svg');
  const socialSvgPath = path.join(ASSETS_DIR, 'social-preview.svg');
  const socialPngPath = path.join(ASSETS_DIR, 'social-preview.png');

  writeFileSync(logoPath, buildLogoSvg(), 'utf8');
  console.log(`Wrote ${logoPath}`);

  writeFileSync(socialSvgPath, buildSocialPreviewSvg(), 'utf8');
  console.log(`Wrote ${socialSvgPath}`);

  renderPng(socialSvgPath, socialPngPath, 1280);
  console.log(`Wrote ${socialPngPath}`);
}

main();
