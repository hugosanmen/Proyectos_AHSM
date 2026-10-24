# ElaMath — v0.4.1

PWA offline-first para practicar matemáticas de Ingeniería, con un backend mínimo en Vercel:
cuentas por correo (sin contraseña), **Peer Tutor con IA** (Groq hoy, Anthropic cuando quieras), **escáner de apuntes**,
**exámenes simulados**, **30 días gratis y Pro a $50 MXN/mes** (cobro manual por ahora) y **códigos de promoción**.
Sin framework ni dependencias de producción: HTML + CSS + JS (módulos ES), KaTeX local, funciones de Vercel con `fetch` nativo.
ElaMath es un producto independiente y no está afiliado a ninguna universidad.

## Etapa de pruebas (hoy: sin cobro)
Por defecto **no se cobra nada**: cualquier persona que entre con su correo tiene Peer Tutor, revisión de procedimiento (escáner), exámenes simulados y reporte de errores, sin precios ni prueba de 30 días en pantalla. Los límites diarios de mensajes y el freno global siguen activos para cuidar tu gasto de IA.
Cuando quieras empezar a cobrar, agrega la variable `BILLING_ENABLED=1` en Vercel y haz Redeploy: se activan la prueba de 30 días desde el registro, el precio, las instrucciones de pago y los códigos de promoción descritos abajo. Sin esa variable, las secciones de cobro de este README no aplican.

## Qué hace
- **Práctica** (funciona sin conexión): **16 materias en 5 niveles** con ~65 tipos de ejercicio paramétricos, cada uno verificado contra un cálculo independiente; retroalimentación por error, XP, niveles, racha, paso a paso.
- **Prueba gratis de 30 días**: todo desbloqueado desde que la persona crea su cuenta (la primera vez que entra con su correo). Pasados los 30 días la **práctica básica sigue gratis**; el Peer Tutor, el escáner y los exámenes requieren Pro.
- **Pro: $50 MXN/mes.** Por ahora lo activas tú (ver «Dar Pro»). El precio, los días de prueba y las instrucciones de pago se cambian con variables de entorno, sin tocar código.
- **Códigos de promoción**: tú los creas (ver «Códigos de promoción»); el estudiante los canjea en *Mi cuenta* o en el modal de Pro y recibe días de Pro. Un uso por cuenta, tope de usos y caducidad opcional.
- **Peer Tutor**: chat socrático por ejercicio. El cliente solo manda `plantilla + semilla + opción elegida`; el **servidor regenera el ejercicio** y le da al modelo la respuesta y los pasos verificados (así no inventa resultados).
- **Escáner de apuntes**: foto del procedimiento a mano → el navegador la reduce (≤1280 px, JPEG) → un modelo con visión la transcribe en LaTeX y señala el primer error con una pista. Cada foto cuenta como un mensaje del tutor.
- **Exámenes simulados**: por materia, 10 reactivos adaptativos (empieza en dificultad 2; acierto sube, error baja), 20 minutos, sin retroalimentación hasta el final; calificación 0–10 (aprueba con 6), revisión con paso a paso, XP y dominio, historial de los últimos 20.
- **Cuota diaria** en el servidor (día de Ciudad de México), con reembolso si la IA falla y freno global de emergencia.
- **Reportar error**: guarda `plantilla#semilla` + nota.
- Si abres la app en un hosting **sin backend** (p. ej. GitHub Pages) todo sigue como la versión local (sin cuenta, tutor ni escáner; los exámenes quedan abiertos).

## Proveedor de IA: Groq ahora, Anthropic después
Solo defines variables de entorno; el código no cambia.

| Situación | Variables |
|---|---|
| **Hoy (Groq)** | `GROQ_API_KEY` |
| **Mañana (Anthropic)** | agrega `ANTHROPIC_API_KEY` y `LLM_PROVIDER=anthropic` (o quita `GROQ_API_KEY`) |

Modelos por defecto (cámbialos con las variables de la tabla):
- Groq: pista `llama-3.1-8b-instant` · explicación `llama-3.3-70b-versatile` · «de otra forma» `openai/gpt-oss-120b` · escáner `qwen/qwen3.8-27b`.
- Anthropic: pista `claude-haiku-5-5` · explicación `claude-sonnet-5-5` · «de otra forma» `claude-opus-5-5` · escáner `claude-sonnet-5-5`.

> ⚠️ El modelo de visión de Groq está en **vista previa**: Groq puede retirarlo o cambiarlo sin mucho aviso. Si el escáner deja de responder, pon otro modelo con visión en `GROQ_MODEL_VISION` (mira la lista actual en la consola de Groq) o cambia a Anthropic.

## Variables de entorno (Vercel → Settings → Environment Variables)
| Variable | Para qué | Obligatoria |
|---|---|---|
| `SESSION_SECRET` | Firma de sesiones. Cadena aleatoria larga (`openssl rand -hex 32`) | Sí |
| `APP_URL` | URL pública, p. ej. `https://elamath.vercel.app` (va en el enlace del correo) | Sí |
| `ADMIN_TOKEN` | Clave para los endpoints de admin (cadena larga aleatoria) | Sí |
| `GROQ_API_KEY` | IA con Groq (tutor y escáner) | Para la IA |
| `ANTHROPIC_API_KEY`, `LLM_PROVIDER` | IA con Anthropic (`groq` o `anthropic`; si falta, se usa el que tenga clave, Groq primero) | No |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío del enlace (`ElaMath <hola@tudominio.com>`, dominio verificado en Resend) | Sí |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Base de datos (también acepta `KV_REST_API_URL/TOKEN`) | Sí |
| `BILLING_ENABLED` (apagado) | `1` enciende prueba de 30 días + Pro de $50/mes + códigos | No |
| `TRIAL_DAYS` (30), `PRO_PRICE_MXN` (50) | Prueba gratis y precio (solo con cobro encendido) | No |
| `PAY_INSTRUCTIONS` | Texto de «Cómo activar Pro» (CLABE, referencia, WhatsApp…), máx. 600 caracteres | Recomendada |
| `TUTOR_PRO_DAILY` (40), `TUTOR_TRIAL_DAILY` (=Pro), `TUTOR_FREE_DAILY` (0), `TUTOR_GLOBAL_DAILY` (2000) | Mensajes de tutor/escáner por día | No |
| `GROQ_MODEL_FAST/STANDARD/DEEP/VISION`, `ANTHROPIC_MODEL_FAST/STANDARD/DEEP/VISION` | Cambiar modelos | No |

Nunca pongas estas claves en el código ni en el repositorio (`.env*` está en `.gitignore`; hay un `.env.example` de referencia).
Upstash: en Vercel → Storage / Marketplace → Upstash Redis → conecta al proyecto (crea las variables solas).

## Dar Pro (cobro manual)
Cuando alguien te pague, actívalo (los días se cuentan desde hoy):
```bash
curl -X POST https://TU-APP.vercel.app/api/admin/plan \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"estudiante@correo.com","plan":"pro","days":30}'
```
Quitar Pro (y terminar su prueba): mismo comando con `"plan":"free"` y sin `days`.

## Códigos de promoción
```bash
# crear (sin "code" se genera uno tipo ELA-K7M2-XQ4P); maxUses y expiresInDays son opcionales
curl -X POST https://TU-APP.vercel.app/api/admin/promo \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"CALCULO-2026","days":30,"maxUses":50,"expiresInDays":14,"note":"Grupo 2105"}'
# ver códigos y cuántas veces se han usado
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://TU-APP.vercel.app/api/admin/promo
```
Reglas: un uso por cuenta; al llegar a `maxUses` el siguiente recibe «ya se agotó»; si la persona ya tiene Pro, los días se **suman** al final; hay freno de 10 intentos por hora por cuenta. Reportes recibidos: `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://TU-APP.vercel.app/api/admin/reports`

## Límites honestos
- La prueba se cuenta por correo: alguien puede crear otra cuenta con otro correo para otros 30 días. Es el costo de no pedir tarjeta; el tope diario y el freno global protegen tu gasto de IA.
- El «paso a paso» básico y el acceso a los **exámenes** se controlan en el dispositivo (el contenido es local): quien sepa usar la consola del navegador puede saltarlos. Lo caro —tutor y escáner— sí se valida siempre en el servidor.
- Un examen en curso no sobrevive a recargar la página (se pierde sin guardar resultado).
- Probado con simulaciones de Groq/Anthropic/correo/Redis y en Chromium real contra el servidor local; **aún no contra tus cuentas reales** de Groq, Resend, Upstash ni Vercel.

## Comandos
```bash
npm install
npm test          # ~700 pruebas (motor, lógica, exámenes, UI en jsdom, servidor, cliente↔servidor, despliegue)
npm run dev       # http://localhost:3000 con API simulada: el enlace de acceso aparece en pantalla, IA de mentira sin clave
npm run e2e       # Chromium real: CSP, service worker, offline, login, prueba gratis, tutor, escáner con foto real, examen, código promocional
npm run build:public   # lo que ejecuta Vercel: copia solo la app a ./public
```

## Estructura
```
index.html styles.css manifest.json sw.js      app (PWA)
js/      main, app, api, richtext, logic, exam, image, db, credits, curriculum, engine/ (plantillas por nivel)
api/     funciones de Vercel (11)              server/  config, llm, auth, quota, promo, scan, tutor, prompt, reports, store, mail, routes
tools/   build.mjs, dev-server.mjs, e2e.mjs   test/    pruebas
vercel.json  CSP estricta y cabeceras; publica solo public/
```
El plan Hobby de Vercel permite 12 funciones; hoy hay 11. Si agregas más, une rutas en una sola función antes de pasar el límite.

## Despliegue
1. Sube la carpeta a un repositorio de GitHub e impórtalo en Vercel (Framework: Other; el resto lo toma de `vercel.json`).
2. Añade Upstash Redis y las variables de la tabla (mínimo: `SESSION_SECRET`, `APP_URL`, `ADMIN_TOKEN`, `GROQ_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`; `PAY_INSTRUCTIONS` solo cuando enciendas el cobro). Redeploy.
3. Abre `https://TU-APP.vercel.app/api/health`: debe mostrar `"store":"upstash"`, `"email":true`, `"tutor":true`, `"provider":"groq"`, `"scan":true`.
4. Entra con tu correo: verás «👤 Cuenta» (con el cobro encendido: «🎁 Prueba · 30 d»). Prueba el tutor, el escáner y un examen. Crea un código y canjéalo desde otra cuenta.

> Si algo no carga por la CSP (por ejemplo una fuente externa que añadas), ajusta `Content-Security-Policy` en `vercel.json`; no la quites completa.

## Agregar ejercicios o materias
1. Escribe la plantilla en `js/engine/templates-nX.js` (mira cualquiera como modelo) con un `topic` nuevo o existente.
2. Añade su **oráculo** en `test/oracles/nX.js`: debe resolver el problema por otro camino a partir de `ex.params`. Sin oráculo, las pruebas fallan.
3. Si es un tema nuevo, agrégalo a la materia en `js/curriculum.js`. `npm test` comprueba que todo tema del temario tenga plantillas y que cada materia tenga al menos 4.
