// utils/webhookPayload.js — Leitura do payload do webhook da Z-API
//
// Quando o cliente CLICA numa opção, a Z-API não manda `text.message`. Manda:
//   lista  -> listResponseMessage.selectedRowId   ("1")
//   botão  -> buttonsResponseMessage.buttonId     ("1")
// contendo o MESMO id que enviamos. Como usamos os próprios números do menu
// como id, devolver esse id como se fosse o texto digitado faz o clique e a
// digitação entrarem pelo mesmo caminho — e nenhum passo do index.js precisa
// saber que existe botão.

/**
 * Extrai a resposta de um clique em lista/botão.
 * @param {object} payload - corpo do webhook da Z-API
 * @returns {string|null} o id clicado, ou null se for mensagem comum
 */
function extrairRespostaDeClique(payload) {
  if (!payload || typeof payload !== "object") return null;

  const candidatos = [
    payload.listResponseMessage?.selectedRowId,
    payload.buttonsResponseMessage?.buttonId
  ];

  for (const c of candidatos) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s !== "") return s;
  }

  return null;
}

module.exports = { extrairRespostaDeClique };
