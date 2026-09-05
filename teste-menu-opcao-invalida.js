// teste-menu-opcao-invalida.js — Banco de medição do aviso de opção inválida
//
// Caso real (04/09/2026, cliente 21 97988-5023): ela mandou "oi boa noite" e
// "qual valor" antes de o bot responder. Como o bot responde uma mensagem por
// vez, ela recebeu o MESMO menu de boas-vindas duas vezes seguidas. Repetir a
// mesma mensagem não avisa nada: o certo é dizer que não entendeu e dizer o
// que digitar, como nas outras respostas inválidas do fluxo.
//
// ⚠️ O que este banco cobre: o TEXTO do aviso (conteúdo e o fato de não ser o
// menu). Quem decide mandar o aviso em vez do menu é o passo aguardando_opcao,
// que depende do webhook e não roda aqui.
//
// Rodar:  node teste-menu-opcao-invalida.js

const { avisoOpcaoInvalidaMenu, LABELS_MENU } = require("./index.js");

const aviso = avisoOpcaoInvalidaMenu();

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— NÃO PODE SER O MENU DE NOVO (o defeito) —");
checar("o aviso NÃO repete as boas-vindas",
  !/bem-vindo/i.test(aviso), aviso.slice(0, 60));
checar("o aviso NÃO repete a prova social do Google",
  !/avalia[cç][oõ]es|google/i.test(aviso), aviso.slice(0, 60));

console.log("\n— PRECISA DIZER O QUE FAZER —");
// Texto definido pelo Mario em 04/09/2026, no mesmo padrão dos outros avisos
// de opção inválida do fluxo.
checar("avisa que a opção é inválida", /op[cç][aã]o inv[aá]lida/i.test(aviso), aviso);
checar("manda digitar somente o número", /digite somente o n[uú]mero/i.test(aviso), aviso);

console.log("\n— PRECISA LISTAR TODAS AS OPÇÕES —");
for (const [num, rotulo] of Object.entries(LABELS_MENU)) {
  checar(`opção ${num} está na lista (${rotulo})`, aviso.includes(`*${num}* - ${rotulo}`), aviso);
}
checar("a lista tem exatamente as opções do menu",
  aviso.split("\n").filter(l => /^\*\d\* - /.test(l)).length === Object.keys(LABELS_MENU).length,
  String(aviso.split("\n").filter(l => /^\*\d\* - /.test(l)).length));

console.log("\n— TAMANHO: o WhatsApp corta com 'Ler mais' e esconde as opções —");
checar(`aviso com ${aviso.length} caracteres (limite prático 600)`, aviso.length <= 600, String(aviso.length));

console.log("\n— COMO O CLIENTE VAI VER —\n");
console.log(aviso.replace(/^/gm, "   "));

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
