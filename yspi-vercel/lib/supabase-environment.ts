// Server-only values. This application never needs a Supabase service/secret key.
export function supabaseEnvironment() {
  return {
    YSPI_AUTH_MODE: process.env.YSPI_AUTH_MODE || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  };
}
