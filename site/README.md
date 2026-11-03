# Sitio de documentación

Landing y documentación de Auton Desktop, generadas desde los `.md` del repo.

## Dos árboles, dos públicos

| Árbol | Origen | Destino | Quién lo lee |
| --- | --- | --- | --- |
| Público | `README.md`, `context/AUTON-VISION.md`, `context/ARQUITECTURA-ORQUESTADOR.md`, `docs/CONTRATO-DE-NOTIFICACIONES.md`, `docs/public/*.md`, `CHANGELOG.md` | `site/dist/` | Cualquiera |
| Privado | `context/EMPIEZA-AQUI.md`, `context/REPARTO-DE-TRABAJO.md`, `context/DECISIONES.md`, `context/ARTICULO-AUTON.md`, `context/POR-QUE-AUTON-GANA.md`, `context/AGENT-BRIEFING.md`, `context/PLAN-MODO-AUTON.md`, `docs/INTERNO.md`, `docs/PODA-MVP.md`, `docs/SCORECARD.md`, `docs/VERSIONADO.md`, `docs/private/*.md` | `site/private-dist/` | Solo el equipo |

El build público **no lee** `docs/private/` ni los documentos internos listados arriba. El build privado los renderiza con un aviso visible, `noindex,nofollow` y una navegación propia.

## Construir

```bash
node site/build.mjs
```

No tiene dependencias: escribe los dos árboles en una sola corrida.

```
site/dist/            público
site/private-dist/    privado (no publicar)
```

Agregar una página pública: suma una entrada a `PUBLIC_PAGES` en `site/build.mjs`.
Agregar una página privada: suma una entrada a `PRIVATE_PAGES`.

## Qué va en cada uno

**Público**: qué es Auton, cómo trabaja, cómo se gobierna la autonomía, dónde viven los datos y preguntas frecuentes. Da confianza y ayuda a entender el producto. No incluye rutas de implementación, nombres de símbolos, códigos de error, deuda técnica ni estrategia competitiva.

**Privado**: contrato del plan, evaluación de límites, códigos de fallo, invariantes, protocolo de reporte, verificación, deuda y riesgos, reparto del trabajo y decisiones. Es la fuente de verdad para trabajar en el repo.

## Publicar

Solo el árbol público va al bucket público:

```bash
node site/build.mjs
aws s3 sync site/dist s3://auton-docs-027252078119 --delete
```

El árbol privado requiere un destino autenticado (bucket privado con CloudFront firmado, o el repositorio mismo). **Nunca** ejecutes `aws s3 sync site/private-dist` contra el bucket público.

Alternativa sin CloudFront para una demo: activar *Static website hosting* en el
bucket y usar el endpoint HTTP del bucket. Sirve para enseñar, no para producción.

## Estado

**Publicado.** El sitio está en vivo en un bucket S3 con website hosting:

```
http://auton-docs-027252078119.s3-website-us-east-1.amazonaws.com
```

Bucket: `auton-docs-027252078119`, región `us-east-1`, lectura pública solo para
los objetos del sitio.
