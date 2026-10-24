import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Troca o link pessoal do amigo por um acesso assinado, que só enxerga as tabelas do Cantus
// (papel "cantus" no banco). Precisa da variável SUPABASE_JWT_SECRET na Vercel.
const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

export async function POST(req) {
  const segredo = process.env.SUPABASE_JWT_SECRET;
  if (!segredo) return NextResponse.json({ erro: 'O acesso de amigos ainda não foi configurado no servidor.' }, { status: 500 });
  const { token } = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(token || ''))) return NextResponse.json({ erro: 'Link inválido.' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r = await fetch(`${url}/rest/v1/rpc/missa_entrar_conta`, {
    method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }), cache: 'no-store'
  });
  const conta = r.ok ? await r.json() : null;
  if (!conta?.id) return NextResponse.json({ erro: 'Link inválido ou desativado.' }, { status: 404 });

  const agora = Math.floor(Date.now() / 1000);
  const exp = agora + 90 * 86400;
  const corpo = { role: 'cantus', aud: 'authenticated', sub: conta.id, conta_id: conta.id, tk: conta.token, iat: agora, exp };
  const parte = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(corpo);
  const jwt = parte + '.' + createHmac('sha256', segredo).update(parte).digest('base64url');
  return NextResponse.json({ jwt, exp, nome: conta.nome });
}
