#!/usr/bin/env node
// Genera el sitio estatico: landing + paginas de documentacion desde los .md del repo.
// Sin dependencias: se corre con `node site/build.mjs` y el resultado queda en site/dist.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteDir, "..");

const PUBLIC_PAGES = [
  { slug: "intro", file: "README.md", title: "Introducción", blurb: "Qué es Auton Desktop y qué funciona hoy." },
  { slug: "que-es-auton", file: "docs/public/que-es-auton.md", title: "Qué es Auton", blurb: "El problema, la propuesta y lo que el producto promete." },
  { slug: "como-trabaja", file: "docs/public/como-trabaja.md", title: "Cómo trabaja", blurb: "El recorrido de un objetivo, de la idea al cierre con evidencia." },
  { slug: "limites-y-autonomia", file: "docs/public/limites-y-autonomia.md", title: "Límites y autonomía", blurb: "Cuándo decide solo y cuándo te consulta." },
  { slug: "datos-y-privacidad", file: "docs/public/datos-y-privacidad.md", title: "Datos y privacidad", blurb: "Dónde vive tu trabajo y qué sale de tu equipo." },
  { slug: "preguntas-frecuentes", file: "docs/public/preguntas-frecuentes.md", title: "Preguntas frecuentes", blurb: "Dudas concretas sobre el producto." },
  { slug: "vision", file: "context/AUTON-VISION.md", title: "Visión del producto", blurb: "El documento central: problema, tesis y superficies." },
  { slug: "ARQUITECTURA-ORQUESTADOR", file: "context/ARQUITECTURA-ORQUESTADOR.md", title: "Arquitectura del orquestador", blurb: "El loop variable, los tres relojes y los canales dentro del hilo." },
  { slug: "CONTRATO-DE-NOTIFICACIONES", file: "docs/CONTRATO-DE-NOTIFICACIONES.md", title: "Contrato de notificaciones", blurb: "Cómo habla el orquestador mientras trabaja: cuatro salidas y su cadencia." },
  { slug: "changelog", file: "CHANGELOG.md", title: "Changelog", blurb: "Qué cambió en cada corte." },
];

// Documentación interna: detalle de implementación, decisiones, deuda y proceso.
// No se publica en el sitio público; el build la escribe en site/private-dist.
const PRIVATE_PAGES = [
  { slug: "empieza-aqui", file: "context/EMPIEZA-AQUI.md", title: "Empieza aquí", blurb: "El punto de entrada del equipo: estado real y orden de construcción." },
  { slug: "reparto-de-trabajo", file: "context/REPARTO-DE-TRABAJO.md", title: "Reparto del trabajo", blurb: "Quién hace qué, en qué orden y con qué criterio de hecho." },
  { slug: "decisiones", file: "context/DECISIONES.md", title: "Decisiones", blurb: "Las decisiones de fondo, su porqué y qué las cambiaría." },
  { slug: "articulo-auton", file: "context/ARTICULO-AUTON.md", title: "Artículo técnico", blurb: "El esqueleto del artículo: tesis, evidencia y pendientes." },
  { slug: "por-que-auton-gana", file: "context/POR-QUE-AUTON-GANA.md", title: "Por qué Auton gana", blurb: "El análisis del artículo de DeepSeek y el argumento competitivo." },
  { slug: "briefing-agentes", file: "context/AGENT-BRIEFING.md", title: "Briefing para agentes", blurb: "Cómo colaborar en el repo sin pisarse." },
  { slug: "interno", file: "docs/INTERNO.md", title: "Estado interno", blurb: "Dónde estamos, decisiones y deuda." },
  { slug: "poda-mvp", file: "docs/PODA-MVP.md", title: "Poda para el MVP", blurb: "Qué se quita, en qué orden y qué no se toca." },
  { slug: "plan-modo-auton", file: "context/PLAN-MODO-AUTON.md", title: "Plan de modo Auton", blurb: "Cómo se mapea la visión al código." },
  { slug: "scorecard", file: "docs/SCORECARD.md", title: "Scorecard", blurb: "El juicio del orquestador sobre su trabajo." },
  { slug: "versionado", file: "docs/VERSIONADO.md", title: "Versionado", blurb: "Ramas, tags y cómo se publica." },
  { slug: "limites-implementacion", file: "docs/private/limites-implementacion.md", title: "Límites: implementación", blurb: "Esquema, veredictos, códigos de fallo e invariantes." },
  { slug: "canal-rapido", file: "docs/private/canal-rapido.md", title: "Canal rápido", blurb: "Cómo se hablan orquestador y programador, y de quién es el candado." },
  { slug: "contrato-del-plan", file: "docs/private/contrato-del-plan.md", title: "Contrato del plan", blurb: "El archivo del plan, campo por campo." },
  { slug: "protocolo-de-reporte", file: "docs/private/protocolo-de-reporte.md", title: "Protocolo de reporte", blurb: "Qué puede un worker y cómo reporta un límite mal calibrado." },
  { slug: "verificacion-y-pruebas", file: "docs/private/verificacion-y-pruebas.md", title: "Verificación y pruebas", blurb: "Qué cubre cada suite y qué no se probó." },
  { slug: "deuda-y-riesgos", file: "docs/private/deuda-y-riesgos.md", title: "Deuda y riesgos", blurb: "Lo que falta y lo que puede romperse." },
];

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Cada árbol solo puede enlazar sus propias páginas. Un enlace a un documento
// que no está en este árbol se degrada a texto: preferimos un texto sin enlace
// antes que un enlace roto.
let resolveLink = (href) => href;

function makeLinkResolver(sourceFile, pages) {
  const byPath = new Map(pages.map((page) => [resolve(repoRoot, page.file), page.slug]));
  const bySlug = new Map(pages.map((page) => [page.slug.toLowerCase(), page.slug]));
  const sourceDir = dirname(join(repoRoot, sourceFile));

  return (href) => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const [pathPart, hash] = href.split("#");
    const target = resolve(sourceDir, pathPart);
    const slug = byPath.get(target) ?? bySlug.get(basename(pathPart, ".md").toLowerCase());
    return slug ? `./${slug}.html${hash ? `#${hash}` : ""}` : null;
  };
}

function inline(text) {
  let out = text;
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const resolved = resolveLink(href);
    if (!resolved) return label;
    const external = /^https?:/.test(resolved);
    return `<a href="${resolved}"${external ? ' rel="noreferrer"' : ""}>${label}</a>`;
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

const navHtml = (currentSlug, pages, isPrivate) =>
  [
    `<nav class="docs-nav"><h4>${isPrivate ? "Documentación interna" : "Documentación"}</h4><ul>`,
    ...pages.map(
      (page) =>
        `<li><a href="./${page.slug}.html"${page.slug === currentSlug ? ' aria-current="page"' : ""}>${page.title}</a></li>`,
    ),
    "</ul>",
    isPrivate
      ? '<h4>Privado</h4><ul><li><a href="../">Landing</a></li><li><a href="../../dist/docs/">Sitio público</a></li></ul>'
      : '<h4>Producto</h4><ul><li><a href="../">Landing</a></li><li><a href="https://github.com/edies76/auton-desktop" rel="noreferrer">GitHub</a></li></ul>',
    "</nav>",
  ].join("\n");

const page = ({ title, body, currentSlug, pages, isPrivate }) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Auton</title>
    <meta name="robots" content="${isPrivate ? "noindex,nofollow" : "index,follow"}" />
    <link rel="stylesheet" href="../site.css" />
  </head>
  <body class="${isPrivate ? "private" : "public"}">
    ${
      isPrivate
        ? '<div class="private-banner">Documento privado · solo equipo · no publicar</div>'
        : ""
    }
    <header class="nav">
      <a class="brand" href="../"><span class="mark"></span> Auton</a>
      <nav>
        <a href="./">Docs</a>
        <a href="https://github.com/edies76/auton-desktop" rel="noreferrer">GitHub</a>
      </nav>
    </header>
    <div class="docs-layout">
      ${navHtml(currentSlug, pages, isPrivate)}
      <article class="doc">
${body}
      </article>
    </div>
  </body>
</html>
`;

function buildTree(outDir, pages, isPrivate) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "docs"), { recursive: true });

  copyFileSync(join(siteDir, "index.html"), join(outDir, "index.html"));
  copyFileSync(join(siteDir, "site.css"), join(outDir, "site.css"));
  copyFileSync(join(siteDir, "site.js"), join(outDir, "site.js"));

  let rendered = 0;
  for (const entry of pages) {
    const sourcePath = join(repoRoot, entry.file);
    let markdown;
    try {
      markdown = readFileSync(sourcePath, "utf8");
    } catch {
      console.warn(`aviso: falta ${entry.file}, se omite`);
      continue;
    }
    resolveLink = makeLinkResolver(entry.file, pages);
    const body = renderMarkdown(markdown);
    writeFileSync(
      join(outDir, "docs", `${entry.slug}.html`),
      page({ title: entry.title, body, currentSlug: entry.slug, pages, isPrivate }),
      "utf8",
    );
    rendered += 1;
  }

  const indexBody = [
    `<h1>${isPrivate ? "Documentación interna" : "Documentación"}</h1>`,
    isPrivate
      ? "<p>Detalle de implementación, decisiones, deuda y proceso. Solo para el equipo: no publicar este árbol.</p>"
      : "<p>Todo lo que hay que saber sobre Auton Desktop: qué es, cómo se decide y qué falta.</p>",
    '<ul class="doc-list">',
    ...pages
      .filter((entry) => entry.slug !== "intro")
      .map(
        (entry) =>
          `<li><a href="./${entry.slug}.html">${entry.title}</a><span>${entry.blurb}</span></li>`,
      ),
    "</ul>",
  ].join("\n");

  writeFileSync(
    join(outDir, "docs", "index.html"),
    page({ title: "Documentación", body: indexBody, currentSlug: "index", pages, isPrivate }),
    "utf8",
  );

  return rendered;
}

const publicRendered = buildTree(join(siteDir, "dist"), PUBLIC_PAGES, false);
const privateRendered = buildTree(join(siteDir, "private-dist"), PRIVATE_PAGES, true);

console.log(
  `sitio generado: site/dist (${publicRendered} páginas públicas) y site/private-dist (${privateRendered} páginas privadas)`,
);
