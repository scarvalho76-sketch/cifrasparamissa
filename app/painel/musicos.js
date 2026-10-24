'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizarTelefone, linkWhatsApp } from '@/lib/whatsapp';

export const linkPessoal = token => (typeof location !== 'undefined' ? location.origin : '') + '/m/' + token;

// Músicos que podem tocar nas missas. Cada um entra por um link pessoal, sem e-mail e senha.
export default function Musicos() {
  const [lista, setLista] = useState([]);
  const [f, setF] = useState(null); // músico em edição (ou novo)
  const [msg, setMsg] = useState('');
  const [copiado, setCopiado] = useState('');

  const carregar = async () => {
    const { data } = await supabase.from('missa_musicos').select('*').order('ativo', { ascending: false }).order('nome');
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setMsg('');
    if (!f.nome.trim()) return setMsg('Informe o nome.');
    const dados = { nome: f.nome.trim(), telefone: f.telefone ? normalizarTelefone(f.telefone) : '', instrumento: f.instrumento.trim() };
    const { error } = f.id ? await supabase.from('missa_musicos').update(dados).eq('id', f.id) : await supabase.from('missa_musicos').insert(dados);
    if (error) return setMsg('Não foi possível salvar: ' + error.message);
    setF(null); carregar();
  }
  async function novoLink(m) {
    if (!confirm(`Gerar um novo link para ${m.nome}? O link antigo deixa de funcionar.`)) return;
    await supabase.from('missa_musicos').update({ token: crypto.randomUUID() }).eq('id', m.id);
    carregar();
  }
  async function ativar(m) { await supabase.from('missa_musicos').update({ ativo: !m.ativo }).eq('id', m.id); carregar(); }
  async function copiar(m) {
    try { await navigator.clipboard.writeText(linkPessoal(m.token)); setCopiado(m.id); setTimeout(() => setCopiado(''), 2000); }
    catch { prompt('Copie o link:', linkPessoal(m.token)); }
  }
  const textoLink = m => `Olá, ${m.nome.split(' ')[0]}! Este é o seu link pessoal para ver as missas, letras e cifras:\n${linkPessoal(m.token)}\n\nGuarde este link: ele é só seu.`;

  const Form = () => (
    <div className="card">
      <h2>{f.id ? 'Editar músico' : 'Novo músico'}</h2>
      <label>Nome</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} />
      <div className="grade2">
        <div><label>WhatsApp (com DDD)</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} inputMode="tel" /></div>
        <div><label>Instrumento (ex.: Voz, Violão, Voz e teclado)</label><input value={f.instrumento} onChange={e => setF({ ...f, instrumento: e.target.value })} /></div>
      </div>
      <p className="mut" style={{ marginTop: -6 }}>Quem tem “voz” e nenhum instrumento vê a letra; quem toca vê a cifra. No Modo celebração cada um pode trocar.</p>
      {msg && <p className="err">{msg}</p>}
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button onClick={salvar}>Salvar</button>
        <button className="sec" onClick={() => { setF(null); setMsg(''); }}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Músicos</h2>
        {!f && <button className="sec" onClick={() => setF({ nome: '', telefone: '', instrumento: '' })}>+ Novo músico</button>}
      </div>
      {f && !f.id && Form()}
      {lista.length === 0 && !f && <div className="card mut">Nenhum músico cadastrado. Você não precisa se cadastrar aqui: você já entra no painel com o seu próprio acesso.</div>}
      {lista.map(m => f?.id === m.id ? <div key={m.id}>{Form()}</div> : (
        <div key={m.id} className={'card' + (m.ativo ? '' : ' off')}>
          <div className="row">
            <span><strong>{m.nome}</strong>{m.instrumento ? <span className="mut"> · {m.instrumento}</span> : null}{!m.ativo && <span className="mut"> · desativado</span>}</span>
            <button className="sec mini" onClick={() => setF({ ...m, telefone: m.telefone || '' })}>Editar</button>
          </div>
          <div className="chips">
            <button className="chip" onClick={() => copiar(m)}>{copiado === m.id ? '✓ Link copiado' : '🔗 Copiar link pessoal'}</button>
            {m.telefone && <a className="chip" href={linkWhatsApp(m.telefone, textoLink(m))} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Enviar link pelo WhatsApp</a>}
            <button className="chip" onClick={() => novoLink(m)}>Gerar novo link</button>
            <button className="chip" onClick={() => ativar(m)}>{m.ativo ? 'Desativar' : 'Reativar'}</button>
          </div>
        </div>
      ))}
    </>
  );
}
