// Tipos globales de la app. Auth y datos los provee acmsy (sin Supabase).
import type { DbClient } from '$lib/server/sb';

type AppUser = {
	id: string;
	email: string;
	created_at: string | null;
	user_metadata: Record<string, unknown>;
};
type AppSession = {
	access_token: string;
	refresh_token: string;
	expires_at: number;
	expires_in: number;
	token_type: string;
};

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: DbClient;
			safeGetSession: () => Promise<{ session: AppSession | null; user: AppUser | null }>;
			session: AppSession | null;
			user: AppUser | null;
		}
		interface PageData {
			session: AppSession | null;
			user: AppUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
