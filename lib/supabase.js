import { createClient } from '@supabase/supabase-js';
import { lerConta } from './conta';

// Administrador: login normal (e-mail e senha).
// Amigo (conta do Cantus): usa o acesso assinado recebido ao abrir o link pessoal.
const conta = lerConta();
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  conta ? {
    global: { headers: { Authorization: `Bearer ${conta.jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cantus-conta' }
  } : undefined
);
