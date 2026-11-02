#!/usr/bin/env node
// Genera el sitio estatico: landing + paginas de documentacion desde los .md del repo.
// Sin dependencias: se corre con `node site/build.mjs` y el resultado queda en site/dist.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteDir, "..");
const outDir = join(siteDir, "dist");

const PAGES = [
  { slug: "intro", file: "README.md", title: "Introducción", blurb: "Qué es Auton Desktop y qué funciona hoy." },
  { slug: "vision", file: "AUTON-VISION.md", title: "Visión del producto", blurb: "El documento central: problema, tesis y superficies." },
  { slug: "scorecard", file: "docs/SCORECARD.md", title: "Scorecard", blurb: "El goal con creces: juicio del orquestador sobre su trabajo." },
  { slug: "POR-QUE-AUTON-GANA", file: "docs/POR-QUE-AUTON-GANA.md", title: "Por qué Auton gana", blurb: "El artículo de DeepSeek contrastado con Auton: qué validamos y qué hacemos distinto." },
  { slug: "INTERNO", file: "docs/INTERNO.md", title: "Estado interno", blurb: "Dónde estamos, decisiones y deuda." },
  { slug: "PODA-MVP", file: "docs/PODA-MVP.md", title: "Poda para el MVP", blurb: "Qué se quita, en qué orden y qué no se toca." },
  { slug: "PLAN-MODO-AUTON", file: "docs/PLAN-MODO-AUTON.md", title: "Plan de modo Auton", blurb: "Cómo se mapea la visión al código." },
  { slug: "AGENT-BRIEFING", file: "docs/AGENT-BRIEFING.md", title: "Briefing para agentes", blurb: "Cómo colaborar en el repo sin pisarse." },
  { slug: "VERSIONADO", file: "docs/VERSIONADO.md", title: "Versionado", blurb: "Ramas, tags y cómo se publica." },
  { slug: "changelog", file: "CHANGELOG.md", title: "Changelog", blurb: "Qué cambió en cada corte." },
];

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text) {
  let out = text;
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const external = /^https?:/.test(href);
    return `<a href="${href}"${external ? ' rel="noreferrer"' : ""}>${label}</a>`;
  });
  return out;
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  const flushParagraph = (buffer) => {
    if (buffer.length === 0) return;
    html.push(`<p>${inline(escapeHtml(buffer.join(" ").trim()))}</p>`);
    buffer.length = 0;
  };

  let paragraph = [];

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith("```")) {
      flushParagraph(paragraph);
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      html.push(`<h${level}>${inline(escapeHtml(heading[2].trim()))}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(\s*)(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph(paragraph);
      html.push("<hr />");
      index += 1;
      continue;
    }

    // Tablas: cabecera, separador y filas
    if (line.trim().startsWith("|") && /^\s*\|?[\s:-]+\|/.test(lines[index + 1] ?? "")) {
      flushParagraph(paragraph);
      const cells = (row) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      const head = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      html.push("<table><thead><tr>");
      for (const cell of head) html.push(`<th>${inline(escapeHtml(cell))}</th>`);
      html.push("</tr></thead><tbody>");
      for (const row of rows) {
        html.push("<tr>");
        for (const cell of row) html.push(`<td>${inline(escapeHtml(cell))}</td>`);
        html.push("</tr>");
      }
      html.push("</tbody></table>");
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph(paragraph);
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${inline(escapeHtml(quote.join(" ")))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushParagraph(paragraph);
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        index += 1;
        while (
          index < lines.length &&
          lines[index].trim().length > 0 &&
          !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) &&
          !/^#{1,4}\s/.test(lines[index]) &&
          !lines[index].startsWith("```") &&
          !lines[index].trim().startsWith("|")
        ) {
          items[items.length - 1] += ` ${lines[index].trim()}`;
          index += 1;
        }
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>`);
      for (const item of items) html.push(`<li>${inline(escapeHtml(item))}</li>`);
      html.push(`</${tag}>`);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph(paragraph);
      index += 1;
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  flushParagraph(paragraph);
  return html.join("\n");
}

const navHtml = (currentSlug) =>
  [
    '<nav class="docs-nav"><h4>Documentación</h4><ul>',
    ...PAGES.map(
      (page) =>
        `<li><a href="./${page.slug}.html"${page.slug === currentSlug ? ' aria-current="page"' : ""}>${page.title}</a></li>`,
    ),
    "</ul>",
    '<h4>Producto</h4><ul><li><a href="../">Landing</a></li><li><a href="https://github.com/edies76/auton-desktop" rel="noreferrer">GitHub</a></li></ul>',
    "</nav>",
  ].join("\n");

const page = ({ title, body, currentSlug }) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Auton</title>
    <link rel="stylesheet" href="../site.css" />
  </head>
  <body>
    <header class="nav">
      <a class="brand" href="../"><span class="mark"></span> Auton</a>
      <nav>
        <a href="./">Docs</a>
        <a href="https://github.com/edies76/auton-desktop" rel="noreferrer">GitHub</a>
      </nav>
    </header>
    <div class="docs-layout">
      ${navHtml(currentSlug)}
      <article class="doc">
${body}
      </article>
    </div>
  </body>
</html>
`;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "docs"), { recursive: true });

copyFileSync(join(siteDir, "index.html"), join(outDir, "index.html"));
copyFileSync(join(siteDir, "site.css"), join(outDir, "site.css"));
copyFileSync(join(siteDir, "site.js"), join(outDir, "site.js"));

let rendered = 0;
for (const entry of PAGES) {
  const sourcePath = join(repoRoot, entry.file);
  let markdown;
  try {
    markdown = readFileSync(sourcePath, "utf8");
  } catch {
    console.warn(`aviso: falta ${entry.file}, se omite`);
    continue;
  }
  const body = renderMarkdown(markdown);
  writeFileSync(
    join(outDir, "docs", `${entry.slug}.html`),
    page({ title: entry.title, body, currentSlug: entry.slug }),
    "utf8",
  );
  rendered += 1;
}

const indexBody = [
  "<h1>Documentación</h1>",
  "<p>Todo lo que hay que saber sobre Auton Desktop: qué es, cómo se decide y qué falta.</p>",
  '<ul class="doc-list">',
  ...PAGES.filter((entry) => entry.slug !== "intro").map(
    (entry) =>
      `<li><a href="./${entry.slug}.html">${entry.title}</a><span>${entry.blurb}</span></li>`,
  ),
  "</ul>",
].join("\n");

writeFileSync(
  join(outDir, "docs", "index.html"),
  page({ title: "Documentación", body: indexBody, currentSlug: "index" }),
  "utf8",
);

console.log(`sitio generado en site/dist (${rendered} páginas)`);
