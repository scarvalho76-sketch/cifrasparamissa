import { NextResponse } from 'next/server';
import { idDoVideo } from '@/lib/youtube';

// Lê o título, o canal e a descrição de um vídeo do YouTube (sem chave de API).
// Uso: /api/youtube?v=<link ou código do vídeo>
// Tenta primeiro a interface interna do YouTube (resposta em JSON) e, se não der, a página do vídeo.
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CLIENTES = [
  { clientName: 'WEB', clientVersion: '2.20241010.00.00' },
  { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30 },
  { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' }
];

async function porInterface(id) {
  for (const client of CLIENTES) {
    try {
      const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', signal: AbortSignal.timeout(7000),
        headers: { 'Content-Type': 'application/json', 'User-Agent': NAVEGADOR, 'Accept-Language': 'pt-BR,pt;q=0.9', Origin: 'https://www.youtube.com' },
        body: JSON.stringify({ videoId: id, context: { client: { ...client, hl: 'pt', gl: 'BR' } } })
      });
      if (!r.ok) continue;
      const v = (await r.json())?.videoDetails;
      if (v?.shortDescription !== undefined && v.videoId === id) return { titulo: v.title || '', canal: v.author || '', descricao: v.shortDescription || '' };
    } catch {}
  }
  return null;
}

// texto de uma string JSON encontrada no meio do HTML
const lerStr = (html, chave) => {
  const m = html.match(new RegExp(`"${chave}":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return null;
  try { return JSON.parse('"' + m[1] + '"'); } catch { return null; }
};
async function porPagina(id) {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=pt-BR&gl=BR`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': NAVEGADOR, 'Accept-Language': 'pt-BR,pt;q=0.9', Cookie: 'CONSENT=YES+cb; SOCS=CAI' }
    });
    if (!r.ok) return null;
    const html = await r.text();
    const ini = html.indexOf('"videoDetails"');
    const trecho = ini >= 0 ? html.slice(ini, ini + 200000) : html;
    const descricao = lerStr(trecho, 'shortDescription');
    if (descricao === null) return null;
    return { titulo: lerStr(trecho, 'title') || '', canal: lerStr(trecho, 'author') || '', descricao };
  } catch { return null; }
}

export async function GET(req) {
  const id = idDoVideo(new URL(req.url).searchParams.get('v'));
  if (!id) return NextResponse.json({ erro: 'Não entendi este link do YouTube.' }, { status: 400 });
  const r = (await porInterface(id)) || (await porPagina(id));
  if (!r) return NextResponse.json({ erro: 'O YouTube não deixou ler este vídeo agora. Tente de novo mais tarde ou copie a cifra da descrição.' }, { status: 502 });
  return NextResponse.json({ id, link: `https://www.youtube.com/watch?v=${id}`, ...r }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}
