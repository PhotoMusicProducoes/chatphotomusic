// services/paroquiaWeb.js
// Tela WEB da secretaria (bancada de teste). Servida pelo próprio Express do
// bot, sob /psj. Login simples por senha (bancada); na produção vira login por
// usuário no núcleo Laravel/gru. Só calendário aqui (Fatia 3b, parte 1);
// encerrar ciclo e relatório PDF vêm depois.
//
// ⚠️ Bancada em iad/EUA: calendário NÃO tem dado de menor, então ok p/ teste.
// Não divulgar a URL: é ferramenta de teste.

const calendario = require("./paroquiaCalendario.js");

const SENHA = process.env.PSJ_SENHA || "saojose"; // bancada; trocar na produção
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function autorizado(req) {
  return req.query.s === SENHA || (req.body && req.body.s === SENHA);
}
function campoSenha() {
  return `<input type="hidden" name="s" value="${esc(SENHA)}">`;
}

function paginaLogin(erro) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Secretaria - Paróquia São José</title>${estilo()}</head><body>
<div class="card"><h1>⛪ Secretaria</h1><p class="sub">Paróquia São José <b>(teste)</b></p>
${erro ? `<p class="erro">${esc(erro)}</p>` : ""}
<form method="get" action="/psj/calendario">
<label>Senha</label><input type="password" name="s" autofocus>
<button type="submit">Entrar</button></form></div></body></html>`;
}

function rotuloOcorrencia(m) {
  const dt = m.iso;
  const dia = DIAS[dt.getDay()];
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const h = dt.getHours(), mi = dt.getMinutes();
  const hora = mi ? `${h}h${String(mi).padStart(2, "0")}` : `${h}h`;
  return `${dia}, ${dd}/${mm} - ${hora}`;
}

function paginaCalendario(msg) {
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const missas = calendario.gerarMissas(agora, 8); // próximos ~8 dias
  const cal = calendario.lerCalendario();

  const linhasMissas = missas.map(m => `
    <tr>
      <td>${esc(rotuloOcorrencia(m))}</td>
      <td>${esc(m.local)}</td>
      <td>${m.intencao ? "chat" : "comentarista"}</td>
      <td>
        <form method="post" action="/psj/cancelar" onsubmit="return confirm('Cancelar esta missa?')">
          ${campoSenha()}
          <input type="hidden" name="data" value="${esc(m.data)}">
          <input type="hidden" name="hora" value="${esc(m.hora)}">
          <input type="hidden" name="local" value="${esc(m.local)}">
          <button class="mini danger">Cancelar</button>
        </form>
      </td>
    </tr>`).join("");

  const opcoesLocal = calendario.LOCAIS.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
  const checksLocais = calendario.LOCAIS.map((l, i) =>
    `<label class="ck"><input type="checkbox" name="locais" value="${esc(l)}"> ${esc(l)}</label>`).join("");

  const excecoes = (cal.excecoes || []).map(e => `
    <li>${esc(e.tipo)} — ${esc(e.data)} ${esc(e.hora)} — ${esc(e.local)} ${e.motivo ? "(" + esc(e.motivo) + ")" : ""}
      <form method="post" action="/psj/remover-excecao" style="display:inline">
        ${campoSenha()}<input type="hidden" name="id" value="${e.id}">
        <button class="mini">remover</button></form></li>`).join("") || "<li class='vazio'>nenhuma</li>";

  const periodos = (cal.periodos || []).map(p => `
    <li>${esc(p.escopo === "so_local" ? "só" : "suspende")} — ${esc(p.inicio)} a ${esc(p.fim)} — ${esc((p.locais || []).join(", "))} ${p.motivo ? "(" + esc(p.motivo) + ")" : ""}
      <form method="post" action="/psj/remover-periodo" style="display:inline">
        ${campoSenha()}<input type="hidden" name="id" value="${p.id}">
        <button class="mini">remover</button></form></li>`).join("") || "<li class='vazio'>nenhum</li>";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calendário - Secretaria</title>${estilo()}</head><body>
<div class="wrap">
<h1>⛪ Calendário de Missas <span class="sub">(teste)</span></h1>
${msg ? `<p class="ok">${esc(msg)}</p>` : ""}

<h2>Próximos dias</h2>
<table><thead><tr><th>Quando</th><th>Local</th><th>Intenção</th><th></th></tr></thead>
<tbody>${linhasMissas || "<tr><td colspan=4 class='vazio'>sem missas</td></tr>"}</tbody></table>

<div class="grid">
  <section>
    <h2>➕ Adicionar missa</h2>
    <p class="hint">Ex.: aniversário do padre, missa extra num dia.</p>
    <form method="post" action="/psj/adicionar">
      ${campoSenha()}
      <label>Data</label><input type="date" name="data" required>
      <label>Horário</label><input type="time" name="hora" required>
      <label>Local</label><select name="local">${opcoesLocal}</select>
      <label class="ck"><input type="checkbox" name="intencao" checked> aceita intenção pelo chat</label>
      <label>Motivo</label><input type="text" name="motivo" placeholder="opcional">
      <button>Adicionar</button>
    </form>
  </section>

  <section>
    <h2>⏸ Suspender locais (período)</h2>
    <p class="hint">Ex.: capelas sem missa por um período (padre de licença).</p>
    <form method="post" action="/psj/suspender">
      ${campoSenha()}
      <label>De</label><input type="date" name="inicio" required>
      <label>Até</label><input type="date" name="fim" required>
      <div class="locais">${checksLocais}</div>
      <label>Motivo</label><input type="text" name="motivo" placeholder="opcional">
      <button>Suspender</button>
    </form>
  </section>

  <section>
    <h2>🎉 Festa de capela (só um local)</h2>
    <p class="hint">Tríduo/novena: só a capela em festa; as outras suspensas.</p>
    <form method="post" action="/psj/festa">
      ${campoSenha()}
      <label>De</label><input type="date" name="inicio" required>
      <label>Até</label><input type="date" name="fim" required>
      <label>Local em festa</label><select name="local">${opcoesLocal}</select>
      <label>Motivo</label><input type="text" name="motivo" placeholder="opcional">
      <button>Aplicar</button>
    </form>
  </section>
</div>

<h2>Exceções ativas</h2><ul class="lista">${excecoes}</ul>
<h2>Períodos ativos</h2><ul class="lista">${periodos}</ul>
</div></body></html>`;
}

function estilo() {
  return `<style>
  *{box-sizing:border-box} body{font-family:system-ui,Arial,sans-serif;margin:0;background:#f4f6f8;color:#1f2937}
  .wrap{max-width:960px;margin:0 auto;padding:16px}
  .card{max-width:360px;margin:60px auto;background:#fff;padding:24px;border-radius:12px;box-shadow:0 2px 12px #0001}
  h1{font-size:1.4rem;margin:.2rem 0} h2{font-size:1.05rem;margin:1.2rem 0 .5rem}
  .sub{color:#6b7280;font-weight:normal;font-size:.9rem} .hint{color:#6b7280;font-size:.85rem;margin:.2rem 0 .6rem}
  label{display:block;margin:.5rem 0 .2rem;font-size:.85rem;color:#374151}
  input,select,button{font-size:1rem;padding:.5rem;border:1px solid #d1d5db;border-radius:8px;width:100%}
  button{background:#2563eb;color:#fff;border:none;cursor:pointer;margin-top:.8rem} button:hover{background:#1d4ed8}
  .mini{width:auto;padding:.25rem .5rem;font-size:.8rem;margin:0;background:#6b7280} .mini.danger{background:#dc2626}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden}
  th,td{text-align:left;padding:.5rem;border-bottom:1px solid #eee;font-size:.9rem} th{background:#f9fafb}
  .grid{display:grid;grid-template-columns:1fr;gap:16px;margin-top:12px}
  @media(min-width:760px){.grid{grid-template-columns:1fr 1fr 1fr}}
  section{background:#fff;padding:14px;border-radius:10px;box-shadow:0 1px 6px #0001}
  .ck{display:flex;align-items:center;gap:.4rem} .ck input{width:auto}
  .locais label{font-weight:normal} .lista{background:#fff;border-radius:8px;padding:.6rem 1rem;list-style:none}
  .lista li{padding:.35rem 0;border-bottom:1px solid #f0f0f0;font-size:.9rem;display:flex;justify-content:space-between;gap:8px;align-items:center}
  .vazio{color:#9ca3af} .ok{background:#dcfce7;color:#166534;padding:.5rem;border-radius:8px}
  .erro{background:#fee2e2;color:#991b1b;padding:.5rem;border-radius:8px}
  </style>`;
}

// Registra as rotas no app Express do bot.
function registrarRotasParoquia(app) {
  const guard = (req, res, next) => {
    if (autorizado(req)) return next();
    res.send(paginaLogin(req.method === "POST" ? "Senha inválida." : ""));
  };

  app.get("/psj", (req, res) => res.send(paginaLogin("")));
  app.get("/psj/calendario", guard, (req, res) => res.send(paginaCalendario(req.query.msg)));

  app.post("/psj/adicionar", guard, (req, res) => {
    const { data, hora, local, intencao, motivo } = req.body;
    calendario.adicionarExcecao({ data, hora, local, tipo: "extra", intencao: intencao === "on", motivo });
    res.send(paginaCalendario("Missa adicionada."));
  });

  app.post("/psj/cancelar", guard, (req, res) => {
    const { data, hora, local } = req.body;
    calendario.adicionarExcecao({ data, hora, local, tipo: "cancelada", motivo: "cancelada pela secretaria" });
    res.send(paginaCalendario("Missa cancelada."));
  });

  app.post("/psj/suspender", guard, (req, res) => {
    let { inicio, fim, locais, motivo } = req.body;
    locais = Array.isArray(locais) ? locais : (locais ? [locais] : []);
    if (locais.length) calendario.adicionarPeriodo({ inicio, fim, escopo: "suspende_locais", locais, motivo });
    res.send(paginaCalendario(locais.length ? "Locais suspensos no período." : "Selecione ao menos um local."));
  });

  app.post("/psj/festa", guard, (req, res) => {
    const { inicio, fim, local, motivo } = req.body;
    calendario.adicionarPeriodo({ inicio, fim, escopo: "so_local", locais: [local], motivo });
    res.send(paginaCalendario("Festa de capela aplicada."));
  });

  app.post("/psj/remover-excecao", guard, (req, res) => {
    calendario.removerExcecao(req.body.id);
    res.send(paginaCalendario("Exceção removida."));
  });

  app.post("/psj/remover-periodo", guard, (req, res) => {
    calendario.removerPeriodo(req.body.id);
    res.send(paginaCalendario("Período removido."));
  });

  console.log("⛪ [psj] Tela da secretaria registrada em /psj (calendário)");
}

module.exports = { registrarRotasParoquia };
