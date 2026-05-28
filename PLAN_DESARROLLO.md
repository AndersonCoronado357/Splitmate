# Plan de desarrollo — Splitmate

Este documento toma todo lo que cerramos en [DECISIONES.md](DECISIONES.md)
y lo convierte en una **secuencia de pasos pequeños** para construir
la app. Cada paso entrega algo **que se puede probar de verdad** antes
de pasar al siguiente. Antes de empezar cada paso te explico qué voy
a hacer; cuando termino, paras y lo pruebas; cuando lo apruebas,
hacemos commit.

---

## Reglas que aplican a TODOS los pasos (transversal)

Estas no son un paso aparte: son hábitos que mantenemos en cada paso.

- **Seguridad por fila (RLS) desde el primer dato.** Cada tabla nueva
  en Supabase nace con RLS habilitado y políticas que limitan el
  acceso a los miembros del hogar correcto. No "se prende después".
- **Variables de entorno fuera del repo.** Cualquier llave (Supabase,
  Google OAuth, etc.) vive en `.env` local y en el panel del
  proveedor de despliegue. Nunca en el código ni en commits.
- **Validación en cliente y servidor.** Los formularios validan en
  el navegador para UX, pero la base de datos y los endpoints
  validan otra vez. La regla "lo que es importante se valida dos
  veces" aplica a montos, divisiones, fechas y pertenencia al
  hogar.
- **Cálculos de dinero auditables.** Cada saldo debe poder explicarse
  rastreando los movimientos que lo componen. Nada de balances que
  "salen de la nada".
- **Operaciones atómicas en plata.** Un gasto que tiene cabecera +
  divisiones se guarda completo o no se guarda; nada de medio
  registrar.
- **Errores manejados sin filtrar datos sensibles.** Si algo falla,
  el usuario ve un mensaje claro y nada de stack traces ni llaves.
- **Commits frecuentes y atómicos.** Un paso aprobado = un commit
  con un mensaje claro. Sin coautor ni mención de IA: van con tu
  identidad de Git.
- **Mobile-first siempre.** Cada pantalla se diseña primero en
  celular. Escritorio es un ajuste.
- **Texto en español, paleta y tipografía cerradas** (ver
  [DISEÑO.md](DISEÑO.md)).

---

## Fase 0 — Preparación (lo aburrido pero necesario)

### Paso 0.1 · Inicializar el proyecto SvelteKit
- Crear el proyecto SvelteKit con TypeScript, sin demo.
- Configurar `pnpm` (o `npm`, según prefieras — te pregunto antes).
- Agregar Prettier + ESLint con la configuración estándar.
- Verificar que `pnpm dev` levanta el "hola mundo" en el celular
  (mismo wifi, IP de la PC).
- **Se prueba:** abres en el celular `http://<ip-de-la-pc>:5173` y
  ves la página.

### Paso 0.2 · Cuenta de Supabase y conexión local
- Crear un proyecto en Supabase (te paso por allá, yo te explico
  qué clicar).
- Pedirme las llaves: `PUBLIC_SUPABASE_URL` y
  `PUBLIC_SUPABASE_ANON_KEY` (y la `service_role` para tareas de
  servidor, la cuidamos especialmente).
- Crear `.env` local con esas llaves; confirmar que `.gitignore`
  las excluye.
- Instalar el cliente `@supabase/supabase-js` y verificar que
  podemos hacer una llamada `select 1` desde la app.
- **Se prueba:** un endpoint o página de prueba que muestra
  "Conectado a Supabase ✅" si el round-trip funciona.

> **Despliegue diferido al final.** No vamos a desplegar a Cloudflare
> Pages todavía. Durante todo el desarrollo se prueba **en el celular
> contra el dev server local** (mismo wifi, ej.: `http://192.168.1.5:5173/`).
> El despliegue de producción es el último paso, en la Fase 13.

---

## Fase 1 — Identidad visual y acceso directo

> **Sin PWA.** No usamos `manifest.webmanifest` ni service worker. La
> "instalación" en el celular es el atajo nativo del navegador
> (*Añadir a pantalla de inicio*). Esto simplifica el proyecto a
> costa de no tener push en iOS y no funcionar offline. Si más
> adelante hace falta, se vuelve a habilitar PWA mínima.

### Paso 1.1 · Tokens de diseño y layout mobile-first
- Convertir [DISEÑO.md](DISEÑO.md) en variables CSS
  (`--brand-500`, `--money-favor`, `--money-contra`, etc.).
  Esto ya está parcialmente hecho en `src/routes/layout.css`
  vía `@theme` de Tailwind v4.
- Cargar Inter (autohospedada para no depender de Google Fonts).
- Layout base mobile-first: cabecera, contenido, barra inferior.
- Pantalla provisional con muestrario de colores y tipografía
  (ya existe en `+page.svelte`; afinar con Inter cargada).
- **Se prueba:** la paleta y la tipografía se ven en el celular
  exactamente como esperamos.

### Paso 1.2 · Acceso directo en el celular (guía in-app)
- Una pequeña ruta `/como-instalar` con instrucciones paso a paso
  para **iOS (Safari)** y **Android (Chrome)** de cómo añadir el
  sitio a la pantalla de inicio.
- Detectar el sistema operativo del usuario y mostrar primero las
  instrucciones que le aplican.
- Definir un favicon turquesa (con la letra **S** o el isotipo)
  para que el atajo se vea limpio cuando el usuario lo añada.
- Configurar los meta-tags mínimos que el navegador respeta para
  el atajo:
  - `theme-color` (ya está en `#0EB5A6`).
  - `apple-mobile-web-app-title` para el nombre del atajo en iOS.
  - `apple-touch-icon` para el ícono del atajo en iOS.
- **Se prueba:** desde Android y desde iPhone, sigues las
  instrucciones de `/como-instalar` y el atajo aparece en la
  pantalla de inicio con el ícono turquesa y el nombre
  "Splitmate". Al tocarlo se abre el sitio en el navegador.
- **Nota:** no es PWA, así que se abre como una pestaña del
  navegador (no en modo standalone) y no funciona offline.

---

## Fase 2 — Autenticación

### Paso 2.1 · Registro y login con email/contraseña
- Pantallas: registro, login, recuperación de contraseña.
- Sesión persistente (cookie segura) y logout.
- Validación de contraseña razonable (longitud mínima, no contra
  reglas absurdas).
- Páginas protegidas: si no hay sesión, redirige al login.
- **Se prueba:** te registras, sales, vuelves a entrar; la sesión
  sobrevive un cierre del navegador.

### Paso 2.2 · Login con Google
- Configurar el proveedor Google en Supabase (te paso los pasos en
  Google Cloud Console; necesitaré que me confirmes redirect URIs).
- Botón "Continuar con Google" en login y registro.
- Que el mismo usuario pueda llegar por cualquiera de los dos
  caminos sin duplicar cuenta.
- **Se prueba:** entras con Google desde el celular en un toque.

---

## Fase 3 — Hogares y miembros (RLS de verdad)

### Paso 3.1 · Modelo de hogares
- Tablas: `hogares`, `miembros_hogar` (relación usuario↔hogar con
  rol), `invitaciones` (token, código corto, expiración).
- RLS: solo miembros del hogar ven/modifican sus datos.
- Crear hogar (nombre + moneda).
- Selector de hogar (porque un usuario puede estar en varios).
- **Se prueba:** dos cuentas distintas, cada una con su hogar, no
  se ven entre sí. Verificable mirando la base de datos.

### Paso 3.2 · Invitaciones (link + código + QR)
- Generar token único + código corto (6 caracteres) con expiración.
- Página `/unirse/<token>`: muestra el hogar y un botón "Unirme".
- Pantalla para escribir el código corto manualmente.
- Generar y mostrar QR del link de invitación dentro de la app.
- **Se prueba:** desde dos celulares, una persona crea hogar,
  comparte por las tres vías, la otra se une, y ambos ven el
  mismo hogar.

### Paso 3.3 · Tiempo real básico
- Suscripción Supabase a cambios en `miembros_hogar`: cuando entra
  alguien nuevo, los otros lo ven al instante sin recargar.
- **Se prueba:** dos celulares lado a lado, uno acepta la
  invitación, el otro ve aparecer al miembro nuevo.

---

## Fase 4 — Gastos compartidos (módulo 1, núcleo de la app)

### Paso 4.1 · Registrar un gasto (modo "partes iguales")
- Tablas: `gastos_compartidos`, `gasto_divisiones` (línea por
  participante con su parte).
- Formulario: título, monto, fecha, categoría, participantes.
- Solo el usuario actual aparece como "pagador" (el plan: solo
  quien pagó registra).
- RLS: solo miembros del hogar ven sus gastos.
- Validación: monto > 0, al menos un participante, suma de partes =
  monto.
- Operación atómica: cabecera + líneas en una transacción.
- **Se prueba:** registras un gasto, aparece en el historial del
  hogar para todos los miembros.

### Paso 4.2 · Tres modos más de división
- Porcentaje (suma 100 %).
- Monto exacto (suma = total).
- Partes/cuotas (2-1-1 → el monto se reparte proporcional).
- Selector de modo arriba del formulario, recordando el último
  modo usado.
- **Se prueba:** un gasto dividido 60/40 se ve correctamente en
  el detalle y en el balance.

### Paso 4.3 · Categorías
- Tabla `categorias` con `hogar_id` nulo para las predefinidas y
  con `hogar_id` cuando un hogar crea las suyas.
- Lista predefinida sembrada: mercado, domicilios, salidas,
  transporte, hogar, salud, otros.
- Pantalla para crear/editar/borrar categorías propias del hogar.
- **Se prueba:** creas categoría "Mascota", la usas en un gasto,
  todos los miembros la ven.

### Paso 4.4 · Editar y borrar un gasto
- Solo el que lo registró puede editar/borrar (regla cerrada en
  DECISIONES).
- Confirmación antes de borrar.
- Si se edita el monto o la división, el balance se recalcula al
  instante (tiempo real).
- **Se prueba:** otro miembro intenta editar, no puede; el dueño
  edita y el balance cambia para todos.

---

## Fase 5 — Balance y vista principal

### Paso 5.1 · Cálculo de balance entre pares
- Vista (o función) en Supabase que computa el saldo neto entre
  cada par del hogar a partir de gastos y divisiones.
- Sin pagos todavía: el saldo es el resultado directo de los
  gastos.
- Tests manuales con varios casos: gasto simple, gasto donde el
  pagador no participa, varios gastos cruzados.
- **Se prueba:** comparo a mano contra la app con 3 o 4 gastos
  inventados y los números cuadran.

### Paso 5.2 · Pantalla principal (lo primero que se ve)
- Saldo neto total del usuario, en grande, con color (menta o
  coral).
- Debajo: lista por persona ("Ana te debe X", "Le debes Y a
  Pedro"), neteado por par.
- Tap en una persona → detalle de los movimientos que componen ese
  saldo.
- **Se prueba:** abres la app, ves tu saldo total y por persona.
  El detalle cuadra con el agregado.

### Paso 5.3 · Tiempo real del balance
- Suscripción a cambios en gastos y divisiones del hogar.
- El balance se actualiza al instante cuando otro registra un
  gasto.
- **Se prueba:** dos celulares lado a lado: uno registra un gasto,
  el otro ve cambiar su saldo sin tocar nada.

---

## Fase 6 — Pagos que saldan deuda

### Paso 6.1 · Registrar un pago
- Tabla `pagos`: de quién a quién, monto, fecha, estado
  (pendiente / confirmado).
- Quien pagó lo registra; queda **pendiente** hasta que quien
  recibió confirma.
- Mientras está pendiente, no afecta el balance.
- **Se prueba:** registras un pago de 50.000 a Ana; Ana lo ve
  como pendiente; al confirmarlo, tu saldo con ella baja en
  50.000.

### Paso 6.2 · Pagos parciales y total
- Un pago puede ser por cualquier monto; el balance simplemente
  resta.
- Atajo "Saldar todo lo que le debo a X" que precarga el monto
  exacto.
- **Se prueba:** debías 80k, pagas 50k, queda 30k; o usas el
  atajo y queda en cero.

---

## Fase 7 — Préstamos directos (módulo 2)

### Paso 7.1 · Registrar préstamo
- Tabla `prestamos`: prestador, receptor, monto, fecha, motivo,
  fecha esperada de devolución (opcional), estado (pendiente /
  activo / saldado).
- Solo el prestador registra.
- Queda **pendiente** hasta que el receptor confirma; no afecta
  balance hasta entonces.
- **Se prueba:** registras un préstamo, al receptor le aparece la
  petición de confirmación, acepta, y el balance se mueve.

### Paso 7.2 · Pagos asociados a un préstamo
- Tabla `pagos_prestamo` (o reutilizamos `pagos` con un campo
  opcional `prestamo_id`).
- Devolución total o parcial, registrada por quien devolvió y
  confirmada por quien recibió.
- El estado del préstamo pasa a saldado cuando la suma de pagos
  iguala el monto.
- **Se prueba:** devuelves 30k de un préstamo de 50k, queda como
  parcialmente saldado; devuelves los otros 20k y queda saldado.

### Paso 7.3 · Separación visual estricta
- En las pantallas de listado, **gastos compartidos** y
  **préstamos** se muestran en secciones separadas, nunca
  intercalados (regla del plan: tres módulos independientes).
- El balance neteado sí los combina (porque ambos afectan deuda
  entre dos personas), pero el historial los muestra aparte.
- **Se prueba:** miras el historial y se distingue visualmente
  qué es gasto y qué es préstamo.

---

## Fase 8 — Foto del recibo (opcional en cada gasto)

### Paso 8.1 · Compresión en cliente
- En el formulario de gasto, botón "Adjuntar foto".
- Compresión en el navegador antes de subir (objetivo ~100–200 KB
  con calidad legible).
- Subida a Supabase Storage con bucket privado y URL firmada para
  ver.
- Cuota de almacenamiento monitoreada.
- **Se prueba:** subes una foto de 4 MB del cel, llega al storage
  con ~150 KB, y se ve nítida al abrirla.

---

## Fase 9 — Gastos fijos (módulo 3, independiente)

### Paso 9.1 · Plantillas de gasto fijo
- Tablas: `gastos_fijos_plantilla` (nombre, monto base,
  periodicidad, modo de reparto, reparto por miembro) y
  `gastos_fijos_mes` (instancia mensual generada).
- Pantalla aparte: el módulo no comparte vista con gastos
  compartidos.
- Configuración del reparto por cada plantilla (iguales, %,
  exacto, partes).
- **Se prueba:** creas "Arriendo 2.000.000, 60/40", aparece la
  cuota del mes en curso con cada parte calculada.

### Paso 9.2 · Aportes y avance del mes
- Cada miembro marca su aporte (monto + fecha) a cada gasto fijo
  del mes.
- Indicador de avance: "3 de 4 aportaron", "Te falta tu parte de
  Luz".
- Este módulo **no** genera deuda entre personas si alguien no
  aporta: queda visible como pendiente del fijo.
- **Se prueba:** marcas tu aporte, los otros ven el indicador
  cambiar.

### Paso 9.3 · Cierre automático de mes
- Cron diario (o lógica al primer acceso del mes) que cierra el
  mes anterior y crea las cuotas del mes nuevo a partir de las
  plantillas.
- Mes cerrado queda archivado con su resumen.
- **Se prueba:** simulamos el cambio de mes; vemos el mes
  anterior archivado y las cuotas nuevas listas.

---

## Fase 10 — Notificaciones push (Web Push, solo Android)

> **Limitación heredada de no usar PWA:** Web Push funciona en
> Android (Chrome y derivados) sin PWA, pero **no en iOS** (Apple
> exige sitio instalado como PWA). Si en algún momento se necesita
> iOS, hay que volver a habilitar manifest + service worker.

### Paso 10.1 · Permiso y registro
- Pedir permiso de notificación cuando el usuario completa el
  registro y entra a un hogar (no antes, para no asustar).
- Si el navegador es iOS Safari, **no pedir permiso** y mostrar
  en su lugar un mensaje suave: *"Las notificaciones push no están
  disponibles en iPhone con este modo de instalación."*
- Guardar el endpoint de push del navegador en Supabase (solo en
  los navegadores soportados).
- **Se prueba:** en Android das permiso y ves el endpoint
  guardado; en iPhone ves el mensaje informativo y no se guarda
  nada.

### Paso 10.2 · Eventos que disparan push
- Gasto registrado que me incluye → push a los participantes.
- Confirmación pendiente para mí (préstamo o pago) → push.
- Recordatorio mensual de aporte a un fijo no marcado → push una
  vez por fijo del mes.
- Edge function en Supabase con la `service_role` para firmar
  pushes.
- **Se prueba:** desde un Android registras un gasto y otro
  Android recibe push aunque tenga el navegador cerrado (pero
  con el sitio abierto recientemente). iOS no recibe.

---

## Fase 11 — Simplificación de deudas (sugerencia)

### Paso 11.1 · Algoritmo
- Calcular el mínimo de transacciones para que todos queden a
  cero (greedy clásico: ordenar acreedores y deudores, cerrar
  par mayor con par mayor, repetir).
- Mostrar el resultado solo como **sugerencia**: "se puede
  saldar todo en X pagos en vez de Y".
- El balance por defecto sigue siendo el neteado por pareja, no
  el simplificado.
- **Se prueba:** caso con 4 personas y deudas cruzadas, la
  sugerencia es razonable y los pagos propuestos efectivamente
  dejan a todos en cero si se aplican.

---

## Fase 12 — Resúmenes y filtros

### Paso 12.1 · Resumen mensual del hogar
- Vista de lectura que combina gastos compartidos + fijos del
  mes (sin tocar sus cálculos): total, top categorías, aporte
  por persona.
- **Se prueba:** abres el mes anterior, los números cuadran con
  ir sumando manualmente.

### Paso 12.2 · Mi gasto personal del mes
- Lo mismo pero filtrado a "lo que yo aporté/gasté".
- **Se prueba:** comparas con el resumen del hogar y los números
  encajan.

### Paso 12.3 · Filtros del historial
- Filtro por categoría y por miembro.
- Búsqueda por texto del título.
- **Se prueba:** filtras por "mercado" y por "Ana" y ves solo
  lo correspondiente.

---

## Fase 13 — Pulido final y producción

### Paso 13.1 · Auditoría de seguridad antes de salir
- Revisar todas las políticas RLS: probar acceder a datos de otro
  hogar con un usuario que no pertenece, debe rebotar.
- Auditar dependencias (`pnpm audit` o equivalente) y actualizar
  lo crítico.
- Verificar que ninguna llave secreta está en el repo.
- Revisar manejo de errores: que ningún error filtre datos
  sensibles al cliente.

### Paso 13.2 · Rendimiento mobile
- Lighthouse en móvil: objetivo verde en performance, accessibility
  y best practices. La métrica PWA se ignora (no aplica).
- Comprimir SVGs, lazy-load donde aplique.

### Paso 13.3 · Despliegue de producción
- Dominio propio (opcional) o el dominio gratis del proveedor.
- Variables de entorno revisadas.
- Backup automático de Supabase confirmado.
- **Se prueba:** desde un celular nuevo, añades el sitio a la
  pantalla de inicio (siguiendo `/como-instalar`), te registras,
  creas un hogar, invitas, registras gastos. Todo el flujo de
  punta a punta.

---

## Lo que NO entra en el MVP (lista explícita)

Para que no se nos cuele scope creep:

- Exportar a CSV / Excel.
- Multi-moneda con conversión.
- Resúmenes por push (semanal/mensual automáticos).
- Estadísticas avanzadas / gráficos detallados.
- Modo oscuro (puede ser fase 14 si lo quieres).
- Comentarios o "notas largas" en gastos.
- Roles avanzados en el hogar (admin vs miembro). Por ahora todos
  iguales, y el creador del hogar es el único con permiso de
  cambiar moneda/borrar hogar.

---

## Orden corto para empezar

1. Paso 0.1 — scaffold SvelteKit + Tailwind + adapter Cloudflare
   (HECHO).
2. Tú pruebas en el celular contra `http://192.168.1.5:5173/`.
3. Cuando avises, commit local.
4. Paso 0.2 — conectar Supabase (necesitaré que me pases las llaves
   del proyecto Supabase).
5. Y así, paso a paso. **Sin despliegue hasta la Fase 13.**
