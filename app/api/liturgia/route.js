import { NextResponse } from 'next/server';
import { lerDia } from '@/lib/liturgia';

// Busca a liturgia de um dia no site das Edições CNBB (pelo servidor, para não depender do navegador).
// Uso: /api/liturgia?data=2026-10-25 (com &completo=1 traz também as leituras)
export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const data = params.get('data') || '';
  const completo = params.get('completo') === '1';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ erro: 'Data inválida.' }, { status: 400 });
  try {
    const r = await fetch(`https://api-liturgia.edicoescnbb.com.br/contents/in/date/${data}`, {
      headers: { Accept: 'application/json', Referer: 'https://liturgiadiaria.edicoescnbb.com.br/', Origin: 'https://liturgiadiaria.edicoescnbb.com.br' },
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return NextResponse.json({ erro: 'A liturgia deste dia não foi encontrada.' }, { status: 404 });
    const j = await r.json();
    const dia = lerDia(j?.content, completo);
    if (!dia) return NextResponse.json({ erro: 'A liturgia deste dia não foi encontrada.' }, { status: 404 });
    return NextResponse.json(dia, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível consultar a Liturgia Diária agora.' }, { status: 502 });
  }
}
