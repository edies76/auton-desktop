# Sitio de documentación

Landing y documentación de Auton Desktop, generadas desde los `.md` del repo.

## Construir

```bash
node site/build.mjs
```

No tiene dependencias: lee `README.md`, `AUTON-VISION.md`, `CHANGELOG.md` y los
documentos de `docs/`, y escribe el sitio completo en `site/dist/`.

```
site/dist/
  index.html          landing
  site.css
  site.js
  docs/index.html     índice de documentación
  docs/<pagina>.html  una por documento
```

Agregar una página es sumar una entrada a `PAGES` en `site/build.mjs`.

## Publicar en AWS

Ruta corta con S3 + CloudFront. Requiere AWS CLI configurado en tu máquina; el
repo no lleva credenciales.

```bash
# 1) bucket privado para el sitio
aws s3 mb s3://auton-site --region us-east-1

# 2) subir (el index y las rutas funcionan sin rewrite porque son archivos)
aws s3 sync site/dist s3://auton-site --delete \
  --cache-control "public,max-age=300" \
  --exclude "*.html"
aws s3 sync site/dist s3://auton-site \
  --exclude "*" --include "*.html" \
  --cache-control "public,max-age=60"

# 3) distribución con HTTPS
aws cloudfront create-distribution \
  --origin-domain-name auton-site.s3.amazonaws.com \
  --default-root-object index.html
```

Después de cada publicación, invalidar solo el HTML:

```bash
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> --paths "/*.html" "/docs/*.html"
```

Alternativa sin CloudFront para una demo: activar *Static website hosting* en el
bucket y usar el endpoint HTTP del bucket. Sirve para enseñar, no para producción.

## Estado

El sitio se genera y se puede abrir en local (`site/dist/index.html`). **No se ha
desplegado**: falta decidir dominio y cuenta. Es el siguiente paso cuando quieras
tener la URL pública para el jurado.
