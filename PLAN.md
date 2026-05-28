# Plan de trabajo — Splitmate (App de Gastos Compartidos del Hogar)

## Cómo usar este documento

Este no es un plano cerrado. Es un punto de partida. Tu primer trabajo no es
programar, sino **ayudarme a definir bien la idea**: qué hace la app, cómo la
quiero, qué necesito. Entrevístame, propón, y construye solo cuando hayamos
cerrado las cosas juntos.

No asumas detalles por tu cuenta. Pregúntame. Cuando haya que decidir algo
técnico, propón opciones con una recomendación y espera mi aprobación.
Explícame lo técnico en simple; no asumas que tengo experiencia.

---

## La idea (a grandes rasgos)

App web mobile-first (se puede añadir a la pantalla de inicio como
acceso directo del navegador, sin PWA) para los miembros de un hogar
(familia, pareja o roommates). El problema que resuelve: en una casa se comparten
gastos y se prestan plata, pero la gente se enreda con quién pagó qué y quién le
debe a quién. La app lleva esa cuenta clara y automática, para que nadie discuta
ni tenga que recordar de memoria.

Cada persona tiene su cuenta, se unen a un mismo "hogar", y desde el celular
registran lo que pasa. Lo primero que ven al abrir es su saldo: cuánto le deben o
cuánto debe.

Lo demás de la idea lo terminamos de definir entre los dos.

---

## Los tres módulos (son independientes entre sí)

1. **Gastos compartidos.** Gastos puntuales que se reparten entre miembros
   (mercado, una salida, un domicilio). Alguien paga y se divide entre quienes
   corresponda. Esto alimenta el balance de "quién debe a quién".

2. **Préstamos directos.** Una persona le presta plata a otra, sin dividir nada
   entre el grupo. Suma o resta al saldo entre esas dos personas. Va aparte de los
   gastos compartidos.

3. **Gastos fijos (módulo separado).** Arriendo, servicios, internet: los costos
   recurrentes de sostener la casa. Este módulo NO se mezcla con el balance de
   deudas; sirve para saber cuánto cuesta la casa al mes y quién aportó su parte.
   Tiene su propia vista y su propia lógica.

Mantener estos tres módulos separados es una decisión de diseño: no deben
entremezclarse en la misma pantalla ni en el mismo cálculo.

---

## Lo que ya está decidido (no hace falta volver a preguntármelo)

- **Nombre de la app:** **Splitmate** (de *split* "dividir" + *mate* "compañero":
  el compañero para dividir los gastos de la casa).
- **Stack:** SvelteKit · Supabase (base de datos Postgres, login, almacenamiento
  de fotos de recibos, tiempo real) · Cloudflare Pages (publicación).
  Todo en capa gratuita.
- **Mobile-first:** la app es principalmente para celular. No usamos PWA
  (sin manifest ni service worker): el usuario la "instala" como acceso
  directo a través del navegador (iOS Safari → *Compartir* → *Añadir a
  inicio*; Android Chrome → menú ⋮ → *Añadir a pantalla de inicio*). El
  escritorio es secundario.
- **Multi-usuario real:** cada miembro del hogar tiene su propia cuenta. El balance
  se actualiza en vivo (tiempo real de Supabase) cuando otro registra algo.
- **Identidad visual (ya definida):**
  - Tipografía: **Inter** en todo.
  - Acento de marca: **turquesa #0EB5A6**.
  - Escala turquesa: #E6F7F5 · #9FE3DC · #46C9BC · #0EB5A6 · #0A8A7E · #075C54.
  - Neutros: fondo #FBFCFC · gris claro #EEF1F0 · gris medio #9AA6A3 · texto #16201E.
  - Dinero: **a favor #2BB673** (menta) · **en contra #FF6B6B** (coral).
  - Regla fija: el verde/menta es siempre "te deben / a favor" y el coral siempre
    "debes / en contra", para que el balance se entienda de un vistazo.

---

## Funciones del MVP (lo mínimo para que sirva)

- Crear un hogar e invitar miembros con un código o link.
- Registrar un gasto compartido: monto, quién pagó, entre quiénes se divide.
- Registrar un préstamo directo entre dos personas.
- Balance automático: "tú debes X a Ana" / "Pedro te debe Y", ya neteado.
- Marcar deudas como pagadas (abono total o parcial).
- Módulo de gastos fijos: registrar los recurrentes y marcar quién aportó su parte
  cada mes.

## Funciones extra (a evaluar juntos, no todas de una)

- Simplificación de deudas: el mínimo de pagos para que todos queden en cero.
- División flexible: partes iguales, por porcentaje o por monto exacto.
- Foto del recibo adjunta a cada gasto.
- Recordatorios de deuda pendiente y de gasto fijo próximo a vencer.
- Resumen mensual: total de la casa, aporte de cada quien, deudas abiertas.
- Filtros por miembro y por categoría.
- Historial con fecha y quién registró cada movimiento.

---

## Enfoque DevSecOps

La seguridad y las buenas prácticas van desde el inicio y en cada etapa, no al
final. Ténlo presente y propónme lo que corresponda:

- Manejo seguro de secretos (nunca en el código ni en Git).
- Aislamiento real de datos: cada usuario solo accede a los datos de su hogar
  (seguridad por fila / RLS en Supabase).
- Validación de entradas tanto en el cliente como en el servidor (montos, fechas,
  divisiones que cuadren).
- Control de acceso en cada ruta y en la base de datos.
- Dependencias revisadas y actualizadas; alértame de vulnerabilidades.
- Que la plata nunca quede en estados inconsistentes: las operaciones que afectan
  el balance deben ser confiables (que un gasto se guarde completo o no se guarde).
- Las llamadas a Supabase con manejo de errores y sin filtrar datos sensibles.
- Que la app no se rompa ni filtre información cuando algo falla.
- Despliegue con buenas prácticas (variables de entorno, permisos mínimos).

Cuando tomes una decisión que afecte seguridad, explícame por qué.

---

## Cómo quiero que trabajemos

1. **Primero, definir la idea juntos.** Hazme preguntas (por bloques, no todas de
   golpe) hasta entender qué quiero: cómo se divide un gasto, qué pasa con un
   préstamo, cómo quiero ver el balance, cómo funcionan los gastos fijos mes a mes,
   cómo se salda una deuda, cómo me imagino el uso diario, y cualquier extra que
   tenga en mente. Resúmeme lo que entendiste y confírmalo conmigo.

2. **Luego, proponer el plan.** Con eso claro, propón el modelo de datos, las
   pantallas, el flujo y el orden de construcción. Déjame ajustarlo y ciérralo
   conmigo.

3. **Después, construir en pasos pequeños.** Cada paso: me explicas qué vas a
   hacer, lo construyes, paras para que yo lo pruebe, y haces commit cuando lo
   apruebo. Siempre empieza por lo mínimo que se pueda probar.

---

## Cosas a tener presentes durante todo el proyecto

- Es para un grupo pequeño (los miembros de una casa): datos aislados por hogar.
- Capa gratuita: el almacenamiento de fotos es limitado, así que las imágenes de
  recibos se comprimen antes de subir.
- El dinero es delicado: prioriza que los cálculos del balance sean exactos y
  fáciles de auditar (que siempre se pueda ver de dónde sale cada saldo).

## Convenciones

- Todo el texto de la app en español.
- Mobile-first; el escritorio es secundario.
- Sin degradados de color en la interfaz.
- Usa la paleta y la tipografía ya definidas (turquesa + Inter).
- El verde/menta es siempre "a favor" y el coral siempre "en contra".
- Pregúntame antes de asumir. Propón antes de decidir solo.
- Los commits van a mi nombre (usa mi identidad de Git ya configurada en la
  máquina). No agregues coautores, menciones de IA ni firmes los commits con
  otro nombre, salvo que yo lo pida explícitamente.

---

## Variables de entorno

Para conectar Supabase hacen falta unas claves/valores (URL del proyecto, llave
pública, y las llaves de servidor que correspondan). No las inventes ni las
busques: cuando necesites una variable, **pídemela** y yo te la paso por el chat.
Tú te encargas de agregarla donde corresponda (al `.env` local y, en el
despliegue, al panel de Cloudflare Pages).

Confirma que el archivo de entorno está en `.gitignore` antes de cualquier commit.
Nunca imprimas las claves en pantalla ni las subas a Git.
