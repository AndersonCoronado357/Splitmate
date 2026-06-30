import pkg from '../../package.json';

/** Versión de la app, leída del package.json (única fuente, no hardcodear). */
export const APP_VERSION: string = pkg.version;
