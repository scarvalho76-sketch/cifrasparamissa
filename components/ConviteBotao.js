'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dataLonga, fmtData, dataIso } from '@/lib/util';

// Link para convidados (instrumentistas ou cantores presentes): abre o Modo celebração desta missa,
// só para ver; já pode ser usado e vale até o dia da celebração.
export default function ConviteBotao({ missaId, dataHora, titulo }) {
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const [aberto, setAberto] = useState(false);

  async function gerar(novo = false) {
    setMsg('');
    if (novo && !confirm('Gerar outro link? O link anterior deixa de funcionar.')) return;
    const { data, error } = await supabase.rpc('missa_gerar_convite', { p_id: missaId, p_novo: novo });
    if (error) return setMsg('Não foi possível gerar o link: ' + error.message);
    setLink(`${location.origin}/missa/${missaId}?c=${data.convite}`); setAberto(true);
    if (novo) setMsg('Novo link gerado. O anterior não funciona mais.');
  }
  const texto = () => `Músicas da missa${titulo ? ' (' + titulo + ')' : ''} de ${dataLonga(dataHora)}.\nAcompanhe letras e cifras por este link (vale até o dia da celebração):\n${link}`;
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setMsg('✓ Link copiado'); } catch { prompt('Copie o link:', link); }
  }
  async function compartilhar() {
    if (navigator.share) { try { await navigator.share({ title: 'Cantus', text: texto() }); return; } catch { return; } }
    window.open('https://wa.me/?text=' + encodeURIComponent(texto()), '_blank');
  }
  const ehHoje = dataIso(dataHora) === dataIso(new Date());

  if (!aberto) return <button type="button" className="sec mini" onClick={() => gerar(false)}>🔗 Link para convidados</button>;
  return (
    <div className="card" style={{ margin: '10px 0 0', borderLeft: '4px solid var(--ouro)' }}>
      <strong>Link para convidados</strong>
      <p className="mut" style={{ margin: '4px 0 8px', fontSize: '.9rem' }}>
        Quem abrir vê esta missa no Modo celebração (letra ou cifra), sem cadastro e sem poder alterar nada.
        {' '}Já pode ser usado e vale até o dia <strong>{fmtData(dataHora)}</strong>{ehHoje ? ' (hoje)' : ''}.
      </p>
      <input readOnly value={link} onFocus={e => e.target.select()} style={{ fontSize: '.85rem', marginBottom: 8 }} />
      <div className="row" style={{ justifyContent: 'flex-start', gap: 6 }}>
        <button type="button" className="mini" onClick={compartilhar}>Enviar</button>
        <button type="button" className="sec mini" onClick={copiar}>Copiar</button>
        <button type="button" className="sec mini" onClick={() => gerar(true)}>Gerar outro link</button>
        <button type="button" className="sec mini" onClick={() => setAberto(false)}>Fechar</button>
      </div>
      {msg && <p className={msg.startsWith('✓') || msg.startsWith('Novo') ? 'okmsg' : 'err'} style={{ margin: '6px 0 0', fontSize: '.9rem' }}>{msg}</p>}
    </div>
  );
}
