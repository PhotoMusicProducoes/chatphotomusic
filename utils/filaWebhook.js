// utils/filaWebhook.js — Em qual fila cada mensagem do webhook entra
//
// 🚨 O CASO QUE ORIGINOU ISTO (Mario, 07/09/2026)
// A cliente pediu mais detalhes, viu o preço, disse que estava fora do
// orçamento dela, e o bot continuou despejando arquivo. O Mario tentou
// "pausarespecial" e "resetar" e nada aconteceu: os comandos só surtiram
// efeito DEPOIS que o envio inteiro terminou.
//
// O motivo não era o comando, era a FILA. Existe uma fila por número, para
// duas mensagens do mesmo cliente nunca serem processadas ao mesmo tempo
// (senão "7" e "1" digitados rápido se atropelam). A chave dessa fila era
// sempre `payload.phone`.
//
// Só que o Mario opera digitando DENTRO do chat do cliente, pela própria linha
// do bot. Nesse caso a Z-API manda `fromMe: true` e `phone` = número do
// CLIENTE. Ou seja: o comando dele entrava na MESMA fila do envio em
// andamento e ficava esperando o envio acabar para só então mandar parar.
// Quanto mais mensagens faltavam, mais tempo o comando ficava preso.
//
// Agora o que vem da linha do operador tem fila própria e roda em paralelo,
// que é o único jeito de "parar" significar parar AGORA.

/** Fila em que a mensagem deve entrar. Operador nunca espera cliente. */
function escolherChaveFila(payload) {
  const p = payload || {};

  // fromMe = escrito pela própria linha do bot, ou seja, pelo operador.
  // 🚨 Cliente nenhum consegue mandar fromMe, então não há risco de um
  // cliente furar a fila dele por aqui.
  if (p.fromMe === true) {
    // Uma fila só para o operador: os comandos dele continuam em ordem entre
    // si (dois "pausar" seguidos não se atropelam), mas nunca ficam presos
    // atrás do atendimento de um cliente.
    return `operador:${p.connectedPhone || "linha"}`;
  }

  return p.phone || p.from || "desconhecido";
}

module.exports = { escolherChaveFila };
