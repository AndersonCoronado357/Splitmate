// Notificaciones server-side. En acmsy no hay realtime/broadcast (era Supabase),
// asi que es un no-op: las acciones que "avisaban" siguen funcionando sin enviar
// nada. Los datos se refrescan por polling en el cliente. (Se puede reimplementar
// con web-push propio o SSE mas adelante.)
export type PushPayload = {
	title: string;
	body?: string;
	url?: string;
	tag?: string;
	icon?: string;
	badge?: string;
};

export async function enviarPushAUsuario(_userId: string, _payload: PushPayload): Promise<void> {
	// no-op
}

export async function enviarPushAUsuarios(_userIds: string[], _payload: PushPayload): Promise<void> {
	// no-op
}
