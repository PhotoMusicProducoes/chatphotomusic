// teste-intervalo-envio.js — Banco de medição do intervalo entre envios
//
// Decisão do Mario em 05/09/2026: o intervalo entre uma mensagem e outra dos
// envios automáticos passou de 5-15 SEGUNDOS para 30-90 segundos, para não
// cair como spam / envio em massa pela Meta. A conta estava copiada à mão em
// quatro lugares e virou uma função só (utils/intervaloEnvio.js).
//
// Rodar:  node teste-intervalo-envio.js

const {
  esperaEntreEnvios, ESPERA_PRIMEIRO_MS, ESPERA_MIN_MS, ESPERA_MAX_MS
} = require("./utils/intervaloEnvio.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— A FAIXA COMBINADA: 30 a 90 segundos —");
checar("mínimo é 30s", ESPERA_MIN_MS === 30_000, String(ESPERA_MIN_MS));
checar("máximo é 90s", ESPERA_MAX_MS === 90_000, String(ESPERA_MAX_MS));

// Sorteio controlado: dá para conferir as pontas sem depender de sorte.
checar("sorteio no piso devolve 30s", esperaEntreEnvios(2, () => 0) === 30_000,
  String(esperaEntreEnvios(2, () => 0)));
checar("sorteio no teto devolve 90s", esperaEntreEnvios(2, () => 1) === 90_000,
  String(esperaEntreEnvios(2, () => 1)));
checar("sorteio no meio devolve 60s", esperaEntreEnvios(2, () => 0.5) === 60_000,
  String(esperaEntreEnvios(2, () => 0.5)));

console.log("\n— 10 MIL SORTEIOS DE VERDADE —");
const amostras = Array.from({ length: 10000 }, () => esperaEntreEnvios(2));
const min = Math.min(...amostras), max = Math.max(...amostras);
checar(`nunca abaixo de 30s (menor: ${min / 1000}s)`, min >= ESPERA_MIN_MS, String(min));
checar(`nunca acima de 90s (maior: ${max / 1000}s)`, max <= ESPERA_MAX_MS, String(max));
checar("varia de verdade (não é intervalo fixo)", new Set(amostras).size > 100,
  String(new Set(amostras).size));

console.log("\n— A PRIMEIRA MENSAGEM DO CICLO NÃO ESPERA —");
checar("índice 1 sai em 3s", esperaEntreEnvios(1) === ESPERA_PRIMEIRO_MS,
  String(esperaEntreEnvios(1)));
checar("índice 0 também", esperaEntreEnvios(0) === ESPERA_PRIMEIRO_MS,
  String(esperaEntreEnvios(0)));
checar("a partir do índice 2 entra na faixa", esperaEntreEnvios(2) >= ESPERA_MIN_MS,
  String(esperaEntreEnvios(2)));

console.log("\n— QUANTO TEMPO LEVA UM ENVIO EM MASSA (média de 60s) —");
for (const n of [10, 30, 50]) {
  const minutos = Math.round(((n - 1) * 60_000 + ESPERA_PRIMEIRO_MS) / 60_000);
  console.log(`   ${String(n).padStart(2)} pessoas: cerca de ${minutos} min ` +
              `(começando 10h, termina ~${10 + Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")})`);
}
checar("50 pessoas ainda terminam no mesmo dia útil",
  ((50 - 1) * 90_000) / 3_600_000 < 2, "");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
