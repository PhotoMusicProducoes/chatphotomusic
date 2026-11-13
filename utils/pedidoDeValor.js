// utils/pedidoDeValor.js - "só quero saber o valor" e "não sei ainda" no meio do orçamento (13/11/2026, RJN)
//
// Caso real 13/11 01h31 (Aniversário Adolescente): o bot perguntou "Quantos convidados?",
// o cliente respondeu "Só quero saber o valor" (2x) e "Não sei ainda", recebeu 3x
// "Digite apenas números válidos" e foi embora. Pedir o preço e não saber um dado NÃO
// são respostas inválidas: o bot entrega o preliminar na hora e continua depois.
//
// 13/11/2026 (ChatGPT, pesquisa com consumidores): quem pergunta preço quer saber
// primeiro se CABE NO BOLSO. O reconhecimento passou a ser por INTENÇÃO (uma mensagem
// pode ter várias): preço imediato, preço aproximado, comparação de pacotes, condições
// de pagamento e dado ainda não definido. Os valores continuam vindo só do PhotoMusic Pro.

function normalizar(texto) {
  return String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ?]+/g, " ").replace(/\s+/g, " ").trim();
}

// abreviações comuns no WhatsApp
function expandir(t) {
  return (" " + t + " ")
    .replace(/ (qto|qnto|qt|qnt|quant) /g, " quanto ")
    .replace(/ (pfv|pf|pfvr|plmds) /g, " por favor ")
    .replace(/ vlr /g, " valor ")
    .trim();
}

const PALAVRA_PRECO = "(valor|valores|preco|precos|orcamento|orcamentos|tabela|tabela de precos)";

/* As intenções de uma mensagem (pode ter mais de uma). */
function intencoesDePreco(texto) {
  const t = expandir(normalizar(texto));
  const i = new Set();
  if (!t || t.length > 160) return i;

  // preço imediato
  if (new RegExp(`\\b(so|apenas|somente|soh)\\b[^?]{0,25}\\b(quero|queria|gostaria de|preciso)\\b[^?]{0,15}\\b${PALAVRA_PRECO}\\b`).test(t)
   || new RegExp(`\\b(quero|queria|gostaria de|preciso)( so| apenas)? (saber|ver|ter|o|os|a)( o| os| a)? ${PALAVRA_PRECO}\\b`).test(t)
   || /\bquanto (custa|custam|fica|ficam|sai|saem|e|eh|seria|vai ficar|ficaria|cobra|cobram|voces cobram|esta|ta)\b/.test(t)
   || /\bquanto\b ?\??$/.test(t)
   || new RegExp(`\\b(qual|quais) (e |eh |seria |sao |o |os |a )*${PALAVRA_PRECO}\\b`).test(t)
   || new RegExp(`\\b(me )?(passa|passe|manda|mande|envia|envie|fala|diz|informa)( pra mim| para mim)?( o| os| a)? ${PALAVRA_PRECO}\\b`).test(t)
   || new RegExp(`^${PALAVRA_PRECO}( d[oa]s? [a-z0-9 ]{1,30})?( por favor)? ?\\??$`).test(t)            // "Valor?", "Preço por favor", "Valor do 360?"
   || new RegExp(`\\bcade o ${PALAVRA_PRECO}\\b`).test(t)
   || new RegExp(`\\b${PALAVRA_PRECO} d[oa]s? (cabine|totem|360|plataforma|dj|som|paparazzi|lembranca|guestbook|retro|foto)`).test(t))
    i.add("preco_imediato");

  // preço aproximado
  if (/\b(tem|tem uma|teria|tem algum|existe) (uma )?(base|media|ideia|nocao|estimativa)\b/.test(t)
   || /\bem media\b/.test(t) || /\b(a partir de|apartir de) quanto\b/.test(t)
   || /\bmais ou menos quanto\b/.test(t) || /\b(uma )?ideia de (valor|preco)\b/.test(t))
    i.add("preco_aproximado");

  // comparação de pacotes
  if (/\b(qual|quais) (e |eh )?(o |os )?(mais barato|mais em conta|mais economico|menor valor|menor preco)\b/.test(t)
   || /\b(mais barato|mais em conta)\b[^?]{0,20}\?/.test(t)
   || /\bdiferenca (de|do|entre) (valor|preco|pacote)/.test(t))
    i.add("comparacao_pacotes");

  // condições de pagamento (só quando é pergunta sobre pagar)
  if (/\b(parcela|parcelam|parcelado|parcelar|em quantas vezes|quantas vezes|aceita (cartao|pix)|tem desconto|desconto no pix|forma de pagamento|formas de pagamento)\b/.test(t))
    i.add("condicoes_pagamento");

  if (clienteNaoSabe(texto) || /\bnao sei( ainda)?\b/.test(t)) i.add("dado_nao_definido");
  return i;
}

/* Pedido de preço (qualquer das intenções de valor). */
function clientePedeValor(texto) {
  const i = intencoesDePreco(texto);
  return i.has("preco_imediato") || i.has("preco_aproximado") || i.has("comparacao_pacotes") || i.has("condicoes_pagamento");
}

/* "Não sei" = dado DESCONHECIDO, não resposta inválida. */
function clienteNaoSabe(texto) {
  const t = normalizar(texto);
  if (!t || t.length > 80) return false;
  return /^(ainda )?nao sei( ainda)?\b/.test(t)
      || /\bnao (sei|faco ideia|tenho ideia)( ainda)?$/.test(t)
      || /\b(ainda )?nao (defini|decidi|definimos|decidimos|sei dizer|tenho (essa|esta|a) informacao|tenho certeza)\b/.test(t)
      || /\b(nao|sem) (tenho )?(definido|definicao|certeza)\b/.test(t)
      || /^(sei la|nem sei|depende|talvez|nao tenho)\b/.test(t);
}

/* Número de convidados que veio junto com o pedido de preço ("150 pessoas, quanto fica?"). */
function convidadosNaMensagem(texto) {
  const t = normalizar(texto);
  const m = t.match(/\b(\d{2,4})\s*(convidados|pessoas|pax|convidado)?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 10 && n <= 3000 && (m[2] || /^\d{2,4}\b/.test(t)) ? n : null;
}

module.exports = { clientePedeValor, clienteNaoSabe, intencoesDePreco, convidadosNaMensagem };
