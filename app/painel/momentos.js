'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Lista de momentos da missa: ordem, nome e se entram automaticamente em cada missa nova.
// Mudar aqui não altera missas já montadas.
export default function Momentos() {
  const [lista, setLista] = useState([]);
  const [novo, setNovo] = useState('');
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    const { data } = await supabase.from('missa_momentos').select('*').order('ordem').order('id');
    setLista(data || []);
  };
  useEffect(() => { carregar(); }, []);

  async function salvar(m, campos) {
    setMsg('');
    const { error } = await supabase.from('missa_momentos').update(campos).eq('id', m.id);
    if (error) setMsg('Não foi possível salvar: ' + error.message);
    carregar();
  }
  async function mover(n, d) {
    const a = lista[n], b = lista[n + d];
    if (!a || !b) return;
    // renumera tudo para evitar empates
    const nova = [...lista]; nova[n] = b; nova[n + d] = a;
    await Promise.all(nova.map((m, i) => supabase.from('missa_momentos').update({ ordem: (i + 1) * 10 }).eq('id', m.id)));
    carregar();
  }
  async function adicionar() {
    if (!novo.trim()) return;
    const ordem = ((lista[lista.length - 1]?.ordem) || 0) + 10;
    const { error } = await supabase.from('missa_momentos').insert({ nome: novo.trim(), ordem, padrao: false });
    if (error) return setMsg('Não foi possível adicionar: ' + error.message);
    setNovo(''); carregar();
  }

  return (
    <>
      <h2>Momentos da missa</h2>
      <p className="mut">Os momentos marcados como <strong>automáticos</strong> entram em cada missa nova, nesta ordem. Os outros ficam disponíveis para acrescentar quando precisar (por exemplo, sem Glória no Advento e na Quaresma, basta tirá-lo daquela missa).</p>
      <div className="card">
        {lista.map((m, n) => (
          <div key={m.id} className="item" style={{ opacity: m.ativo ? 1 : .5 }}>
            <div className="item-cab">
              <input defaultValue={m.nome} onBlur={e => e.target.value.trim() && e.target.value !== m.nome && salvar(m, { nome: e.target.value.trim() })} style={{ margin: 0, flex: 1 }} />
              <button className="sec mini" onClick={() => mover(n, -1)} disabled={n === 0} aria-label="Subir">▲</button>
              <button className="sec mini" onClick={() => mover(n, 1)} disabled={n === lista.length - 1} aria-label="Descer">▼</button>
            </div>
            <div className="chips">
              <button className={'chip' + (m.padrao ? ' on' : '')} onClick={() => salvar(m, { padrao: !m.padrao })}>{m.padrao ? '✓ Automático' : 'Só quando eu acrescentar'}</button>
              <button className={'chip' + (m.ativo ? '' : ' on')} onClick={() => salvar(m, { ativo: !m.ativo })}>{m.ativo ? 'Ocultar' : 'Oculto: mostrar de novo'}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <input placeholder="Novo momento (ex.: Aspersão)" value={novo} onChange={e => setNovo(e.target.value)} style={{ flex: 1, margin: 0 }} />
        <button onClick={adicionar}>Adicionar</button>
      </div>
      {msg && <p className="err">{msg}</p>}
    </>
  );
}
