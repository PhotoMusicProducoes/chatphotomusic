// utils/identidadeRapha.js - IDENTIDADE DO RAPHA no WhatsApp (13/11/2026, NAZ; pedido do Mario e do ChatGPT)
//
// O Rapha e o personagem oficial da PhotoMusic (robo azul, branco e preto, com camera na cabeca) que o cliente
// tambem encontra na festa, nos equipamentos. No WhatsApp ele se apresenta pelo nome, deixa claro que e um
// ASSISTENTE VIRTUAL e se apresenta UMA VEZ por atendimento. A apresentacao nunca cria etapa nem confirmacao:
// quem ja pediu algo na 1a mensagem recebe a apresentacao curta e o atendimento na mesma hora.
// 🤖 Fonte unica: quando a IA entrar, ela usa NOME/FUNCAO/APRESENTACAO daqui (nao reescrever em outro lugar).
// 🚨 A marca do atendimento continua sendo PhotoMusic Produções (nada de "Rapha Lumen" para o cliente).

const NOME = "Rapha";
const FUNCAO = "assistente virtual da PhotoMusic Produções";

/** Apresentacao completa (abre o menu de boas-vindas). */
const APRESENTACAO =
  "Olá! 😊 Eu sou o *Rapha* 🤖📸, assistente virtual da PhotoMusic Produções!\n\n" +
  "Estou aqui para ajudar você com nossos serviços, orçamentos e contratações. " +
  "E, se precisar, posso encaminhar seu atendimento para nossa equipe!";

/** Apresentacao curta (quem ja pediu algo: vem antes do atendimento, na mesma mensagem). */
const APRESENTACAO_CURTA = "Eu sou o *Rapha* 🤖📸, assistente virtual da PhotoMusic Produções!";

/**
 * Prefixo de apresentacao para a 1a mensagem do bot nesta conversa. Marca a sessao e, a partir dai,
 * devolve "" (nunca repete). `curta`: so o nome e a funcao, para nao atrasar quem ja pediu algo.
 */
function prefixoApresentacao(session, curta = true) {
  if (!session || session.raphaApresentado) return "";
  session.raphaApresentado = true;
  return (curta ? APRESENTACAO_CURTA : APRESENTACAO) + "\n\n";
}

module.exports = { NOME, FUNCAO, APRESENTACAO, APRESENTACAO_CURTA, prefixoApresentacao };
