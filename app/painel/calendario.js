'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fmtHora, fmtData } from '@/lib/util';
import { lerPref, gravarPref } from '@/lib/util';

// Calendário das missas cadastradas (como o do sistema do palco):
// grade do mês no computador, lista de dias no celular. Toque na missa para abrir; "+" cria uma missa no dia.
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const p2 = n => String(n).padStart(2, '0');
const chaveDia = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
// cor do cartão pelo tempo litúrgico
const COR = { 'Tempo Comum': 'verde', Advento: 'roxo', Quaresma: 'roxo', 'Semana Santa': 'vermelho', Natal: 'branco', 'Páscoa': 'branco', 'Solenidade / Festa': 'branco' };

export default function Calendario({ onAbrir, onNova, onAbrirEvento, onNovoEvento }) {
  const agora = new Date();
  const [mes, setMes] = useState(() => { const s = lerPref('calendario:mes', null); return s || `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}`; });
  const [missas, setMissas] = useState([]);
  const [resumo, setResumo] = useState({});
  const [eventos, setEventos] = useState([]);
  const [escolha, setEscolha] = useState(null); // dia em que o "+" foi tocado (missa ou evento?)
  const [carregando, setCarregando] = useState(true);
  const [ano, m] = mes.split('-').map(Number);

  useEffect(() => {
    gravarPref('calendario:mes', mes);
    (async () => {
      setCarregando(true);
      const ini = new Date(ano, m - 1, 1), fim = new Date(ano, m, 1);
      const { data } = await supabase.from('missa_celebracoes').select('id, data_hora, titulo, local, tempo')
        .gte('data_hora', ini.toISOString()).lt('data_hora', fim.toISOString()).order('data_hora');
      setMissas(data || []);
      const { data: evs } = await supabase.from('missa_eventos').select('id, data_hora, tipo, nome, local')
        .gte('data_hora', ini.toISOString()).lt('data_hora', fim.toISOString()).order('data_hora');
      setEventos(evs || []);
      const ids = (data || []).map(x => x.id);
      if (ids.length) {
        const { data: its } = await supabase.from('missa_itens').select('celebracao_id, musica_id').in('celebracao_id', ids);
        const r = {}; (its || []).forEach(i => { const x = (r[i.celebracao_id] ||= { total: 0, faltam: 0 }); x.total++; if (!i.musica_id) x.faltam++; });
        setResumo(r);
      } else setResumo({});
      setCarregando(false);
    })();
  }, [mes]);

  const mudar = d => { const x = new Date(ano, m - 1 + d, 1); setMes(`${x.getFullYear()}-${p2(x.getMonth() + 1)}`); };
  const hojeMes = () => setMes(`${agora.getFullYear()}-${p2(agora.getMonth() + 1)}`);
  const dias = useMemo(() => { const n = new Date(ano, m, 0).getDate(); return Array.from({ length: n }, (_, k) => new Date(ano, m - 1, k + 1)); }, [ano, m]);
  const porDia = useMemo(() => {
    const r = {};
    missas.forEach(x => { const k = chaveDia(new Date(x.data_hora)); (r[k] ||= []).push(x); });
    eventos.forEach(x => { const k = chaveDia(new Date(x.data_hora)); (r[k] ||= []).push({ ...x, evento: true }); });
    Object.values(r).forEach(l => l.sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora)));
    return r;
  }, [missas, eventos]);
  const hoje = chaveDia(agora);
  const vazios = dias[0].getDay();
  const txtData = d => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const nova = d => onNova(txtData(d));
  const novoEvento = d => onNovoEvento(txtData(d));

  const Cartao = ({ x }) => {
    if (x.evento) return (
      <button type="button" className="cal-missa cal-evento" onClick={() => onAbrirEvento(x.id)} title="Abrir o evento">
        <span className="cal-hora">♪ {fmtHora(x.data_hora)}</span> <span className="cal-tit">{x.nome || x.tipo || 'Evento'}</span>
        <span className="cal-local">{[x.nome ? x.tipo : '', x.local].filter(Boolean).join(' · ')}</span>
      </button>
    );
    const r = resumo[x.id] || { total: 0, faltam: 0 };
    return (
      <button type="button" className={'cal-missa cal-' + (COR[x.tempo] || 'verde')} onClick={() => onAbrir(x.id)} title="Abrir a missa">
        <span className="cal-hora">{fmtHora(x.data_hora)}</span> <span className="cal-tit">{x.titulo || 'Missa'}</span>
        {x.local && <span className="cal-local">{x.local}</span>}
        {r.total > 0 && <span className={'cal-status' + (r.faltam ? ' falta' : '')}>{r.faltam ? `${r.faltam} sem música` : '✓ completa'}</span>}
      </button>
    );
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.7rem' }}>{MESES[m - 1]} {ano}</h2>
        <span className="row" style={{ gap: 6 }}>
          <button className="sec mini" onClick={() => mudar(-1)} aria-label="Mês anterior">‹</button>
          <button className="sec mini" onClick={hojeMes}>Hoje</button>
          <button className="sec mini" onClick={() => mudar(1)} aria-label="Próximo mês">›</button>
        </span>
      </div>
      <ul className="cal-legenda">
        <li><span className="cal-ponto cal-verde" />Tempo Comum</li>
        <li><span className="cal-ponto cal-roxo" />Advento / Quaresma</li>
        <li><span className="cal-ponto cal-branco" />Natal / Páscoa / Solenidade</li>
        <li><span className="cal-ponto cal-vermelho" />Semana Santa</li>
        <li><span className="cal-ponto cal-evento" />♪ Evento</li>
      </ul>
      {carregando && <p className="mut">Carregando…</p>}

      {/* grade: telas largas */}
      <div className="cal-grade">
        {DIAS.map(d => <div key={d} className="cal-cab">{d}</div>)}
        {Array.from({ length: vazios }, (_, k) => <div key={'v' + k} className="cal-vazio" />)}
        {dias.map(d => {
          const k = chaveDia(d);
          return (
            <div key={k} className={'cal-dia' + (d.getDay() === 0 ? ' cal-domingo' : '')}>
              <div className="cal-num-linha">
                <span className={'cal-num' + (k === hoje ? ' cal-hoje' : '')}>{d.getDate()}</span>
                <button type="button" className="cal-mais" onClick={() => setEscolha(escolha === k ? null : k)} aria-label={`Criar no dia ${d.getDate()}`}>+</button>
              </div>
              {escolha === k && (
                <div className="cal-escolha">
                  <button type="button" className="mini" onClick={() => nova(d)}>Missa</button>
                  <button type="button" className="mini sec" onClick={() => novoEvento(d)}>Evento</button>
                </div>
              )}
              {(porDia[k] || []).map(x => <Cartao key={x.id} x={x} />)}
            </div>
          );
        })}
        {Array.from({ length: (7 - ((vazios + dias.length) % 7)) % 7 }, (_, k) => <div key={'f' + k} className="cal-vazio" />)}
      </div>

      {/* lista: celular */}
      <ol className="cal-lista">
        {dias.map(d => {
          const k = chaveDia(d); const ms = porDia[k] || [];
          return (
            <li key={k} className={(ms.length || d.getDay() === 0 ? 'cal-li-cheio' : '') + (k === hoje ? ' cal-li-hoje' : '')}>
              <div className="cal-li-data"><strong>{p2(d.getDate())}</strong><span>{DIAS[d.getDay()]}</span></div>
              <div className="cal-li-conteudo">
                {ms.map(x => <Cartao key={x.id} x={x} />)}
                <button type="button" className="cal-li-mais" onClick={() => nova(d)}>+ missa</button>
                <button type="button" className="cal-li-mais" style={{ marginLeft: 14 }} onClick={() => novoEvento(d)}>+ evento</button>
              </div>
            </li>
          );
        })}
      </ol>
      {!carregando && missas.length === 0 && eventos.length === 0 && <p className="mut" style={{ marginTop: 10 }}>Nada cadastrado em {MESES[m - 1].toLowerCase()}.</p>}
    </>
  );
}
