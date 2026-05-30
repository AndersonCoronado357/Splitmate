// Aplica un archivo .sql contra la base de datos de Supabase.
// Uso: node --env-file=.env scripts/migrate.mjs supabase/migrations/001_hogares.sql
// Requiere SUPABASE_DB_PASSWORD en el entorno. Prueba conexión directa y,
// si falla, la del pooler (si se define DATABASE_URL).
import pg from 'pg';
import { readFileSync } from 'node:fs';

const REF = 'ioqnccmmtqzloaglzzqi';
const PW = process.env.SUPABASE_DB_PASSWORD;
const file = process.argv[2] ?? 'supabase/migrations/001_hogares.sql';

if (!PW) {
	console.error('Falta SUPABASE_DB_PASSWORD en el entorno.');
	process.exit(1);
}

const sql = readFileSync(file, 'utf8');

// Candidatas de conexión (IPv4-friendly primero no aplica sin región; probamos directa).
const candidatas = [
	process.env.DATABASE_URL,
	`postgresql://postgres:${PW}@db.${REF}.supabase.co:5432/postgres`
].filter(Boolean);

let aplicado = false;
for (const url of candidatas) {
	const client = new pg.Client({
		connectionString: url,
		ssl: { rejectUnauthorized: false },
		connectionTimeoutMillis: 15000
	});
	try {
		await client.connect();
		await client.query(sql);
		console.log('OK: migración aplicada con', url.replace(/:[^:@/]+@/, ':****@'));
		aplicado = true;
		await client.end();
		break;
	} catch (e) {
		console.error('Falló con', url.replace(/:[^:@/]+@/, ':****@'), '→', e.message);
		await client.end().catch(() => {});
	}
}

if (!aplicado) {
	console.error('No se pudo aplicar la migración con ninguna conexión.');
	process.exit(1);
}
