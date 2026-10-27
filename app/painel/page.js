'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { lerPref, gravarPref } from '@/lib/util';
import Missas from './missas';
import Biblioteca from './biblioteca';
import Configuracoes from './configuracoes';
import Calendario from './calendario';
import Eventos from './eventos';
import { lerConta, apagarConta } from '@/lib/conta';

// Músicos, Momentos, Orações e Amigos ficam dentro de Configurações (só o administrador vê)
const ABAS_ADMIN = [['missas', 'Missas'], ['eventos', 'Eventos'], ['calendario', 'Calendário'], ['biblioteca', 'Biblioteca'], ['config', 'Configurações']];
// Por enquanto, amigos não cadastram músicos (aba só do administrador)
const ABAS_CONTA = [['missas', 'Missas'], ['eventos', 'Eventos'], ['calendario', 'Calendário'], ['biblioteca', 'Biblioteca']];

export default function Painel() {
  const r = useRouter();
  const [ok, setOk] = useState(false);
  const [aba, setAba] = useState('missas');
  const [semSessao, setSemSessao] = useState(false);
  const [quem, setQuem] = useState(null);
  const [alvo, setAlvo] = useState(null); // do Calendário para Missas: { missa: id } ou { nova: 'dd/mm/aaaa' } // { tipo: 'admin' } ou { tipo: 'conta', nome }

  // Se a sessão cair (por exemplo, "Sair" em outro aparelho), avisa sem perder o que está na tela.
  // Ao entrar de novo em outra aba, esta aba recebe a sessão nova sozinha.
  useEffect(() => {
    if (lerConta()) return; // amigos não usam o login do administrador
    const { data } = supabase.auth.onAuthStateChange((_ev, sessao) => setSemSessao(!sessao));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase.rpc('missa_quem_sou');
      if (!q) {
        if (lerConta()) { apagarConta(); return r.replace('/saiu'); } // link trocado ou desativado
        return r.replace('/');
      }
      setQuem(q);
      const abas = q.tipo === 'admin' ? ABAS_ADMIN : ABAS_CONTA;
      let salva = lerPref('painel:aba', 'missas');
      if (['musicos', 'momentos', 'oracoes', 'amigos'].includes(salva)) { gravarPref('painel:config', salva); salva = 'config'; gravarPref('painel:aba', 'config'); }
      setAba(abas.some(([k]) => k === salva) ? salva : 'missas'); setOk(true);
    })();
  }, [r]);

  const trocar = a => { setAba(a); gravarPref('painel:aba', a); };
  // Sai só deste aparelho (não derruba o Sonata nem outros aparelhos)
  async function sair() {
    if (quem?.tipo === 'conta') {
      if (!confirm('Sair deste aparelho? Para entrar de novo, abra o seu link pessoal.')) return;
      apagarConta(); return location.replace('/saiu');
    }
    await supabase.auth.signOut({ scope: 'local' }); r.replace('/');
  }

  if (!ok) return <div className="wrap mut">Carregando…</div>;
  return (
    <div className="wrap">
      {semSessao && (
        <div className="card late" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
          <strong>Sua sessão terminou.</strong>
          <p style={{ margin: '4px 0 8px' }}>Para salvar, entre de novo numa outra aba e depois volte aqui: o que você digitou continua nesta tela.</p>
          <a className="botao" href="/?entrar=1" target="_blank" rel="noreferrer">Entrar em outra aba</a>
        </div>
      )}
      {quem?.tipo === 'conta' && <p className="mut" style={{ margin: '0 0 -6px' }}>Olá, {quem.nome.split(' ')[0]}!</p>}
      <div className="tabs">
        {(quem?.tipo === 'admin' ? ABAS_ADMIN : ABAS_CONTA).map(([k, t]) => <button key={k} className={aba === k ? 'on' : ''} onClick={() => trocar(k)}>{t}</button>)}
        <button style={{ marginLeft: 'auto' }} onClick={sair}>Sair</button>
      </div>
      {aba === 'missas' && <Missas alvo={alvo} />}
      {aba === 'eventos' && <Eventos alvo={alvo} />}
      {aba === 'calendario' && <Calendario
        onAbrir={id => { setAlvo({ missa: id, t: Date.now() }); trocar('missas'); }}
        onNova={data => { setAlvo({ nova: data, t: Date.now() }); trocar('missas'); }}
        onAbrirEvento={id => { setAlvo({ evento: id, t: Date.now() }); trocar('eventos'); }}
        onNovoEvento={data => { setAlvo({ novoEvento: data, t: Date.now() }); trocar('eventos'); }} />}
      {aba === 'biblioteca' && <Biblioteca />}
      {aba === 'config' && quem?.tipo === 'admin' && <Configuracoes />}
    </div>
  );
}
