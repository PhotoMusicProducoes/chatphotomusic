// teste-numero-whatsapp.js — Banco de medição do número copiado do WhatsApp
//
// Caso real (07/09/2026): o Mario copiou o número do contato e mandou
//     "Resetar +55 21 98578-9603"
// O bot respondeu "🔄 Atendimento resetado para 552198578", ou seja resetou um
// número que não existe, e o do cliente ficou como estava.
//
// 🚨 O WhatsApp NÃO usa o hífen comum ao formatar telefone: usa o hífen NÃO
// SEPARÁVEL (U+2011) e embrulha tudo em marcas invisíveis de direção de texto
// (U+202A ... U+202C). Os parsers procuravam o telefone com uma classe
// [\d\s\-()], que não conhece esse hífen, e o casamento parava no meio.
// O pior é que o corte era SILENCIOSO: o bot confirmava a ação num número errado.
//
// Rodar:  node teste-numero-whatsapp.js

const { limparPontuacaoNumero, normalizarNumero, extrairNumero } = require("./index.js");

const ALVO = "5521985789603";

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

// Como o WhatsApp entrega de verdade: embrulhado e com hífen U+2011.
const doWhatsApp = "‪+55 21 98578‑9603‬";

console.log("\n— O CASO REAL: o comando inteiro, como o Mario mandou —");
// 🚨 É por AQUI que o comando do operador passa (extrairNumero). O
// normalizarNumero sozinho não pegava o defeito, porque o corte acontecia
// ANTES, no casamento do telefone dentro do texto.
const comandoDoMario = "Resetar " + doWhatsApp;
console.log(`   digitado: ${JSON.stringify(comandoDoMario)}`);
checar("o comando inteiro resolve o número certo",
  extrairNumero(comandoDoMario) === ALVO, String(extrairNumero(comandoDoMario)));
checar("NÃO resolve o número cortado 552198578",
  extrairNumero(comandoDoMario) !== "552198578", "cortou de novo");

for (const cmd of ["pausar", "retomar", "resetar", "pausarespecial", "retomarespecial"]) {
  checar(`"${cmd} +55 21 98578-9603" (do contato) acha o número`,
    extrairNumero(`${cmd} ${doWhatsApp}`) === ALVO,
    String(extrairNumero(`${cmd} ${doWhatsApp}`)));
}

checar("número copiado do contato é lido inteiro",
  normalizarNumero(doWhatsApp) === ALVO, String(normalizarNumero(doWhatsApp)));

console.log("\n— OS FORMATOS QUE O OPERADOR USA NO DIA A DIA —");
for (const [rotulo, entrada] of [
  ["hífen comum",              "+55 21 98578-9603"],
  ["hífen do WhatsApp",        "+55 21 98578‑9603"],
  ["travessão no lugar do hífen", "+55 21 98578–9603"],
  ["sem o +",                  "55 21 98578-9603"],
  ["com parênteses no DDD",    "+55 (21) 98578-9603"],
  ["tudo junto",               "5521985789603"],
  ["espaço não separável",     "+55 21 98578-9603"],
  ["embrulhado e com ponto",   "‪+55 21 98578.9603‬"],
  ["sem DDI",                  "21 98578-9603"],
]) {
  checar(`${rotulo}: "${entrada.replace(/[‪‬ ]/g, "·")}"`,
    normalizarNumero(entrada) === ALVO, String(normalizarNumero(entrada)));
}

console.log("\n— A LIMPEZA EM SI —");
checar("tira as marcas invisíveis",
  !/[‪‬]/.test(limparPontuacaoNumero(doWhatsApp)), "sobrou invisível");
checar("troca o hífen do WhatsApp pelo comum",
  limparPontuacaoNumero("98578‑9603").includes("-"), limparPontuacaoNumero("98578‑9603"));
checar("troca espaço não separável por espaço comum",
  limparPontuacaoNumero("55 21") === "55 21", JSON.stringify(limparPontuacaoNumero("55 21")));
checar("texto normal passa intacto",
  limparPontuacaoNumero("Resetar 5521985789603") === "Resetar 5521985789603", "");

console.log("\n— INTERNACIONAL CONTINUA FUNCIONANDO —");
checar("EUA +1 (561) 710-1530 não ganha 55 na frente",
  normalizarNumero("+1 (561) 710-1530") === "15617101530",
  String(normalizarNumero("+1 (561) 710-1530")));
checar("EUA com o hífen do WhatsApp também",
  normalizarNumero("+1 (561) 710‑1530") === "15617101530",
  String(normalizarNumero("+1 (561) 710‑1530")));

console.log("\n— O QUE NÃO PODE VIRAR TELEFONE —");
checar("texto sem número devolve null", normalizarNumero("resetar") === null,
  String(normalizarNumero("resetar")));
checar("vazio devolve null", normalizarNumero("") === null, String(normalizarNumero("")));

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
