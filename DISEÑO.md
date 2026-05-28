# Diseño visual — Splitmate

Fuente única de verdad para los colores, la tipografía y las reglas
visuales del proyecto. Si algo de la interfaz no respeta esto, hay
que corregirlo. Cuando lleguemos al paso 1.1 del plan de desarrollo,
estos tokens se vuelcan a variables CSS (`--brand-500`, etc.).

---

## Identidad

- **Nombre:** Splitmate.
- **Significado:** *split* (dividir) + *mate* (compañero) → el
  compañero para dividir los gastos de la casa.
- **Personalidad visual:** limpia, plana, mobile-first, sin
  degradados, con un acento turquesa que evoca confianza y calma
  (no es un color "de billetera agresiva", es un color "de cuentas
  en orden").

---

## Tipografía

- **Familia única:** **Inter** en toda la app.
- **Hospedaje:** autohospedada en la app (no Google Fonts en
  CDN), por privacidad y para evitar dependencias externas.
- **Pesos a incluir:** 400 (Regular), 500 (Medium), 600
  (SemiBold), 700 (Bold).
- **Tamaños base recomendados (mobile-first):**

  | Token        | px | Uso                                  |
  |--------------|----|--------------------------------------|
  | `text-xs`    | 12 | metadatos, timestamps                |
  | `text-sm`    | 14 | texto secundario, etiquetas          |
  | `text-base`  | 16 | cuerpo                               |
  | `text-lg`    | 18 | títulos pequeños / botones grandes   |
  | `text-xl`    | 22 | títulos de sección                   |
  | `text-2xl`   | 28 | títulos de pantalla                  |
  | `text-money` | 36 | saldo destacado en pantalla inicio   |

- **Altura de línea:** 1.4 para cuerpo, 1.2 para títulos.
- **Números:** usar `font-variant-numeric: tabular-nums` en
  cualquier monto, para que las cifras se alineen en columnas.

---

## Paleta — Acento de marca (turquesa)

El turquesa es el acento principal. **No** usar degradados.

| Token            | Hex       | Uso recomendado                                  |
|------------------|-----------|--------------------------------------------------|
| `brand-50`       | `#E6F7F5` | fondos suaves, hover muy sutil                   |
| `brand-200`      | `#9FE3DC` | bordes activos, estados deshabilitados de marca  |
| `brand-400`      | `#46C9BC` | iconos secundarios, separadores con énfasis      |
| **`brand-500`**  | `#0EB5A6` | **color principal** (botones, links, foco)       |
| `brand-700`      | `#0A8A7E` | hover de botones, énfasis fuerte                 |
| `brand-900`      | `#075C54` | textos sobre fondos claros que pidan más peso    |

---

## Paleta — Neutros

| Token       | Hex       | Uso                                       |
|-------------|-----------|-------------------------------------------|
| `bg`        | `#FBFCFC` | fondo de la app                           |
| `surface`   | `#FFFFFF` | tarjetas, modales, hojas inferiores       |
| `border`    | `#EEF1F0` | bordes, separadores                       |
| `muted`     | `#9AA6A3` | texto secundario, placeholders            |
| `text`      | `#16201E` | texto principal                           |

---

## Paleta — Dinero (semántica fija)

Esto es regla, no preferencia. **El verde menta es siempre "a favor"
(te deben). El coral es siempre "en contra" (debes).** Nunca invertir.

| Token            | Hex       | Uso                                            |
|------------------|-----------|------------------------------------------------|
| `money-favor`    | `#2BB673` | montos a favor, saldos positivos, "te deben"   |
| `money-favor-bg` | `#E6F7EE` | fondo suave para destacar bloque a favor       |
| `money-contra`   | `#FF6B6B` | montos en contra, saldos negativos, "debes"    |
| `money-contra-bg`| `#FFECEC` | fondo suave para destacar bloque en contra     |
| `money-neutral`  | `#16201E` | montos sin signo (ej.: total del hogar)        |

---

## Paleta — Estado del sistema

Para mensajes de la app (errores, avisos, confirmaciones). No mezclar
con la paleta de "dinero".

| Token      | Hex       | Uso                                          |
|------------|-----------|----------------------------------------------|
| `info`     | `#0EB5A6` | (reusa `brand-500`)                          |
| `success`  | `#2BB673` | confirmación de acción correcta              |
| `warning`  | `#E2A800` | avisos suaves                                |
| `danger`   | `#D64545` | errores, acciones destructivas               |

---

## Estados de interacción

- **Hover de botón primario:** `brand-700` sobre `brand-500`.
- **Pressed/active:** opacidad 0.9 sobre el color base, sin
  cambio de color.
- **Focus visible:** anillo de 2 px en `brand-500` con
  separación de 2 px. Imprescindible para accesibilidad
  (teclado y lectores).
- **Disabled:** `muted` con opacidad 0.5; cursor `not-allowed`
  en escritorio.

---

## Forma y espacio

- **Bordes redondeados:**
  - Botones e inputs: 12 px.
  - Tarjetas: 16 px.
  - Modales / hojas inferiores: 20 px.
- **Espaciado base (escala 4):** 4, 8, 12, 16, 20, 24, 32, 48.
- **Touch targets:** mínimo 44×44 px en mobile.
- **Sombras:** muy sutiles, una sola variante (sombra de tarjeta):
  `0 1px 2px rgba(22, 32, 30, 0.06), 0 2px 8px rgba(22, 32, 30, 0.04)`.
  Nada de sombras dramáticas.

---

## Reglas que NO se rompen

- **Sin degradados.** Color plano siempre.
- **Verde menta = a favor; coral = en contra.** Nunca invertir.
- **Texto en español** en toda la interfaz.
- **Mobile-first.** El diseño nace en celular; escritorio se
  adapta.
- **Una sola familia tipográfica:** Inter.
- **Iconos:** un solo set consistente (sugerencia: Lucide o
  Heroicons outline — lo cerramos antes de empezar el paso 1.1).

---

## Tokens listos para CSS (vista previa)

Cuando lleguemos al paso 1.1, estos tokens entran como variables
CSS en `:root`. Aquí queda como referencia:

```css
:root {
  /* Marca */
  --brand-50:  #E6F7F5;
  --brand-200: #9FE3DC;
  --brand-400: #46C9BC;
  --brand-500: #0EB5A6;
  --brand-700: #0A8A7E;
  --brand-900: #075C54;

  /* Neutros */
  --bg:      #FBFCFC;
  --surface: #FFFFFF;
  --border:  #EEF1F0;
  --muted:   #9AA6A3;
  --text:    #16201E;

  /* Dinero */
  --money-favor:     #2BB673;
  --money-favor-bg:  #E6F7EE;
  --money-contra:    #FF6B6B;
  --money-contra-bg: #FFECEC;
  --money-neutral:   #16201E;

  /* Sistema */
  --success: #2BB673;
  --warning: #E2A800;
  --danger:  #D64545;

  /* Forma */
  --radius-input:  12px;
  --radius-card:   16px;
  --radius-modal:  20px;

  /* Sombra */
  --shadow-card: 0 1px 2px rgba(22,32,30,.06), 0 2px 8px rgba(22,32,30,.04);
}
```
