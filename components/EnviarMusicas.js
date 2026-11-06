'use client';
import { useState } from 'react';
import { dataLonga } from '@/lib/util';
import { linkWhatsApp, normalizarTelefone } from '@/lib/whatsapp';

// Só estes momentos entram na mensagem, na ordem da missa
const MOMENTOS_DA_MENSAGEM = ['entrada', 'ato penitencial', 'glória', 'ofertório', 'santo', 'cordeiro', 'comunhão', 'ação de graças', 'saída'];

// Monta o texto: data, título e a lista "Momento - música - autor"
export function mensagemDasMusicas(celebracao, itens, musicas) {
  const porId = Object.fromEntries((musicas || []).map(m => [m.id, m]));
  const linhas = (itens || [])
    .filter(i => MOMENTOS_DA_MENSAGEM.includes((i.momento || '').trim().toLowerCase()))
    .map(i => {
      const m = porId[i.musica_id];
      const quem = m ? [m.nome, m.artista].filter(Boolean).join(' - ') : 'a definir';
      return `${i.momento} - ${quem}`;
    });
  const cab = [`Data: ${dataLonga(celebracao.data_hora)}`];
  if (celebracao.titulo) cab.push(`Título: ${celebracao.titulo}`);
  return [...cab, '', ...linhas].join('\n');
}

// Botão ao lado do link para convidados: monta a mensagem e deixa escolher o destinatário no WhatsApp
export default function EnviarMusicas({ celebracao, itens, musicas, musicos = [] }) {
  const [aberto, setAberto] = useState(false);
  const [outro, setOutro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const texto = mensagemDasMusicas(celebracao, itens, musicas);
  const comZap = musicos.filter(m => m.telefone);

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { prompt('Copie a mensagem:', texto); }
  }

  if (!aberto) return <button type="button" className="sec mini" onClick={() => setAberto(true)}>💬 Enviar músicas</button>;
  return (
    <div className="card" style={{ margin: '10px 0 0', borderLeft: '4px solid var(--verde, #2f7d4f)', flexBasis: '100%' }}>
      <strong>Enviar músicas pelo WhatsApp</strong>
      <p className="mut" style={{ margin: '4px 0 8px', fontSize: '.9rem' }}>Escolha quem recebe. A mensagem já vem pronta, e você pode revisar antes de enviar.</p>
      <pre style={{ whiteSpace: 'pre-wrap', margin: '0 0 10px', padding: 10, background: 'var(--fundo-suave, #f6f3ea)', borderRadius: 6, fontSize: '.9rem', fontFamily: 'inherit' }}>{texto}</pre>

      <div className="chips" style={{ marginBottom: 8 }}>
        {comZap.map(m => (
          <a key={m.id} className="chip" style={{ textDecoration: 'none' }} href={linkWhatsApp(normalizarTelefone(m.telefone), texto)} target="_blank" rel="noreferrer">Para {m.nome.split(' ')[0]}</a>
        ))}
        <a className="chip" style={{ textDecoration: 'none' }} href={'https://wa.me/?text=' + encodeURIComponent(texto)} target="_blank" rel="noreferrer">Escolher contato…</a>
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
        <input value={outro} onChange={e => setOutro(e.target.value)} placeholder="Outro número (com DDD)" style={{ margin: 0, width: 200 }} />
        {outro.replace(/\D/g, '').length >= 10 && <a className="mini" style={{ textDecoration: 'none' }} href={linkWhatsApp(normalizarTelefone(outro), texto)} target="_blank" rel="noreferrer">Enviar</a>}
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 6, marginTop: 10 }}>
        <button type="button" className="sec mini" onClick={copiar}>{copiado ? '✓ Copiada' : 'Copiar mensagem'}</button>
        <button type="button" className="sec mini" onClick={() => setAberto(false)}>Fechar</button>
      </div>
    </div>
  );
}
