// teste-hora-minima-comemoracoes.js — Banco de medição da hora mínima
//
// Em 05/09/2026 o Mario mandou tirar TODOS os envios automáticos das 7h e
// passar para 10h. Os outros jobs mudaram no deploy, porque a hora deles mora
// no código. As comemorações não: a hora vinha de
// wp-content/dados/comemoracoes-config.json, no servidor do WordPress, e o
// deploy subiu com o log dizendo "⏰ Agendado para: 0 7 * * *".
//
// Eu tinha empurrado a troca do arquivo para o Mario. Errado: a regra é do
// NEGÓCIO e tem que valer sozinha. O arquivo do servidor continua escolhendo o
// horário (10h, 11h, 14h, sem deploy), mas não consegue mais marcar antes das
// 10h.
//
// Rodar:  node teste-hora-minima-comemoracoes.js

const { aplicarHoraMinima, HORA_MINIMA_ENVIO } =
  require("./jobs/mensagensComemorativas.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function vira(entrada, esperado) {
  const r = aplicarHoraMinima(entrada);
  checar(`"${entrada}" → "${esperado}"`, r === esperado, `"${r}"`);
}

console.log("\n— O CASO REAL: o arquivo do servidor está com 7h —");
vira("0 7 * * *", "0 10 * * *");

console.log("\n— QUALQUER HORA CEDO DEMAIS SOBE PARA 10h, MANTENDO OS MINUTOS —");
vira("0 6 * * *",  "0 10 * * *");
vira("30 8 * * *", "30 10 * * *");
vira("15 9 * * *", "15 10 * * *");
vira("0 0 * * *",  "0 10 * * *");
vira("45 3 * * *", "45 10 * * *");

console.log("\n— DE 10h EM DIANTE, O ARQUIVO MANDA (é para isso que ele existe) —");
vira("0 10 * * *",  "0 10 * * *");
vira("0 11 * * *",  "0 11 * * *");
vira("30 14 * * *", "30 14 * * *");
vira("0 21 * * *",  "0 21 * * *");

console.log("\n— O QUE EU NÃO ENTENDO, EU NÃO MEXO —");
vira("*/30 7-20 * * *", "*/30 7-20 * * *");   // faixa
vira("0 7,8 * * *",     "0 7,8 * * *");       // lista
vira("0 * * * *",       "0 * * * *");         // toda hora
vira("",                "");
vira("bagunça",         "bagunça");

console.log("\n— A HORA MÍNIMA É A COMBINADA —");
checar(`hora mínima é ${HORA_MINIMA_ENVIO}h`, HORA_MINIMA_ENVIO === 10, String(HORA_MINIMA_ENVIO));

console.log("\n— NENHUMA SAÍDA PODE CAIR ANTES DAS 10h —");
const cedo = ["0 0 * * *", "0 1 * * *", "0 5 * * *", "0 6 * * *", "0 7 * * *",
              "0 8 * * *", "0 9 * * *", "59 9 * * *"];
const furou = cedo.filter(e => {
  const h = Number(aplicarHoraMinima(e).split(" ")[1]);
  return h < HORA_MINIMA_ENVIO;
});
checar("nenhum horário da madrugada ou da manhã cedo escapa", furou.length === 0, furou.join(", "));

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
