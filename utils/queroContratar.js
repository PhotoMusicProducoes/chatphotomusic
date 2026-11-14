// utils/queroContratar.js - reconhece "quero contratar" em qualquer forma e acha o nº do orçamento (13/11/2026, RJN)
//
// Antes: o botão principal do PDF ("QUERO FECHAR ESTA PROPOSTA") manda
// "Oi! Quero seguir com o orçamento nº 612 (...)" e o bot NÃO entendia:
// silêncio (conversa encerrada), menu de boas-vindas (sem conversa) ou
// "Não entendi" (menu pós-orçamento). Ninguém era avisado.

function normalizar(texto) {
  return String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();
}

/* Frases do botão do PDF, do follow-up e do cliente escrevendo. */
function clienteQuerFechar(texto) {
  const t = normalizar(texto);
  if (!t) return false;
  // negação explícita: "não quero contratar", "ainda não vou fechar", "não vou seguir"
  if (/\bnao\b[^.!?]*\b(contrat|fechar|fecha|seguir com|aprovar|reservar)/.test(t)) return false;
  // 13/11/2026 (Mario): "fechar" com OUTRA coisa não é com a gente ("vou fechar o salão primeiro",
  // "vou contratar outra empresa")
  if (/\bfech\w* (o |a |com o |com a |com )?(salao|buffet|espaco|local|casa de festa|igreja|cerimonial|decoracao|bolo|porta|outr[ao])\b/.test(t)) return false;
  if (/\bcontrat\w* (com )?(outr[ao]|a concorrencia|o concorrente)\b/.test(t)) return false;
  // quem fala (13/11/2026, Mario: "quero fechar, vou fechar, vamos fechar, vamos contratar")
  const QUEM = "(quero|queremos|vou|vamos|bora|gostaria de|gostariamos de|desejo|podemos|pode|decidi|decidimos|resolvi|resolvemos|topo|topamos)";
  return /\bquero seguir com o orcamento\b/.test(t)                                     // botão do PDF
      || new RegExp(`\\b${QUEM}\\b[^.!?]{0,30}\\b(fechar|aprovar)\\b`).test(t)          // "quero fechar esta proposta", "bora fechar"
      || /\b(fechar|aprovar) (esta|essa|a|o|nossa) (proposta|orcamento)\b/.test(t)
      || new RegExp(`\\b${QUEM}\\b[^.!?]{0,20}\\bcontrat(ar|o|amos)\\b`).test(t)         // "quero contratar", "queremos contratar"
      || /^(contrat(ar|o)|fechar|fechamos|fechar com voces|pode fechar)\b/.test(t)
      || /\b(fecha|fechem|fechamos) (pra|para|com) (mim|a gente|nos|voces)\b/.test(t)     // "fecha pra mim", "fechamos com vocês"
      || /\bvamos fechar negocio\b/.test(t)
      || /\b(quero|queremos|pode|podemos|vamos) (garantir|reservar)( a (minha |nossa )?data)?\b/.test(t);
}

/* "Fechado!", "Fechou!", "Combinado, fechado": quer dizer "combinado". Só vale como contratar quando o
   cliente NÃO está no meio das perguntas de um orçamento (lá pode ser só um "ok"). Quem chama decide. */
function soFechado(texto) {
  const t = normalizar(texto).replace(/[!.]+$/, "").trim();
  return /^((ta |esta |entao |combinado,? |ok,? )?(fechado|fechou|fechamos)( entao)?( com voces)?)$/.test(t);
}

/* Nº do orçamento citado: "orçamento nº 612", "orçamento 612", "nº612", "n. 612". */
function numeroDoOrcamento(texto) {
  const t = normalizar(texto);
  const m = t.match(/\b(?:n[º°o.]|numero|orcamento(?: n[º°o.]?)?)\s*(\d{2,6})\b/);
  return m ? Number(m[1]) : null;
}

function brl(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Resumo da proposta para o cliente confirmar (pacote e horas de cada serviço). */
function resumoOrcamento(o) {
  const linhas = (o.itens || []).map(i =>
    `• ${i.servico}${i.pacote && i.pacote !== i.servico ? " - " + i.pacote : ""}${i.horas ? " (" + i.horas + "h)" : ""}: ${brl(i.valor)}`);
  return `*Orçamento nº ${o.id}*${o.celebracao ? " · " + o.celebracao : ""}${o.empresa ? " · " + o.empresa : ""}\n` +
    linhas.join("\n") +
    (o.data_evento ? `\n📅 ${o.data_evento}` : "") +
    `\n💰 Total da proposta: *${brl(o.total)}*`;
}

/* Rótulo curto para o botão de escolha (até ~20 caracteres no WhatsApp). */
function rotuloBotao(o) {
  const serv = (o.itens || []).map(i => i.servico).join(", ");
  return `Nº ${o.id} · ${serv}`.slice(0, 20);
}

module.exports = { clienteQuerFechar, soFechado, numeroDoOrcamento, resumoOrcamento, rotuloBotao, brl };
