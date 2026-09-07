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

/* ======================================================
   PEDIDO FEITO PELO CATÁLOGO DO WHATSAPP (2026-09-07)
   ======================================================
   O cliente que marca produtos no catálogo e envia NÃO manda texto: a Z-API
   entrega um bloco `order` (carrinho) ou `product` (um produto só, no
   "Consultar produto"). Como o server.js montava o corpo apenas de
   `text.message`, a mensagem chegava VAZIA e o bot ficava mudo — foi o que
   aconteceu com a cliente que pediu 2 serviços em 07/09/2026.

   Aqui o pedido vira TEXTO com os nomes dos produtos, que é exatamente o que
   `detectarServicosNoTexto()` já sabe ler. O `retailerId` (o SKU que o Mario
   preenche no catálogo) vem junto porque casar por CÓDIGO é mais seguro do
   que casar por nome: renomear um produto no catálogo não pode quebrar o bot.

   Formato da Z-API (developer.z-api.io, "Exemplos de retorno"):
     order:   { orderTitle, total, products: [{ name, retailerId, quantity }] }
     product: { title, productId, retailerId, price }
*/

/**
 * Extrai um pedido do catálogo do WhatsApp.
 * @param {object} payload - corpo do webhook da Z-API
 * @returns {{itens: Array<{nome: string, sku: string, quantidade: number}>,
 *            texto: string, observacao: string, origem: "pedido"|"produto"}|null}
 *          null quando a mensagem não é de catálogo.
 */
function extrairPedidoDeCatalogo(payload) {
  if (!payload || typeof payload !== "object") return null;

  const itens = [];

  const push = (nome, sku, quantidade) => {
    const n = String(nome ?? "").trim();
    const s = String(sku ?? "").trim();
    if (!n && !s) return;                       // item sem nome E sem código não serve
    const q = Number(quantidade);
    itens.push({ nome: n, sku: s, quantidade: Number.isFinite(q) && q > 0 ? q : 1 });
  };

  // Carrinho: o cliente marcou um ou mais produtos e enviou o pedido.
  const produtos = payload.order?.products;
  if (Array.isArray(produtos)) {
    for (const p of produtos) push(p?.name, p?.retailerId, p?.quantity);
  }

  // Produto único: não vem em `order`, vem em `product` (título em `title`).
  if (!itens.length && payload.product) {
    push(payload.product.title, payload.product.retailerId, 1);
  }

  if (!itens.length) return null;

  return {
    itens,
    // Os nomes viram uma frase só: é o texto que o detector de serviços lê.
    texto: itens.map(i => i.nome).filter(Boolean).join(", "),
    // O WhatsApp deixa o cliente escrever junto do pedido. Não pode se perder.
    observacao: String(payload.order?.message || "").trim(),
    origem: payload.order ? "pedido" : "produto"
  };
}

module.exports = { extrairRespostaDeClique, extrairPedidoDeCatalogo };
