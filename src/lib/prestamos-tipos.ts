// Tipos y constantes de préstamos compartidos entre cliente y servidor.
// Vive fuera de $lib/server para que la UI los pueda importar sin filtrar
// nada sensible (son solo enums y diccionarios de strings).

export type EstadoPrestamo = 'pendiente' | 'activo' | 'saldado' | 'rechazado';

// Cómo se acordó devolver el préstamo. Solo 3 modos: iguales reparte parejo,
// porcentaje fija qué % de la deuda corresponde a cada cuota, exacto define
// montos puntuales por cuota.
export type TipoPagoPrestamo = 'iguales' | 'porcentaje' | 'exacto';

export const TIPO_PAGO_LABEL: Record<TipoPagoPrestamo, string> = {
	iguales: 'Cuotas iguales',
	porcentaje: 'Por porcentaje',
	exacto: 'Montos exactos'
};

export const TIPO_PAGO_DESC: Record<TipoPagoPrestamo, string> = {
	iguales: 'Varias cuotas del mismo monto.',
	porcentaje: 'Cada cuota es un porcentaje del total.',
	exacto: 'Cuotas con montos específicos acordados.'
};
