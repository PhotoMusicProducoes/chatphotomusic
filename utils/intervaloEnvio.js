// utils/intervaloEnvio.js — Intervalo entre mensagens dos envios automáticos
//
// 🚨 FONTE ÚNICA. A conta estava copiada à mão em QUATRO lugares (lembrete de
// orçamento, follow-up de leads e os dois laços das comemorações). Copia à mão
// envelhece em lugares diferentes: quem mexesse num só deixava os outros com o
// ritmo antigo, e ninguém perceberia até a Meta restringir o número.
//
// Ritmo escolhido pelo Mario em 05/09/2026: de 30 a 90 segundos entre uma
// mensagem e outra, sorteado a cada envio. Era de 5 a 15 segundos.
// O sorteio é de propósito: cadência fixa é o que denuncia robô. E a PRIMEIRA
// mensagem do ciclo sai quase na hora, porque uma mensagem sozinha não é
// disparo em massa e não faz sentido o cliente esperar.
//
// 📌 Isto vale para o envio em MASSA (uma mensagem para cada pessoa de uma
// lista). A conversa com UM cliente (os vários serviços de um orçamento, por
// exemplo) tem o ritmo dela no index.js: ali as mensagens são a mesma conversa
// e espaçar 90 segundos deixaria o cliente esperando sem motivo.

const ESPERA_PRIMEIRO_MS = 3_000;    // 3s: a primeira do ciclo praticamente sai
const ESPERA_MIN_MS      = 30_000;   // 30s
const ESPERA_MAX_MS      = 90_000;   // 90s

/**
 * Quanto esperar DEPOIS de enviar a mensagem de índice `idxEnvio` do ciclo.
 * @param {number} idxEnvio - 1 para a primeira mensagem do ciclo, 2, 3...
 * @param {function} [sorteio] - só para o banco de medição; devolve 0..1.
 * @returns {number} milissegundos
 */
function esperaEntreEnvios(idxEnvio, sorteio = Math.random) {
  if (idxEnvio <= 1) return ESPERA_PRIMEIRO_MS;
  const faixa = ESPERA_MAX_MS - ESPERA_MIN_MS;
  const bruto = ESPERA_MIN_MS + Math.floor(sorteio() * (faixa + 1));
  // Math.random() nunca devolve 1 exato, mas um sorteio injetado devolve, e
  // aí a conta estourava o teto em 1ms. Quem pegou foi o banco de medicao.
  return Math.min(bruto, ESPERA_MAX_MS);
}

module.exports = {
  esperaEntreEnvios,
  ESPERA_PRIMEIRO_MS,
  ESPERA_MIN_MS,
  ESPERA_MAX_MS
};
