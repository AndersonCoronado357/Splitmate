// Estado compartido: true mientras se está cambiando de hogar activo. Lo pone
// el selector (HogarSwitcher) y lo lee el layout para mostrar un skeleton en el
// contenido mientras se recargan los datos del nuevo hogar.
export const cambioHogar = $state({ activo: false });
