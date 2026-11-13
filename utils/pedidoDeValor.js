// utils/pedidoDeValor.js - "só quero saber o valor" e "não sei ainda" no meio do orçamento (13/11/2026, RJN)
//
// Caso real 13/11 01h31 (Aniversário Adolescente): o bot perguntou "Quantos convidados?",
// o cliente respondeu "Só quero saber o valor" (2x) e "Não sei ainda", recebeu 3x
// "Digite apenas números válidos" e foi embora. Pedir o preço e não saber um dado NÃO
// são respostas inválidas: o bot entrega o preliminar na hora e continua depois.

function normalizar(texto) {
  return String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ?]+/g, " ").replace(/\s+/g, " ").trim();
}

/* Pedido explícito de preço. */
function clientePedeValor(texto) {
  const t = normalizar(texto);
  if (!t || t.length > 120) return false;
  return /\b(so|apenas|somente|soh) (quero|queria|gostaria de) (saber|ver|ter) (o |os )?(valor|valores|preco|precos|orcamento)\b/.test(t)
      || /\b(quero|queria|gostaria de) (so |apenas )?(saber|ver) (o |os )?(valor|valores|preco|precos)\b/.test(t)
      || /\bquanto (custa|fica|sai|e|seria|vai ficar|ficaria)\b/.test(t)
      || /\b(qual|quais) (e |eh |seria |sao )?(o |os )?(valor|valores|preco|precos)\b/.test(t)
      || /\b(me )?(passa|manda|envia|fala|diz) (o |os )?(valor|valores|preco|precos|orcamento)\b/.test(t)
      || /^(valor|valores|preco|precos)\b/.test(t)
      || /\bcade o (valor|preco|orcamento)\b/.test(t);
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

module.exports = { clientePedeValor, clienteNaoSabe };
