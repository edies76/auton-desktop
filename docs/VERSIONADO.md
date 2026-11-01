# Versionado

Cómo se numera, se etiqueta y se publica Auton Desktop.

## Esquema

`MAJOR.MINOR.PATCH` (SemVer) mientras no haya releases públicas:

- **MAJOR** — cambia la forma de trabajar del producto: se rompe un contrato de
  datos o una superficie (por ejemplo, el formato de `.auton/plan.json`).
- **MINOR** — funcionalidad nueva compatible: una tool, una superficie, una
  capacidad del orquestador.
- **PATCH** — correcciones y ajustes que no cambian contratos.

Durante el hackathon la serie es `0.x`: todo puede moverse, y cada corte se
documenta igual.

## Fuente de verdad

| Dónde | Qué guarda |
| --- | --- |
| `VERSION` | La versión actual, solo el número (`0.1.0`) |
| `CHANGELOG.md` | Qué cambió, agrupado en Añadido / Cambiado / Eliminado / Corregido / Conocido |
| Tag de git | `vX.Y.Z`, anotado, sobre el commit del corte |
| `site/` | La web toma la versión del landing y del changelog generado |

El `package.json` de la raíz sigue siendo el de ZCode (`3.16.2`) porque pertenece
al upstream. La versión de Auton vive en `VERSION` y en el tag. Cuando haya build
empaquetada, el instalador tomará `VERSION`.

## Ramas

| Rama | Uso |
| --- | --- |
| `auton-desktop` | La rama de trabajo del producto. Todo se integra aquí. |
| `feat/<cosa>` | Trabajo riesgoso o de varios días. Se avisa antes de abrirla. |
| `fix/<cosa>` | Correcciones puntuales. |

`origin` apunta al ZCode de upstream y `auton` a nuestro repositorio. Nunca se
empuja a `origin`.

## Commits

- Un commit por cambio con sentido; nada de "varios arreglos".
- Mensaje en español, en imperativo y explicando el porqué, no solo el qué.
- Cuerpo con el contexto que un lector futuro necesita: qué fallaba, qué se
  decidió y qué se verificó.
- Sin credenciales. Sin `--no-verify` salvo que el hook no pueda correr; en ese
  caso se corre a mano y se dice en el mensaje.

## Flujo de corte

```text
1. Subir VERSION
2. Escribir la sección nueva del CHANGELOG (con la fecha)
3. Commit "Version X.Y.Z"
4. git tag -a vX.Y.Z -m "<resumen del corte>"
5. Push de la rama y del tag a `auton`
6. Regenerar el sitio: node site/build.mjs
```

## Publicación del sitio

El sitio es estático: `node site/build.mjs` deja todo en `site/dist`. Se publica
tal cual en S3 + CloudFront (ver `site/README.md`). El sitio no necesita build de
aplicación ni credenciales en el repo.

## Qué NO se versiona

- `node_modules`, `dist`, `.auton/` de cada proyecto y cualquier credencial.
- Los planes de los proyectos del usuario: son datos, no código.
