'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizarTelefone, linkWhatsApp } from '@/lib/whatsapp';

const linkAmigo = token => (typeof location !== 'undefined' ? location.origin : '') + '/e/' + token;

// Amigos que usam o Cantus com as próprias missas e músicos (a Biblioteca é compartilhada).
// Cada um entra por um link pessoal, sem e-mail e senha. Só o administrador cadastra.
export default function Amigos() {
  const [lista, setLista] = useState([]);
  const [resumo, setResumo] = useState({});
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [copiado, setCopiado] = useState('');

  const carregar = async () => {
    const [{ data }, { data: r }] = await Promise.all([
      supabase.from('missa_contas').select('*').order('ativo', { ascending: false }).order('nome'),
      supabase.rpc('missa_resumo_contas')
    ]);
    setLista(data || []); setResumo(Object.fromEntries((r || []).map(x => [x.conta_id, x])));
  };
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setMsg('');
    if (!f.nome.trim()) return setMsg('Informe o nome.');
    const dados = { nome: f.nome.trim(), telefone: f.telefone ? normalizarTelefone(f.telefone) : '' };
    const { error } = f.id ? await supabase.from('missa_contas').update(dados).eq('id', f.id) : await supabase.from('missa_contas').insert(dados);
    if (error) return setMsg('Não foi possível salvar: ' + error.message);
    setF(null); carregar();
  }
  async function novoLink(a) {
    if (!confirm(`Gerar um novo link para ${a.nome}? O link antigo para de funcionar na hora, inclusive nos aparelhos onde ele já entrou.`)) return;
    await supabase.from('missa_contas').update({ token: crypto.randomUUID() }).eq('id', a.id); carregar();
  }
  async function ativar(a) {
    if (a.ativo && !confirm(`Desativar ${a.nome}? Ele perde o acesso na hora (as missas dele ficam guardadas).`)) return;
    await supabase.from('missa_contas').update({ ativo: !a.ativo }).eq('id', a.id); carregar();
  }
  async function copiar(a) {
    try { await navigator.clipboard.writeText(linkAmigo(a.token)); setCopiado(a.id); setTimeout(() => setCopiado(''), 2000); }
    catch { prompt('Copie o link:', linkAmigo(a.token)); }
  }
  const texto = a => `Olá, ${a.nome.split(' ')[0]}! Este é o seu acesso ao Cantus, para montar as músicas das suas missas, com letras e cifras:\n${linkAmigo(a.token)}\n\nGuarde este link: ele é só seu e funciona como uma senha.`;

  const Form = () => (
    <div className="card">
      <h2>{f.id ? 'Editar amigo' : 'Novo amigo'}</h2>
      <label>Nome</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} />
      <label>WhatsApp (com DDD)</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} inputMode="tel" />
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
        <h2 style={{ margin: 0 }}>Amigos</h2>
        {!f && <button className="sec" onClick={() => setF({ nome: '', telefone: '' })}>+ Novo amigo</button>}
      </div>
      <p className="mut">Cada amigo entra pelo próprio link e tem as próprias missas e músicos. A Biblioteca de músicas e a lista de momentos são as mesmas para todos (amigos podem cadastrar e editar músicas, mas não excluir). Você não vê as missas deles, e eles não veem as suas.</p>
      {f && !f.id && Form()}
      {lista.length === 0 && !f && <div className="card mut">Nenhum amigo cadastrado.</div>}
      {lista.map(a => f?.id === a.id ? <div key={a.id}>{Form()}</div> : (
        <div key={a.id} className={'card' + (a.ativo ? '' : ' off')}>
          <div className="row">
            <span><strong>{a.nome}</strong>{!a.ativo && <span className="mut"> · desativado</span>}
              <div className="mut" style={{ fontSize: '.85rem' }}>{resumo[a.id] ? `${resumo[a.id].missas} ${resumo[a.id].missas === 1 ? 'missa' : 'missas'} · ${resumo[a.id].musicos} ${resumo[a.id].musicos === 1 ? 'músico' : 'músicos'}` : 'Ainda sem missas'}</div>
            </span>
            <button className="sec mini" onClick={() => setF({ ...a, telefone: a.telefone || '' })}>Editar</button>
          </div>
          <div className="chips">
            <button className="chip" onClick={() => copiar(a)}>{copiado === a.id ? '✓ Link copiado' : '🔗 Copiar link de acesso'}</button>
            {a.telefone && <a className="chip" href={linkWhatsApp(a.telefone, texto(a))} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Enviar link pelo WhatsApp</a>}
            <button className="chip" onClick={() => novoLink(a)}>Gerar novo link</button>
            <button className="chip" onClick={() => ativar(a)}>{a.ativo ? 'Desativar' : 'Reativar'}</button>
          </div>
        </div>
      ))}
    </>
  );
}
