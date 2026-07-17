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
const batismoDB = require("./paroquiaBatismo.js");

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
  return `<nav class="nav">${item("calendario", "/psj/calendario", "📅 Calendário")}${item("intencoes", "/psj/intencoes", "🙏 Intenções e relatório")}${item("batismo", "/psj/batismo", "💧 Batismo")}</nav>`;
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
          <span>${esc(i.tipo)} — <b>${esc(intencoesDB.nomesFormatados(i))}</b>${pedidoPor(i)}${i.origem === "secretaria" ? " <span class='tag'>secretaria</span>" : ""}</span>
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
    <label>Tipo</label><select name="tipo" onchange="tipoMudou(this.value)">${opcoesTipo}</select>
    <input type="text" id="outro" name="tipo_outro" placeholder="descreva a intenção" style="display:none;margin-top:.4rem">
    <div id="casamento" style="display:none">
      <label>Anos de casados</label>
      <input type="number" name="anos_casamento" min="1" max="100" placeholder="ex: 25 — sai como Bodas de Prata no relatório">
    </div>
    <label>Nome(s) — separe por vírgula se mais de um</label><input type="text" name="nomes" required placeholder="ex: Cléa Nazeanze, João da Silva">
    <label>Quem pediu</label><input type="text" name="solicitante" placeholder="opcional — nome de quem solicitou">
    <button>Cadastrar intenção</button>
  </form>
</section>

<h2>Encerramentos</h2><ul class="lista">${hist}</ul>
<script>
// "Outros" pede a descrição; aniversário de casamento pede os anos de casados.
function tipoMudou(v) {
  document.getElementById('outro').style.display = v === '__outro' ? 'block' : 'none';
  document.getElementById('casamento').style.display = v === ${JSON.stringify(intencoesDB.TIPO_CASAMENTO)} ? 'block' : 'none';
}
</script>
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

  // UMA linha por TIPO, com todos os nomes daquele tipo (o que se multiplica são
  // os nomes, não a intenção). O excluir some na impressão e é por REGISTRO, não
  // por tipo, então mora na lista de pendentes / na conferência de tela.
  const blocos = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([iso, g]) => `
    <h3>${esc(g.rotulo)}</h3>
    <ol>${intencoesDB.porTipo(g.itens).map(t => `<li>
      <span class="tipo">${esc(t.tipo)}</span> — ${esc(t.nomes)}
      ${linhasEscrita}</li>`).join("")}</ol>
    <div class="tela conferencia">
      <p class="cap">Conferir e excluir repetida (não sai na impressão):</p>
      ${g.itens.map(i => `<span class="conf">${esc(i.tipo)}: ${esc(intencoesDB.nomesFormatados(i))}${pedidoPor(i)} ${formExcluir(i, "relatorio", corte.id)}</span>`).join("")}
    </div>
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
  .tipo{font-weight:bold}
  /* Linhas p/ o comentarista continuar a lista à mão, antes da Missa. */
  .escrita{margin:.15rem 0 .5rem}
  .ln{display:block;border-bottom:1px solid #aaa;height:1.05rem}
  /* Bloco de conferência: só na tela (o excluir é por registro, não por tipo). */
  .conferencia{background:#f7f7f7;border-radius:6px;padding:.5rem .7rem;margin:0 0 1rem;font-family:system-ui,sans-serif}
  .cap{font-size:.75rem;color:#555;margin:0 0 .3rem}
  .conf{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.8rem;padding:.15rem 0;border-bottom:1px solid #ececec}
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

// ---------------------------------------------------------------------------
// BATISMO - lado da secretaria (fatia 4a): lista as inscrições recebidas e
// gera o link de inscrição p/ testar. O formulário público mora em
// paroquiaBatismo.js (/psj/b/:token).
// ---------------------------------------------------------------------------
function paginaBatismo(msg, linkNovo) {
  const inscricoes = batismoDB.lerInscricoes().slice().reverse();
  const rotuloStatus = { convite: "aguardando preenchimento", recebida: "recebida", pendente: "pendente", aprovada: "aprovada" };

  const linhas = inscricoes.map(i => {
    const nome = i.crianca_nome || "(ainda não preenchida)";
    const quando = i.batismo_data
      ? `${i.batismo_data.split("-").reverse().join("/")} - ${esc(i.batismo_local || "")}`
      : "-";
    const link = batismoDB.linkDoToken(i.token);
    return `<li>
      <span>
        <b>${esc(nome)}</b> <span class="tag">${esc(rotuloStatus[i.status] || i.status)}</span><br>
        <span class="quem">Batismo: ${esc(quando)}</span>
        ${i.status === "convite" ? `<br><span class="quem">Link: <a href="${esc(link)}" target="_blank">${esc(link)}</a></span>` : ""}
      </span>
      <span style="display:flex;gap:6px;align-items:center">
        ${i.status !== "convite" ? `<a class="mini-link" href="/psj/batismo/${i.token}?s=${esc(SENHA)}" target="_blank">ver ficha</a>` : ""}
        <form method="post" action="/psj/batismo-excluir" style="display:inline" onsubmit="return confirm('Excluir esta inscrição?')">
          ${campoSenha()}<input type="hidden" name="id" value="${i.id}"><button class="mini danger">excluir</button></form>
      </span></li>`;
  }).join("") || "<li class='vazio'>nenhuma inscrição ainda</li>";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Batismo - Secretaria</title>${estilo()}</head><body>
<div class="wrap">
<h1>⛪ Secretaria <span class="sub">(teste)</span></h1>
${nav("batismo")}
<h2 style="margin-top:0">Inscrições de Batismo</h2>
${msg ? `<p class="ok">${esc(msg)}</p>` : ""}
${linkNovo ? `<p class="ok">Link de inscrição gerado (é de teste, use dados fictícios):<br><a href="${esc(linkNovo)}" target="_blank">${esc(linkNovo)}</a></p>` : ""}
<p class="hint">💧 A ficha da paróquia vira formulário online. A família preenche pelo link; aqui você acompanha e (nas próximas etapas) confere documentos e assinatura.</p>

<section style="margin-bottom:14px">
  <h2 style="margin-top:0">Gerar link de inscrição (teste)</h2>
  <p class="hint">Cria um link novo p/ simular uma família preenchendo. 🚨 Bancada: só dados fictícios.</p>
  <form method="post" action="/psj/batismo-link">
    ${campoSenha()}
    <label>WhatsApp da família (opcional)</label>
    <input type="text" name="whatsapp" placeholder="ex: 21 99999-9999">
    <button style="width:auto">Gerar link</button>
  </form>
</section>

<ul class="lista">${linhas}</ul>
</div></body></html>`;
}

// Ficha completa de uma inscrição, p/ a secretaria conferir (só leitura).
function paginaBatismoFicha(token) {
  const d = batismoDB.acharPorToken(token);
  if (!d) return "<p>Inscrição não encontrada.</p>";
  const sn = v => v === "sim" ? "Sim" : v === "nao" ? "Não" : "-";
  const linha = (r, v) => `<tr><th style="width:45%">${esc(r)}</th><td>${esc(v || "-")}</td></tr>`;
  const pad = (t, p) => `<h3>${t}</h3><table>
    ${linha("Nome", d[p + "_nome"])}${linha("Telefone", d[p + "_tel"])}
    <tr><th>Batizado</th><td>${sn(d[p + "_batizado"])}</td></tr>
    <tr><th>Católico</th><td>${sn(d[p + "_catolico"])}</td></tr>
    <tr><th>Fez 1ª Eucaristia</th><td>${sn(d[p + "_eucaristia"])}</td></tr>
    <tr><th>Crismado</th><td>${sn(d[p + "_crismado"])}</td></tr>
    <tr><th>Casado</th><td>${sn(d[p + "_casado"])}</td></tr>
    <tr><th>Casado na Igreja Católica</th><td>${sn(d[p + "_casado_igreja"])}</td></tr>
    ${linha("Cônjuge", d[p + "_conjuge"])}
    <tr><th>Frequenta outra religião</th><td>${sn(d[p + "_outra_religiao"])}</td></tr>
    <tr><th>Frequenta Missa aos domingos</th><td>${sn(d[p + "_missa_domingo"])}</td></tr>
    ${linha("Se outra igreja, qual", d[p + "_missa_qual"])}</table>`;
  const quando = d.batismo_data ? `${d.batismo_data.split("-").reverse().join("/")} - ${esc(d.batismo_local || "")}` : "-";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ficha de Batismo</title>${estilo()}
<style>h3{color:#1d4ed8;margin:1.1rem 0 .3rem;font-size:1rem} td,th{font-size:.88rem}
.docs-grid{display:grid;gap:8px} .doc-item{background:#fff;border:1px solid #eef0f2;border-radius:8px;padding:.5rem .7rem;font-size:.85rem}
.doc-item.falta{display:flex;justify-content:space-between;align-items:center;border-color:#fecaca;background:#fef2f2}
.thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:.4rem} .thumbs img{width:76px;height:76px;object-fit:cover;border-radius:6px;border:1px solid #d1d5db}
.thumbs .pdf{padding:.35rem .6rem;background:#f3f4f6;border-radius:6px;text-decoration:none;color:#374151;font-size:.8rem}</style></head><body>
<div class="wrap">
<h1>Ficha de Batismo</h1>
<p class="sub">Batismo: ${quando}</p>
<h3>Criança</h3><table>
  ${linha("Nome", d.crianca_nome)}${linha("Nascimento", d.crianca_nascimento)}
  ${linha("Cidade", d.crianca_cidade)}${linha("UF", d.crianca_uf)}${linha("Naturalidade", d.crianca_natural)}</table>
<h3>Pais</h3><table>
  ${linha("Pai", d.pai_nome)}${linha("Tel. pai", d.pai_tel)}
  ${linha("Mãe", d.mae_nome)}${linha("Tel. mãe", d.mae_tel)}
  ${linha("Endereço", (d.endereco || "") + (d.numero ? ", " + d.numero : ""))}
  ${linha("Bairro", d.bairro)}${linha("Cidade", d.cidade)}${linha("CEP", d.cep)}
  ${linha("Paróquia que frequentam", d.paroquia_frequentam)}
  <tr><th>Pais casados</th><td>${sn(d.pais_casados)}</td></tr>
  <tr><th>Casados na Igreja Católica</th><td>${sn(d.pais_casados_igreja)}</td></tr></table>
${pad("Padrinho", "padrinho")}
${pad("Madrinha", "madrinha")}
<h3>Documentos anexados</h3>
${(() => {
  const docs = d.documentos || [];
  if (!docs.length) return "<p class='vazio'>Nenhum documento anexado ainda.</p>";
  return `<div class="docs-grid">` + batismoDB.DOCUMENTOS.map(tp => {
    const enviados = docs.filter(x => x.tipo === tp.id);
    if (!enviados.length) return `<div class="doc-item falta"><b>${esc(tp.label)}</b><span class="quem">faltando</span></div>`;
    const thumbs = enviados.map(x => {
      const url = `/psj/b/${d.token}/doc/${x.id}`;
      return x.mime === "application/pdf"
        ? `<a href="${url}" target="_blank" class="pdf">📄 PDF</a>`
        : `<a href="${url}" target="_blank"><img src="${url}" alt=""></a>`;
    }).join("");
    return `<div class="doc-item"><b>${esc(tp.label)}</b><div class="thumbs">${thumbs}</div></div>`;
  }).join("") + `</div>`;
})()}
<h3>Assinaturas</h3>
${(() => {
  const ass = d.assinaturas || [];
  return batismoDB.ASSINANTES.map(tp => {
    const a = ass.find(x => x.tipo === tp);
    const titulo = tp === "padrinho" ? "Padrinho" : "Madrinha";
    if (!a) return `<div class="doc-item falta"><b>${titulo}</b><span class="quem">não assinou</span></div>`;
    const data = new Date(a.assinado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `<div class="doc-item"><b>${titulo}: ${esc(a.nome)}</b>
      <div class="thumbs"><img src="/psj/b/${d.token}/assinatura/${tp}" alt="assinatura" style="background:#fff"></div>
      <span class="quem">assinado em ${esc(data)} · verificação ${esc(a.hash.slice(0, 12))}…</span></div>`;
  }).join("");
})()}
<p class="hint">Conferência da secretaria. Revisão (marcar pendência e avisar a família) entra na próxima etapa.</p>
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
    const { missa_iso, tipo, tipo_outro, nomes, solicitante, anos_casamento } = req.body;
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
      anos_casamento: tipo === intencoesDB.TIPO_CASAMENTO ? parseInt(anos_casamento, 10) || null : null,
      solicitante_nome: String(solicitante || "").trim(),
      origem: "secretaria"
    });
    const aviso = intencoesDB.estaFechadaManual(missa_iso)
      ? "Intenção cadastrada. A Missa já estava encerrada — reabra o relatório dela para gerar de novo, já com esta intenção."
      : "Intenção cadastrada.";
    res.send(paginaIntencoes(aviso));
  });

  // ---- BATISMO (fatia 4a) ----
  // Secretaria (protegido)
  app.get("/psj/batismo", guard, (req, res) => res.send(paginaBatismo(req.query.msg)));
  app.post("/psj/batismo-link", guard, (req, res) => {
    const conv = batismoDB.gerarConvite(req.body.whatsapp);
    res.send(paginaBatismo("", batismoDB.linkDoToken(conv.token)));
  });
  app.post("/psj/batismo-excluir", guard, (req, res) => {
    batismoDB.removerInscricao(req.body.id);
    res.send(paginaBatismo("Inscrição excluída."));
  });
  app.get("/psj/batismo/:token", guard, (req, res) => res.send(paginaBatismoFicha(req.params.token)));

  // Formulário PÚBLICO (o fiel preenche; sem senha, protegido pelo token).
  app.get("/psj/b/:token", (req, res) => res.send(batismoDB.paginaForm(req.params.token, req.query.msg)));
  app.post("/psj/b/:token", (req, res) => {
    const r = batismoDB.processarPost(req.params.token, req.body);
    if (r.erro) return res.send(batismoDB.paginaForm(req.params.token, null, r.erro));
    res.send(batismoDB.paginaForm(req.params.token, "Inscrição enviada! Agora anexe os documentos abaixo. A secretaria confere e, se faltar algo, entra em contato. 🙏"));
  });

  // Documentos do batismo (fatia 4b). Protegidos pelo token (não adivinhável).
  app.post("/psj/b/:token/doc", (req, res) => res.json(batismoDB.salvarDoc(req.params.token, req.body || {})));
  app.post("/psj/b/:token/doc-excluir", (req, res) => {
    batismoDB.removerDoc(req.params.token, (req.body || {}).id);
    res.json({ ok: true });
  });
  app.get("/psj/b/:token/doc/:docId", (req, res) => {
    const a = batismoDB.arquivoDoc(req.params.token, req.params.docId);
    if (!a) return res.status(404).send("Documento não encontrado.");
    res.type(a.mime);
    res.sendFile(a.caminho);
  });

  // Assinatura digital (fatia 4c). Protegida pelo token.
  app.post("/psj/b/:token/assinar", (req, res) => res.json(batismoDB.salvarAssinatura(req.params.token, req.body || {})));
  app.post("/psj/b/:token/assinar-excluir", (req, res) => {
    batismoDB.removerAssinatura(req.params.token, (req.body || {}).tipo);
    res.json({ ok: true });
  });
  app.get("/psj/b/:token/assinatura/:tipo", (req, res) => {
    const a = batismoDB.arquivoAssinatura(req.params.token, req.params.tipo);
    if (!a) return res.status(404).send("Assinatura não encontrada.");
    res.type(a.mime);
    res.sendFile(a.caminho);
  });

  console.log("⛪ [psj] Tela da secretaria registrada em /psj (calendário + intenções + batismo)");
}

module.exports = { registrarRotasParoquia };
