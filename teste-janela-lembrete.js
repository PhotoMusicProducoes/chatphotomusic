// teste-janela-lembrete.js — Banco de medição da janela de envio do lembrete
//
// Caso real (04/09/2026, cliente 21 97988-5023): ela escreveu "oi boa noite" e
// "qual valor" às 19:56. A régua é 30min = empurrão e 1h = todos os orçamentos,
// ou seja 20:26 e 20:56 — os dois dentro da faixa que era bloqueada (a janela
// ia até 19h59). Ela só receberia tudo às 7h do dia seguinte.
// Decisão do Mario em 04/09/2026: esticar a janela até 22h.
// Decisão do Mario em 05/09/2026: o começo saiu das 7h para as 10h, em TODOS
// os envios automáticos. Às 7h a mensagem chega antes de a pessoa estar
// olhando o celular e some no meio das notificações da manhã.
//
// Rodar:  node teste-janela-lembrete.js

const { dentroDaJanela, JANELA_INICIO, JANELA_FIM } =
  require("./jobs/lembreteOrcamento.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function hora(h, esperado, nota) {
  const r = dentroDaJanela(h);
  const rotulo = `${String(h).padStart(2, "0")}h ${esperado ? "ENVIA" : "não envia"}${nota ? " (" + nota + ")" : ""}`;
  checar(rotulo, r === esperado, String(r));
}

console.log("\n— O CASO REAL —");
hora(20, true, "empurrão das 20:26 da cliente das 19:56");
hora(21, true, "orçamentos que venceram 20:56, no ciclo seguinte");

console.log("\n— AS BORDAS —");
hora(6,  false, "madrugada");
hora(7,  false, "era a primeira hora permitida até 05/09");
hora(9,  false, "véspera do corte da manhã");
hora(10, true,  "primeira hora permitida");
hora(19, true);
hora(21, true,  "última hora permitida");
hora(22, false, "corte da noite");
hora(23, false);
hora(0,  false, "meia-noite");
hora(3,  false);

console.log("\n— O DIA INTEIRO, HORA A HORA —");
for (let h = 0; h < 24; h++) {
  const esperado = h >= JANELA_INICIO && h < JANELA_FIM;
  const r = dentroDaJanela(h);
  if (r !== esperado) { console.log(`❌ ${h}h deu ${r}`); falhas++; }
}
console.log(`✅ 24 horas conferidas contra a faixa ${JANELA_INICIO}h–${JANELA_FIM - 1}h59`);

console.log("\n— NINGUÉM RECEBE FORA DA FAIXA —");
const fora = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 22, 23];
checar(
  "nenhuma hora de 22h às 9h59 envia",
  fora.every(h => dentroDaJanela(h) === false),
  fora.filter(h => dentroDaJanela(h)).join(",")
);
checar(
  "a faixa tem 12 horas (10h às 21h)",
  Array.from({ length: 24 }, (_, h) => h).filter(h => dentroDaJanela(h)).length === 12,
  String(Array.from({ length: 24 }, (_, h) => h).filter(h => dentroDaJanela(h)).length)
);

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
