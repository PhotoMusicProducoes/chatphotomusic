// teste-antiloop-menu.js — Banco de medicao do ANTI-LOOP
//
// Reproduz o caso real do cliente 21 96868-4218 (01/09/2026): ele respondeu
// "2" (Nao) para detalhes, e-mail e nascimento, clicou em "Corrigir algo"
// (o botao chega como "2") e escolheu o item "2 - Convidados". Cinco "2"
// iguais em menos de 1 minuto. O anti-loop pausava o numero e o bot ficava
// mudo com o orcamento ja pronto para sair.
//
// Rodar:  node teste-antiloop-menu.js

const { registrarMensagemAntiLoop } = require("./index.js");

let falhas = 0;
function checar(nome, condicao) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}`);
  if (!condicao) falhas++;
}

// ------------------------------------------------------
// 1) O CASO REAL — cinco respostas de menu nao podem pausar
// ------------------------------------------------------
const cliente = "5521968684218";
const respostas = ["2", "2", "2", "2", "2"];
let bloqueouCliente = false;
respostas.forEach(r => {
  if (registrarMensagemAntiLoop(cliente, r).bloquear) bloqueouCliente = true;
});
checar("cliente respondendo 5x '2' no menu NAO e pausado", !bloqueouCliente);

// Numero de 2 digitos e lista com virgula tambem sao menu nosso
const cliente2 = "5521999990000";
let bloqueouLista = false;
["10", "10", "3,4", "3,4", "3,4", "3,4", "3,4"].forEach(r => {
  if (registrarMensagemAntiLoop(cliente2, r).bloquear) bloqueouLista = true;
});
checar("respostas '10' e '3,4' NAO pausam", !bloqueouLista);

// ------------------------------------------------------
// 2) A PROTECAO CONTINUA DE PE — robo repetindo o menu inteiro
// ------------------------------------------------------
const robo = "552133334444";
const menuDoOutroBot =
  "Ola! Sou o atendimento virtual. Digite 1 para segunda via, 2 para falar com atendente.";
let vereditoRobo = { bloquear: false };
for (let i = 0; i < 5; i++) {
  vereditoRobo = registrarMensagemAntiLoop(robo, menuDoOutroBot);
}
checar("robo repetindo o mesmo texto 5x AINDA e pausado", vereditoRobo.bloquear);

// Texto de gente, variado, nao pausa
const gente = "552155556666";
let bloqueouGente = false;
["boa tarde", "quero orcamento", "para dia 19/11", "quantas horas?", "obrigado"]
  .forEach(t => { if (registrarMensagemAntiLoop(gente, t).bloquear) bloqueouGente = true; });
checar("cliente com texto variado NAO e pausado", !bloqueouGente);

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
