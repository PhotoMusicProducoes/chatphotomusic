// services/paroquiaWeb.js
// Tela WEB da secretaria (bancada de teste). Servida pelo próprio Express do
// bot, sob /psj. Login simples por senha (bancada); na produção vira login por
// usuário no núcleo Laravel/gru. Só calendário aqui (Fatia 3b, parte 1);
// encerrar ciclo e relatório PDF vêm depois.
//
// ⚠️ Bancada em iad/EUA: calendário NÃO tem dado de menor, então ok p/ teste.
// Não divulgar a URL: é ferramenta de teste.

const calendario = require("./paroquiaCalendario.js");
const intencoesDB = require("./paroquiaIntencoes.js");

const SENHA = process.env.PSJ_SENHA || "saojose"; // bancada; trocar na produção
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function rotuloIso(iso) {
  const dt = new Date(iso);
  const dia = DIAS[dt.getDay()];
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const h = dt.getHours(), mi = dt.getMinutes();
  const hora = mi ? `${h}h${String(mi).padStart(2, "0")}` : `${h}h`;
  return `${dia}, ${dd}/${mm} - ${hora}`;
}

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
    <li>${esc(p.escopo === "so_local" ? "só" : "suspende")} — ${esc(p.inicio)} a ${esc(p.fim)} — ${esc((p.locais || []).join(", "))}${p.horario ? " às " + esc(p.horario) : ""} ${p.motivo ? "(" + esc(p.motivo) + ")" : ""}
      <form method="post" action="/psj/remover-periodo" style="display:inline">
        ${campoSenha()}<input type="hidden" name="id" value="${p.id}">
        <button class="mini">remover</button></form></li>`).join("") || "<li class='vazio'>nenhum</li>";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calendário - Secretaria</title>${estilo()}</head><body>
<div class="wrap">
<h1>⛪ Secretaria <span class="sub">(teste)</span></h1>
${nav("calendario")}
<h2 style="margin-top:0">Calendário de Missas</h2>
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
      <label>Horário da missa da festa</label><input type="time" name="horario" required>
      <label>Motivo</label><input type="text" name="motivo" placeholder="opcional">
      <button>Aplicar</button>
    </form>
  </section>
</div>

<h2>Exceções ativas</h2><ul class="lista">${excecoes}</ul>
<h2>Períodos ativos</h2><ul class="lista">${periodos}</ul>
</div></body></html>`;
}

function nav(ativo) {
  const item = (id, url, txt) =>
    `<a class="${ativo === id ? "on" : ""}" href="${url}?s=${esc(SENHA)}">${txt}</a>`;
  return `<nav class="nav">${item("calendario", "/psj/calendario", "📅 Calendário")}${item("intencoes", "/psj/intencoes", "🙏 Intenções e relatório")}</nav>`;
}

// "(pediu: Fulano)" — quem solicitou a intenção. Intenções antigas (antes deste
// campo existir) simplesmente não mostram nada.
function pedidoPor(i) {
  return i.solicitante_nome ? ` <span class="quem">(pediu: ${esc(i.solicitante_nome)})</span>` : "";
}

// Botão de excluir uma intenção. `voltar` diz para qual tela retornar depois
// (a lista de pendentes ou o relatório que a secretaria está conferindo).
function formExcluir(i, voltar, corteId) {
  return `<form method="post" action="/psj/intencao-excluir" style="display:inline"
      onsubmit="return confirm('Excluir a intenção de ${esc(String(i.nome_oracao).replace(/'/g, ""))}? Isso não pode ser desfeito.')">
    ${campoSenha()}
    <input type="hidden" name="id" value="${i.id}">
    <input type="hidden" name="voltar" value="${esc(voltar)}">
    ${corteId ? `<input type="hidden" name="corte" value="${esc(corteId)}">` : ""}
    <button class="mini danger">excluir</button></form>`;
}

// ---------------------------------------------------------------------------
// Página INTENÇÕES + ENCERRAR CICLO
// ---------------------------------------------------------------------------
function paginaIntencoes(msg) {
  const grupos = intencoesDB.pendentesPorMissa();
  const cortes = intencoesDB.lerCortes().slice().reverse();

  let corpo;
  if (grupos.length === 0) {
    corpo = "<p class='vazio'>Nenhuma intenção pendente.</p>";
  } else {
    corpo = grupos.map(g => {
      const linhas = g.intencoes.map(i =>
        `<li>
          <span>${esc(i.tipo)} — <b>${esc(i.nome_oracao)}</b>${pedidoPor(i)}${i.origem === "secretaria" ? " <span class='tag'>secretaria</span>" : ""}</span>
          ${formExcluir(i, "intencoes")}
        </li>`).join("");
      return `
      <div class="missa">
        <div class="missa-cab">
          <b>${esc(g.missa_rotulo || rotuloIso(g.missa_iso))}</b>
          <span class="badge">${g.intencoes.length}</span>
        </div>
        <ul class="nomes">${linhas}</ul>
        <form method="post" action="/psj/encerrar" onsubmit="return confirm('Encerrar as intenções até esta Missa e gerar o relatório? Depois, o chat não aceita mais intenção para elas (dá pra retomar).')">
          ${campoSenha()}
          <input type="hidden" name="ate_iso" value="${esc(g.missa_iso)}">
          <button>Encerrar até aqui e gerar relatório</button>
        </form>
      </div>`;
    }).join("");
  }

  // Encerramentos: ver relatório (sempre atualizado) + retomar (desfazer).
  const hist = cortes.length
    ? cortes.map(c => {
        const qtd = intencoesDB.intencoesDoCorte(c.id).length;
        return `<li>
          <span>${esc(rotuloIso(c.ate_iso))} — ${qtd} intenção(ões)</span>
          <span>
            <a class="mini-link" href="/psj/relatorio?s=${esc(SENHA)}&corte=${c.id}" target="_blank">ver / imprimir</a>
            <form method="post" action="/psj/retomar" style="display:inline" onsubmit="return confirm('Retomar este encerramento? As Missas voltam a aceitar intenção pelo chat.')">
              ${campoSenha()}<input type="hidden" name="id" value="${c.id}">
              <button class="mini">retomar</button></form>
          </span></li>`;
      }).join("")
    : "<li class='vazio'>nenhum</li>";

  // Formulário: a secretaria cadastra intenção (pedido presencial/telefone).
  // Lista as próximas missas da matriz (inclui as já encerradas: dá p/ incluir
  // e gerar o relatório de novo).
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const missas = calendario.gerarMissas(agora, 12).filter(m => m.intencao).slice(0, 20);
  const opcoesMissa = missas.map(m => {
    const iso = m.iso.toISOString();
    const fechada = intencoesDB.estaFechadaManual(iso);
    return `<option value="${esc(iso)}">${esc(rotuloIso(iso))}${fechada ? " (encerrada)" : ""}</option>`;
  }).join("");
  const opcoesTipo = intencoesDB.TIPOS_INTENCAO.filter(t => t !== "Outros")
    .map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("") +
    `<option value="__outro">Outros (digitar)</option>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intenções - Secretaria</title>${estilo()}</head><body>
<div class="wrap">
<h1>⛪ Secretaria <span class="sub">(teste)</span></h1>
${nav("intencoes")}
<h2 style="margin-top:0">Intenções pendentes</h2>
${msg ? `<p class="ok">${esc(msg)}</p>` : ""}
<p class="hint">Encerrar até uma Missa gera o relatório e fecha essas Missas no chat. Dá para <b>retomar</b> se encerrar por engano.</p>
${corpo}

<section style="margin-top:16px">
  <h2>➕ Cadastrar intenção (secretaria)</h2>
  <p class="hint">Para quem pede na secretaria ou por telefone. Pode incluir mesmo numa Missa já encerrada e gerar o relatório de novo.</p>
  <form method="post" action="/psj/intencao-nova">
    ${campoSenha()}
    <label>Missa</label><select name="missa_iso" required>${opcoesMissa}</select>
    <label>Tipo</label><select name="tipo" onchange="document.getElementById('outro').style.display=this.value==='__outro'?'block':'none'">${opcoesTipo}</select>
    <input type="text" id="outro" name="tipo_outro" placeholder="descreva a intenção" style="display:none;margin-top:.4rem">
    <label>Nome(s) — separe por vírgula se mais de um</label><input type="text" name="nomes" required placeholder="ex: Cléa Nazeanze, João da Silva">
    <label>Quem pediu</label><input type="text" name="solicitante" placeholder="opcional — nome de quem solicitou">
    <button>Cadastrar intenção</button>
  </form>
</section>

<h2>Encerramentos</h2><ul class="lista">${hist}</ul>
</div></body></html>`;
}

// Relatório imprimível de um corte (a secretaria abre e imprime / salva PDF).
function paginaRelatorio(corteId) {
  const corte = intencoesDB.lerCortes().find(c => c.id === Number(corteId));
  const ints = intencoesDB.intencoesDoCorte(corteId);
  if (!corte) return "<p>Relatório não encontrado.</p>";

  // agrupa por missa
  const mapa = new Map();
  for (const i of ints) {
    const k = i.missa_iso;
    if (!mapa.has(k)) mapa.set(k, { rotulo: i.missa_rotulo || rotuloIso(k), itens: [] });
    mapa.get(k).itens.push(i);
  }
  // Linhas em branco DEPOIS DE CADA intenção: quem chega 20 min antes fala com
  // o(a) comentarista, que continua a lista daquela intenção à mão, embaixo dos
  // nomes que a secretaria já imprimiu. (Regra do Mario, 17/07.)
  const linhasEscrita = `<div class="escrita">${'<span class="ln"></span>'.repeat(4)}</div>`;

  // O "excluir" e o "(pediu: ...)" são da conferência na tela: somem na
  // impressão, onde o papel só precisa do nome e do tipo p/ o celebrante ler.
  const blocos = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([iso, g]) => `
    <h3>${esc(g.rotulo)}</h3>
    <ol>${g.itens.map(i => `<li><b>${esc(i.nome_oracao)}</b> — ${esc(i.tipo)}
      <span class="tela">${pedidoPor(i)} ${formExcluir(i, "relatorio", corte.id)}</span>
      ${linhasEscrita}</li>`).join("")}</ol>
  `).join("") || "<p>Sem intenções neste relatório.</p>";

  const geradoEm = new Date(corte.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório de Intenções</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:0 auto;padding:24px;color:#111}
  h1{font-size:1.4rem;text-align:center;margin:.2rem 0}
  .sub{text-align:center;color:#555;margin:0 0 1rem;font-size:.9rem}
  h3{border-bottom:2px solid #333;padding-bottom:.2rem;margin:1.2rem 0 .4rem;break-after:avoid}
  ol{margin:.2rem 0 .8rem 1.4rem} li{padding:.15rem 0;break-inside:avoid}
  /* Linhas p/ o comentarista continuar a lista à mão, antes da Missa. */
  .escrita{margin:.15rem 0 .5rem}
  .ln{display:block;border-bottom:1px solid #aaa;height:1.05rem}
  .barra{text-align:center;margin:14px 0}
  button{font:inherit;padding:.5rem 1rem;border:1px solid #333;background:#f3f3f3;border-radius:6px;cursor:pointer}
  .quem{color:#666;font-size:.78rem;font-family:system-ui,sans-serif}
  .tela .mini{font:inherit;font-size:.72rem;padding:.05rem .4rem;border:1px solid #c99;background:#fff;color:#a11;border-radius:4px}
  @media print { .barra, .tela{display:none} body{padding:0} }
</style></head><body>
<div class="barra"><button onclick="window.print()">🖨 Imprimir</button>
  <p class="sub" style="margin:.5rem 0 0">Confira antes de imprimir: dá para <b>excluir</b> uma intenção repetida aqui mesmo. Os botões não saem no papel.</p></div>
<h1>Intenções de Missa</h1>
<p class="sub">Paróquia São José · gerado em ${esc(geradoEm)}</p>
${blocos}
</body></html>`;
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
  .nav{display:flex;gap:8px;margin:.4rem 0 1rem} .nav a{padding:.4rem .8rem;border-radius:8px;text-decoration:none;background:#e5e7eb;color:#374151;font-size:.9rem}
  .nav a.on{background:#2563eb;color:#fff}
  .missa{background:#fff;border-radius:10px;padding:12px;margin:.6rem 0;box-shadow:0 1px 6px #0001}
  .missa-cab{display:flex;justify-content:space-between;align-items:center} .badge{background:#2563eb;color:#fff;border-radius:999px;padding:.1rem .6rem;font-size:.85rem}
  .nomes{margin:.4rem 0 .6rem 1.1rem}
  .nomes li{padding:.1rem 0;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .quem{color:#6b7280;font-size:.8rem}
  .mini-link{font-size:.8rem;margin-left:6px}
  .tag{background:#fde68a;color:#92400e;border-radius:6px;padding:0 .4rem;font-size:.72rem}
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
    const { inicio, fim, local, horario, motivo } = req.body;
    calendario.adicionarPeriodo({ inicio, fim, escopo: "so_local", locais: [local], horario, motivo });
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

  // Intenções + encerramento + relatório
  app.get("/psj/intencoes", guard, (req, res) => res.send(paginaIntencoes(req.query.msg)));
  app.post("/psj/encerrar", guard, (req, res) => {
    const corte = intencoesDB.encerrarAte(req.body.ate_iso);
    const qtd = intencoesDB.intencoesDoCorte(corte.id).length;
    res.send(paginaIntencoes(`Relatório gerado (${qtd} intenção(ões)). Essas Missas foram encerradas no chat.`));
  });
  app.get("/psj/relatorio", guard, (req, res) => res.send(paginaRelatorio(req.query.corte)));

  // Excluir intenção repetida (a secretaria lançou 2x, ou o fiel pediu 2x).
  // Serve antes e depois do encerramento: se veio do relatório, volta pra ele
  // já sem a linha, pronto p/ imprimir.
  app.post("/psj/intencao-excluir", guard, (req, res) => {
    intencoesDB.removerIntencao(req.body.id);
    if (req.body.voltar === "relatorio") return res.send(paginaRelatorio(req.body.corte));
    res.send(paginaIntencoes("Intenção excluída."));
  });

  app.post("/psj/retomar", guard, (req, res) => {
    intencoesDB.retomarCorte(req.body.id);
    res.send(paginaIntencoes("Encerramento retomado. As Missas voltaram a aceitar intenção pelo chat."));
  });

  // Cadastro de intenção pela secretaria (pedido presencial/telefone).
  app.post("/psj/intencao-nova", guard, (req, res) => {
    const { missa_iso, tipo, tipo_outro, nomes, solicitante } = req.body;
    const listaNomes = String(nomes || "").split(/[,;]+/).map(n => n.trim()).filter(n => n.length >= 2);
    if (!missa_iso || listaNomes.length === 0) {
      return res.send(paginaIntencoes("Informe a Missa e ao menos um nome."));
    }
    intencoesDB.gravarIntencao({
      paroquia_id: 1,
      tipo: tipo === "__outro" ? (tipo_outro || "Outros") : tipo,
      nome_oracao: listaNomes.join(", "),
      nomes: listaNomes,
      missa_iso,
      missa_rotulo: rotuloIso(missa_iso),
      solicitante_nome: String(solicitante || "").trim(),
      origem: "secretaria"
    });
    const aviso = intencoesDB.estaFechadaManual(missa_iso)
      ? "Intenção cadastrada. A Missa já estava encerrada — reabra o relatório dela para gerar de novo, já com esta intenção."
      : "Intenção cadastrada.";
    res.send(paginaIntencoes(aviso));
  });

  console.log("⛪ [psj] Tela da secretaria registrada em /psj (calendário + intenções)");
}

module.exports = { registrarRotasParoquia };
