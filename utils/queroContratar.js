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
  if (/\bnao\b[^.!?]*\b(contrat|fechar|seguir com|aprovar|reservar)/.test(t)) return false;
  return /\bquero seguir com o orcamento\b/.test(t)                                     // botão do PDF
      || /\b(quero|vou|vamos|gostaria de|desejo|podemos|pode)\b[^.!?]{0,30}\b(fechar|aprovar)\b/.test(t)   // "quero fechar esta proposta", "quero fechar os 2 serviços"
      || /\b(fechar|aprovar) (esta|essa|a|o|nossa) (proposta|orcamento)\b/.test(t)
      || /\b(quero|vou|vamos|gostaria de|desejo)\b[^.!?]{0,20}\bcontrat(ar|o)\b/.test(t)    // "quero contratar", "gostaria de contratar a cabine"
      || /^contrat(ar|o)\b/.test(t)
      || /\b(quero|pode|podemos|vamos) (garantir|reservar) a (minha |nossa )?data\b/.test(t);
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

module.exports = { clienteQuerFechar, numeroDoOrcamento, resumoOrcamento, rotuloBotao, brl };
