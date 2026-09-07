// teste-acentos.js — Banco de medição do tira-acentos
//
// 🚨 Havia SEIS cópias de uma classe de caracteres escrita errada:
//        .replace(/[0300-036f]/g, "")     ← faltavam os \u
// Sem os `\u`, isso não é a faixa dos acentos: é o conjunto dos caracteres
// 0, 3, 6 e f, que eram APAGADOS do texto do cliente. Achado em 06/09/2026,
// depois de eu ter classificado errado, no dia 01/09, como "bomba armada que
// ainda não quebra nada". Já quebrava duas coisas em produção:
//
//   1) interpretarSimNao("não") devolvia null, porque o til continuava lá e
//      "não" nunca virava "nao". Todo cliente que responde "não" por extenso
//      numa pergunta de Sim/Não levava "⚠ Responda com o número da opção".
//   2) clienteQuerContratar() perdia a letra F: "quero fechar" virava "quero
//      echar" e o /\bfechar\b/ nunca casava. O aviso "🟢 Cliente quer
//      CONTRATAR!" só disparava por "contratar"/"contrato", nunca por "fechar".
//
// Rodar:  node teste-acentos.js

const fs   = require("fs");
const path = require("path");

const { interpretarSimNao, clienteQuerContratar } = require("./index.js");
const fonte = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— A CLASSE ERRADA NÃO PODE EXISTIR EM LUGAR NENHUM —");
checar("nenhuma cópia de [0300-036f] sobrou",
  !/\[0300-036f\]/.test(fonte), "ainda existe");
checar("as faixas de acento estão escapadas e legíveis no editor",
  (fonte.match(/\[\\u0300-\\u036f\]/g) || []).length >= 6,
  String((fonte.match(/\[\\u0300-\\u036f\]/g) || []).length));

console.log("\n— \"NÃO\" COM ACENTO PRECISA SER ENTENDIDO —");
for (const t of ["não", "Não", "NÃO", "nao", "n", "2", "no"]) {
  checar(`"${t}" é lido como Não (2)`, interpretarSimNao(t) === "2", String(interpretarSimNao(t)));
}
for (const t of ["sim", "Sim", "SIM", "s", "1", "yes"]) {
  checar(`"${t}" é lido como Sim (1)`, interpretarSimNao(t) === "1", String(interpretarSimNao(t)));
}
checar('"talvez" continua não sendo entendido', interpretarSimNao("talvez") === null,
  String(interpretarSimNao("talvez")));

console.log("\n— \"QUERO FECHAR\" PRECISA ACIONAR O AVISO AO OPERADOR —");
for (const t of ["quero fechar", "vamos fechar contrato", "podemos fechar?",
                 "quero contratar", "gostaria de fechar com vocês"]) {
  checar(`"${t}" sinaliza contratação`, clienteQuerContratar(t) === true, "não sinalizou");
}

console.log("\n— O QUE NÃO PODE VIRAR FALSO ALARME —");
for (const t of ["não quero contratar", "ainda não vou fechar", "quanto custa?",
                 "bom dia", "quero ver as fotos"]) {
  checar(`"${t}" NÃO sinaliza contratação`, clienteQuerContratar(t) === false, "sinalizou por engano");
}

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
