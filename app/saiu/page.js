// Mostrada depois que o músico toca em "Sair"
export default function Saiu() {
  return (
    <div className="wrap">
      <div className="card" style={{ marginTop: 24 }}>
        <h2>Você saiu</h2>
        <p className="mut">Este aparelho não guarda mais o seu acesso nem as missas baixadas. Para entrar de novo, abra o seu link pessoal enviado pelo administrador.</p>
      </div>
    </div>
  );
}
