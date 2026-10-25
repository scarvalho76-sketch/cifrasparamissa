'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import TextoOracao from '@/components/TextoOracao';

// Textos das Orações Eucarísticas e do Santo rezado, colados pelo administrador
export default function Oracoes() {
  const [lista, setLista] = useState([]);
  const [aberta, setAberta] = useState(null);
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState('');
  const [ver, setVer] = useState(false);

  const carregar = async () => { const { data } = await supabase.from('missa_oracoes').select('*').order('ordem'); setLista(data || []); };
  useEffect(() => { carregar(); }, []);
  const santo = lista.find(o => o.sigla === 'SANTO')?.texto || '';

  function abrir(o) { setAberta(aberta === o.id ? null : o.id); setTexto(o.texto); setMsg(''); setVer(false); }
  async function salvar(o) {
    const { error } = await supabase.from('missa_oracoes').update({ texto: texto.replace(/\s+$/, ''), atualizado_em: new Date().toISOString() }).eq('id', o.id);
    if (error) return setMsg('Não foi possível salvar: ' + error.message);
    setMsg('✓ Salvo'); carregar();
  }

  return (
    <>
      <h2>Orações Eucarísticas</h2>
      <div className="card mut" style={{ fontSize: '.92rem' }}>
        Cole o texto de cada oração (do Missal Romano) e use esta marcação:
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li><code>T:</code> no começo da linha → resposta do povo, em <strong>negrito</strong></li>
          <li><code>P:</code> no começo da linha → fala do presidente (sem marcação também vale como presidente)</li>
          <li><code># Título</code> → título de uma parte (ex.: <code># Diálogo do Prefácio</code>)</li>
          <li><code>[SANTO]</code> sozinho numa linha → lugar do Santo (mostra o Santo rezado e o botão para o Santo cantado)</li>
          <li>Linha em branco separa os parágrafos</li>
        </ul>
        Primeiro cadastre o <strong>Santo (rezado)</strong>, que vale para todas as orações.
      </div>
      {lista.map(o => (
        <div key={o.id} className="card">
          <div className="row">
            <span><strong>{o.nome}</strong> <span className={o.texto ? 'okmsg' : 'falta'} style={{ fontSize: '.85rem' }}>{o.texto ? '✓ cadastrado' : 'sem texto'}</span></span>
            <button className="sec mini" onClick={() => abrir(o)}>{aberta === o.id ? 'Fechar' : o.texto ? 'Editar' : 'Cadastrar'}</button>
          </div>
          {aberta === o.id && (
            <div style={{ marginTop: 10 }}>
              <textarea rows={16} value={texto} onChange={e => setTexto(e.target.value)} spellCheck={false}
                placeholder={o.sigla === 'SANTO' ? 'T: …texto do Santo…' : '# Diálogo do Prefácio\nP: …\nT: …\n…\n[SANTO]\n# Depois do Santo\nP: …\nT: Amém.'}
                style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '.9rem' }} />
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                <button onClick={() => salvar(o)}>Salvar</button>
                <button className="sec" onClick={() => setVer(!ver)}>{ver ? 'Esconder prévia' : 'Ver como fica'}</button>
                {msg && <span className={msg.startsWith('✓') ? 'okmsg' : 'err'}>{msg}</span>}
              </div>
              {ver && <div className="cer" style={{ marginTop: 10 }}><TextoOracao texto={texto} santo={o.sigla === 'SANTO' ? '' : santo} onSantoCantado={o.sigla === 'SANTO' ? null : () => {}} /></div>}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
