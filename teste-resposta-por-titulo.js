// teste-resposta-por-titulo.js - O cliente responde com o TÍTULO da opção
//
// Caso real (cliente Helena, 15/09/2026): ela respondeu "Solicitar um
// orçamento" e depois "Quero outra opção". O bot só sabia ler dígito, então as
// duas viraram string vazia: ela recebeu "Opção inválida" tendo dito
// exatamente o que queria, e acabou parando em "Estou em processo de
// contratação", que pausa o atendimento.
//
// Rodar:  node teste-resposta-por-titulo.js

const { opcaoPorTitulo, LABELS_MENU, ROTULOS_CONFIRMACAO } = require("./index.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function menu(texto, esperado, rotulo) {
  const r = opcaoPorTitulo(texto, LABELS_MENU);
  checar(rotulo || `"${texto}"`, r === esperado, `veio ${JSON.stringify(r)}`);
}
function confirma(texto, esperado, rotulo) {
  const r = opcaoPorTitulo(texto, ROTULOS_CONFIRMACAO);
  checar(rotulo || `"${texto}"`, r === esperado, `veio ${JSON.stringify(r)}`);
}

console.log("\n— O CASO HELENA —");
menu("Solicitar um orçamento", "1", '🚨 "Solicitar um orçamento" = opção 1');
confirma("Quero outra opção", "2", '🚨 "Quero outra opção" = opção 2');

console.log("\n— TODA OPÇÃO DO MENU RESPONDE PELO TÍTULO —");
for (const id of Object.keys(LABELS_MENU)) {
  menu(LABELS_MENU[id], id);
}

console.log("\n— COMO A PESSOA REALMENTE DIGITA —");
menu("solicitar um orcamento", "1", "sem acento e em minúscula");
menu("SOLICITAR UM ORÇAMENTO", "1", "em caixa alta");
menu("  Solicitar um orçamento  ", "1", "com espaço sobrando");
menu("*Solicitar um orçamento*", "1", "com asterisco do negrito do WhatsApp");
menu("1 - Solicitar um orçamento", "1", "copiou a linha inteira do menu");
menu("Solicitar um orçamento!", "1", "com pontuação no fim");
confirma("sim, e isso", "1", "sem acento");
confirma("Sim, é isso", "1");

console.log("\n— O QUE NÃO PODE VIRAR OPÇÃO —");
menu("", null, "mensagem vazia");
menu("Olá", null, '"Olá" não é opção nenhuma');
menu("Orçamento para 3h", null, "frase parecida NÃO é o título exato");
menu("quero um orçamento da cabine", null, "isso é trabalho do detector, não daqui");
confirma("talvez", null, "resposta solta na confirmação");
confirma("Solicitar um orçamento", null, "título do MENU não vale na confirmação");

console.log("\n— MENSAGEM COM O MENU CITADO NÃO VIRA OPÇÃO —");
const menuCitado =
  "Olá! Seja bem-vindo(a) à PhotoMusic Produções!\n\n" +
  Object.keys(LABELS_MENU).map(k => `${k} - ${LABELS_MENU[k]}`).join("\n");
menu(menuCitado, null, "o menu inteiro citado não escolhe nada sozinho");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
