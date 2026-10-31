import { NextResponse } from 'next/server';
import { idDoVideo } from '@/lib/youtube';

// Lê o título, o canal e a descrição de um vídeo pela API oficial do YouTube (YouTube Data API v3).
// A chave fica só nas variáveis de ambiente da Vercel (YOUTUBE_API_KEY), nunca no navegador.
// Uso: /api/youtube?v=<link ou código do vídeo>
export async function GET(req) {
  const id = idDoVideo(new URL(req.url).searchParams.get('v'));
  if (!id) return NextResponse.json({ erro: 'Não entendi este link do YouTube.' }, { status: 400 });
  const chave = process.env.YOUTUBE_API_KEY;
  if (!chave) return NextResponse.json({ erro: 'Falta configurar a chave do YouTube na Vercel (YOUTUBE_API_KEY).' }, { status: 503 });
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${encodeURIComponent(chave)}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const motivo = j?.error?.errors?.[0]?.reason || '';
      const erro = motivo === 'quotaExceeded' ? 'A cota diária do YouTube acabou. Tente amanhã.'
        : /keyInvalid|API_KEY_INVALID|forbidden|accessNotConfigured/i.test(motivo + ' ' + (j?.error?.message || '')) ? 'A chave do YouTube não foi aceita. Confira se ela foi copiada inteira e se a "YouTube Data API v3" está ativada no projeto.'
        : 'O YouTube não respondeu agora. Tente de novo em instantes.';
      return NextResponse.json({ erro, detalhe: motivo || `HTTP ${r.status}` }, { status: 502 });
    }
    const s = j.items?.[0]?.snippet;
    if (!s) return NextResponse.json({ erro: 'Vídeo não encontrado (pode ser privado ou ter sido removido).' }, { status: 404 });
    return NextResponse.json({ id, link: `https://www.youtube.com/watch?v=${id}`, titulo: s.title || '', canal: s.channelTitle || '', descricao: s.description || '' },
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível consultar o YouTube agora.' }, { status: 502 });
  }
}
