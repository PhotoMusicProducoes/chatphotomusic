// teste-janela-lembrete.js — Banco de medição da janela de envio do lembrete
//
// Caso real (04/09/2026, cliente 21 97988-5023): ela escreveu "oi boa noite" e
// "qual valor" às 19:56. A régua é 30min = empurrão e 1h = todos os orçamentos,
// ou seja 20:26 e 20:56 — os dois dentro da faixa que era bloqueada (a janela
// ia até 19h59). Ela só receberia tudo às 7h do dia seguinte.
// Decisão do Mario em 04/09/2026: esticar a janela até 22h.
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
hora(7,  true,  "primeira hora permitida");
hora(19, true);
hora(21, true,  "última hora permitida");
hora(22, false, "corte");
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

console.log("\n— NINGUÉM RECEBE DE MADRUGADA (o que a janela existe para impedir) —");
const madrugada = [0, 1, 2, 3, 4, 5, 6, 22, 23];
checar(
  "nenhuma hora de 22h às 6h59 envia",
  madrugada.every(h => dentroDaJanela(h) === false),
  madrugada.filter(h => dentroDaJanela(h)).join(",")
);

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
