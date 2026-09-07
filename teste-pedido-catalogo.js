// teste-pedido-catalogo.js — Banco de medição do pedido feito pelo CATÁLOGO
//
// Caso real (07/09/2026): a cliente abriu o catálogo do WhatsApp, marcou DOIS
// serviços e enviou o pedido. O bot ficou MUDO.
//
// 🚨 A causa: pedido do catálogo não tem `text.message`. A Z-API manda um bloco
// `order` (carrinho) ou `product` (um produto só). O server.js montava o corpo
// da mensagem apenas com `text.message`, então chegava string vazia e não havia
// o que reconhecer. Cliente que JÁ escolheu o que quer é o pior de todos para
// se perder, então este teste existe para a regressão nunca voltar calada.
//
// Rodar:  node teste-pedido-catalogo.js

const { extrairPedidoDeCatalogo } = require("./utils/webhookPayload.js");
const { servicosDoPedidoCatalogo } = require("./index.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
const mesmos = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ======================================================
// O CASO REAL: dois serviços marcados no catálogo
// ======================================================
// Formato conforme a documentação da Z-API (Exemplos de retorno).
const pedidoDeDoisServicos = {
  phone: "5521999999999",
  order: {
    itemCount: 2,
    orderId: "422508169684569",
    orderTitle: "PhotoMusic Produções",
    currency: "BRL",
    total: 399400,
    products: [
      { quantity: 1, name: "FOTO CABINE PHOTOMUSIC", productId: "533892469", retailerId: "", price: 249700, currencyCode: "BRL" },
      { quantity: 1, name: "PLATAFORMA 360° PHOTOMUSIC", productId: "533892470", retailerId: "", price: 149700, currencyCode: "BRL" }
    ]
  }
};

console.log("\n— O CASO REAL: dois serviços marcados no catálogo —");
const p1 = extrairPedidoDeCatalogo(pedidoDeDoisServicos);
checar("o pedido é reconhecido (não é mais mensagem vazia)", !!p1, "voltou null");
checar("vira texto com os dois nomes",
  !!p1 && /cabine/i.test(p1.texto) && /360/.test(p1.texto), String(p1 && p1.texto));
checar("resolve Foto Cabine (1) e Plataforma 360 (3)",
  mesmos(servicosDoPedidoCatalogo(p1), [1, 3]),
  JSON.stringify(servicosDoPedidoCatalogo(p1)));

// ======================================================
// SKU preenchido no catálogo: a via robusta
// ======================================================
console.log("\n— SKU com o slug do serviço manda mais que o nome —");
const porSku = extrairPedidoDeCatalogo({
  order: { products: [
    { name: "Nome trocado pelo Mario sem avisar ninguém", retailerId: "totem-retro", quantity: 1 },
    { name: "Outro nome qualquer", retailerId: "PM_SOM_DJ", quantity: 1 }
  ] }
});
checar("nome irreconhecível + SKU certo ainda resolve (13 e 7)",
  mesmos(servicosDoPedidoCatalogo(porSku), [13, 7]),
  JSON.stringify(servicosDoPedidoCatalogo(porSku)));

console.log("\n— SKU com o número do MENU (0 a 8) —");
const porNumero = extrairPedidoDeCatalogo({
  order: { products: [{ name: "produto sem nome de serviço", retailerId: "1", quantity: 1 }] }
});
checar("SKU 1 = Totem Retrô no menu do bot (id interno 13)",
  mesmos(servicosDoPedidoCatalogo(porNumero), [13]),
  JSON.stringify(servicosDoPedidoCatalogo(porNumero)));

// 🚨 O SKU numérico é a ÚLTIMA tentativa de propósito: o WhatsApp preenche
// esse campo sozinho em alguns catálogos, e um "1" solto virando Totem Retrô
// calado seria pior do que não reconhecer. O nome tem que ganhar dele.
const nomeGanhaDoNumero = extrairPedidoDeCatalogo({
  order: { products: [{ name: "FOTO CABINE PHOTOMUSIC", retailerId: "3", quantity: 1 }] }
});
checar("nome reconhecido GANHA do SKU numérico (Cabine, não Plataforma)",
  mesmos(servicosDoPedidoCatalogo(nomeGanhaDoNumero), [1]),
  JSON.stringify(servicosDoPedidoCatalogo(nomeGanhaDoNumero)));

// ======================================================
// "Consultar produto": um produto só, sem carrinho
// ======================================================
console.log("\n— Um produto só (o cliente usou Consultar produto) —");
const umProduto = extrairPedidoDeCatalogo({
  product: { title: "TOTEM RETRÔ PHOTOMUSIC", productId: "999", price: 249700, currencyCode: "BRL" }
});
checar("produto único também é reconhecido", !!umProduto, "voltou null");
checar("resolve o Totem Retrô (13), não o Totem Fotográfico (2)",
  mesmos(servicosDoPedidoCatalogo(umProduto), [13]),
  JSON.stringify(servicosDoPedidoCatalogo(umProduto)));

// ======================================================
// O QUE NÃO PODE ACONTECER
// ======================================================
console.log("\n— Mensagem comum não pode virar pedido —");
checar("texto normal devolve null",
  extrairPedidoDeCatalogo({ phone: "552199", text: { message: "oi, bom dia" } }) === null,
  "achou pedido onde não tem");
checar("payload vazio devolve null", extrairPedidoDeCatalogo({}) === null, "não devolveu null");
checar("null devolve null", extrairPedidoDeCatalogo(null) === null, "não devolveu null");

console.log("\n— Produto que não é serviço não pode virar serviço chutado —");
const desconhecido = extrairPedidoDeCatalogo({
  order: { products: [{ name: "Camisa da PhotoMusic tamanho M", retailerId: "", quantity: 1 }] }
});
checar("produto desconhecido é reconhecido como pedido", !!desconhecido, "voltou null");
checar("mas NÃO vira serviço nenhum (quem trata é o operador)",
  mesmos(servicosDoPedidoCatalogo(desconhecido), []),
  JSON.stringify(servicosDoPedidoCatalogo(desconhecido)));

console.log("\n— O recado escrito junto do pedido não pode se perder —");
const comRecado = extrairPedidoDeCatalogo({
  order: { message: "é para o dia 20/12, na Ilha", products: [{ name: "FOTO CABINE", quantity: 1 }] }
});
checar("o recado do cliente vem junto",
  comRecado.observacao === "é para o dia 20/12, na Ilha", String(comRecado.observacao));

console.log(`\n${falhas === 0 ? "🎉 Tudo certo." : `🚨 ${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
