# Decisiones cerradas en la entrevista

Este archivo va creciendo a medida que cerramos cosas en la entrevista
previa al código. No es un plan técnico todavía: es la lista de "qué
queremos" para que después yo te proponga el modelo de datos y las
pantallas con todo esto ya claro.

---

## Bloque 1 — Hogar y miembros

- **Tamaño del hogar:** variable. No asumir un N fijo; la app debe
  funcionar igual de bien con 2 personas que con 8+.
- **Invitación a un hogar:** soportar **tres formas** (el creador elige
  cuál usar en el momento):
  - Link de invitación.
  - Código corto (numérico o alfanumérico).
  - Código QR (mostrar el QR en pantalla para que el otro lo escanee).
- **Multi-hogar por persona:** sí. Una cuenta puede pertenecer a varios
  hogares al mismo tiempo (ej.: pareja + casa de los papás + viaje con
  amigos). Habrá un selector de hogar.
- **Registro de cuenta:**
  - Email + contraseña.
  - Login con Google.
  - (Magic link queda descartado por ahora.)

---

## Bloque 2 — Gastos compartidos (formas de dividir y registro)

- **Formas de dividir que ofrecer:** las cuatro.
  - Partes iguales entre los seleccionados (es el caso más común).
  - Por porcentaje (ej.: 60/40).
  - Monto exacto por persona (la app valida que sumen el total).
  - Por partes/cuotas (ej.: 2-1-1, para cuando alguien usa/come más).
- **División por defecto al crear un gasto:** partes iguales entre los
  seleccionados (más rápido en el día a día). Las otras se eligen
  cambiando el modo.
- **El que paga en la división:** por defecto **está incluido**, pero
  se puede destildar caso a caso (ej.: 'compré algo solo para mi
  pareja').
- **Quién puede registrar un gasto:** **solo el miembro que pagó**.
  No se pueden registrar gastos en nombre de otro. Si alguien pagó,
  debe abrir su cuenta y registrarlo él mismo.

---

## Bloque 3 — Detalles de un gasto compartido

- **Categorías:** lista fija predefinida (mercado, domicilios, salidas,
  transporte, hogar, salud, otros — la cerramos al diseñar) **más** la
  opción de que cada hogar cree sus propias categorías.
- **Campos al registrar un gasto** (además de monto, pagador y división):
  - Descripción corta / título (obligatorio).
  - Fecha del gasto (por defecto hoy, editable).
  - Foto del recibo (opcional, ver compresión abajo).
  - (Sin nota larga por ahora — si después aparece la necesidad, se
    agrega.)
- **Editar / borrar un gasto:** solo el miembro **que lo registró**
  (que es también el que pagó) puede editarlo o borrarlo. Los demás
  lo ven en el historial pero no lo tocan.
- **Foto del recibo:** se permite, pero **comprimida agresivo** en el
  celular antes de subir (calidad legible, ~100–200 KB), para
  aprovechar la capa gratuita de Supabase Storage.

---

## Bloque 4 — Préstamos directos

- **Quién registra:** solo **quien prestó** la plata (mismo criterio que
  con los gastos: el que pone la plata es el que tiene el dato).
- **Confirmación de la otra parte:** sí. Cuando alguien registra que
  prestó, al receptor le aparece para **confirmar/aceptar**:
  - Si acepta → el préstamo queda activo y mueve el balance.
  - Si no acepta (o aún no responde) → queda en estado **pendiente** y
    **no** afecta el balance todavía.
- **Campos del préstamo:**
  - Monto.
  - De quién a quién.
  - Fecha del préstamo.
  - Motivo / descripción corta.
  - Fecha esperada de devolución (opcional; si se llena, se puede
    recordar más adelante).
  - (Sin foto/comprobante por ahora.)
- **Cómo se salda:** registrando uno o varios **pagos asociados** al
  préstamo, totales o parciales. El préstamo queda en estado
  `pendiente de confirmar`, `parcialmente pagado` o `saldado`. Cada
  pago lo registra quien devolvió y lo confirma quien recibió.
- **Importante:** los préstamos directos suman/restan al balance entre
  dos personas, **aparte** de los gastos compartidos (los dos
  conviven en el balance final neteado, pero como conceptos separados
  en el historial).

---

## Bloque 5 — Gastos fijos (módulo independiente)

Recordatorio: este módulo **no** se mezcla con el balance de deudas.
Es para saber cuánto cuesta sostener la casa y quién aportó su parte.

- **Reparto por gasto fijo:** **configurable por cada fijo**. Cada
  gasto fijo define su propia forma de repartirse (iguales, %, monto
  exacto, partes). Permite arriendo 60/40 y luz 50/50 sin obligar a
  unificar todo.
- **Definición y recurrencia:** el gasto fijo se **define una vez
  como plantilla** (nombre, monto base, periodicidad, reparto). Cada
  periodo la app **genera la cuota de ese mes** lista para que cada
  miembro marque su aporte. Si el monto del mes cambia (típico en
  servicios), se edita ese mes sin tocar la plantilla.
- **Aporte mensual:** cada miembro **marca su propio aporte** (monto
  y fecha). La pantalla del mes muestra el avance ('3 de 4
  aportaron'). El módulo NO genera deuda entre personas si alguien
  no aporta: solo lo deja visible como pendiente del fijo. Si en la
  vida real alguien cubrió la parte de otro, eso se registra en
  préstamos directos, no acá.
- **Cierre de mes:** automático al cambiar de mes. El mes anterior
  queda archivado con su resumen (total, quién aportó cuánto, qué
  quedó sin aportar). Consultable siempre. Lo no aportado queda
  visible como "pendiente del mes X".

---

## Bloque 6 — Balance y saldar deudas

- **Pantalla principal (al abrir la app):**
  - Arriba, **saldo neto total** del usuario en el hogar activo, en
    grande y con color (verde menta = a favor, coral = en contra).
  - Debajo, **desglose por persona**: 'Ana te debe X', 'Le debes Y
    a Pedro'.
  - Es la primera vista, antes que el feed de movimientos.
- **Cómo se calcula el saldo entre dos personas:** **neteado por
  pareja**. Una sola línea ('Le debes 30k a Pedro'), aunque por
  debajo haya varios movimientos que suman y restan. Al tocar a la
  persona, se ve el detalle (los gastos y préstamos que produjeron
  ese saldo).
- **Simplificación de deudas:** **sí, pero como sugerencia opcional**.
  El balance por defecto se muestra neteado por pareja. Si la app
  detecta que se pueden reducir pagos (ej.: en vez de 4 transacciones,
  con 2 quedan todos a cero), aparece un aviso 'Sugerimos simplificar:
  X pagos en vez de Y' y el usuario decide si aplicarla.
- **Cómo se registra un pago que salda deuda:** **quien pagó lo
  registra; quien recibió confirma**. El monto reduce el balance entre
  ambos. Mismo patrón que pagos de préstamos directos.
- **Trazabilidad:** desde el saldo con cualquier persona, debe poderse
  llegar al detalle de gastos, préstamos y pagos que lo produjeron
  (el plan exige cálculos auditables).

---

## Bloque 7 — Uso diario, notificaciones, moneda y extras

- **Notificaciones push (vía navegador, no PWA):**
  - Cuando alguien registra un gasto que me incluye en la división.
  - Cuando me piden confirmar un préstamo o un pago (cualquier acción
    que esté esperando por mí).
  - Recordatorio mensual de aporte a un gasto fijo (suave, una vez
    por gasto fijo del mes).
  - (Por ahora sin resumen semanal/mensual automático por push.)
  - **Limitación importante por la decisión de no usar PWA:** Web
    Push funcionará en Android (Chrome) directamente desde el
    navegador, pero **no en iOS** (Apple solo permite push en sitios
    instalados como PWA). Si más adelante quieres push en iPhone,
    tendremos que volver a habilitar PWA mínima (manifest + service
    worker).
- **Moneda:** **una sola moneda por hogar**, configurable al crear el
  hogar (ej.: COP, MXN, USD, EUR…). Todo el hogar opera en esa
  moneda. Sin conversiones ni multi-moneda en el MVP.
- **Resúmenes / vistas adicionales:**
  - **Resumen mensual del hogar:** total gastado en el mes, reparto,
    top categorías. Une compartidos + fijos en una vista de
    **lectura** (no mezcla cálculos del balance).
  - **Mi gasto personal del mes:** cuánto aporté yo (compartidos +
    fijos), para autoconciencia individual.
  - **Filtros por categoría y por miembro** en el historial.
  - (Exportar a CSV/Excel queda fuera del MVP.)

---

## Cerrado para pasar a propuesta técnica

Con esto cubrimos los siete bloques. Próximo paso: propuesta de
modelo de datos (tablas, RLS), pantallas/flujos clave y orden de
construcción del MVP, todo basado en lo de arriba.

