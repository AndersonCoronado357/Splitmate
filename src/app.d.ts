// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			// La session que enviamos al cliente está APLANADA (sin `.user`,
			// que dispara warnings de supabase-js cuando se serializa).
			// El usuario validado va en `user` y se usa desde ahí.
			session: Omit<Session, 'user'> | null;
			user: User | null;
		}
		// interface PageState {}
	}
}

export {};
