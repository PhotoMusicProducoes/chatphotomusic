// teste-comando-guia.js — Banco de medição do comando do guia do operador
//
// Caso real (02/09/2026): o Mario digitou "#orcamentomanuel" (com E) e, em vez
// do guia, recebeu a parede de "⚠ Não consegui identificar o cliente destino",
// que não tem nada a ver com o que ele pediu. A checagem era igualdade exata.
//
// Rodar:  node teste-comando-guia.js

const { comandoBate } = require("./index.js");

const APELIDOS_GUIA = [
  "#orcamentomanual", "#ajuda", "#comandos", "#guia", "#guiarapido", "#help"
];

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function bate(cmd, esperado) {
  const r = comandoBate(cmd, APELIDOS_GUIA);
  checar(`${esperado ? "abre" : "NÃO abre"} o guia: "${cmd}"`, r === esperado, String(r));
}

console.log("\n— O CASO REAL E OS PRIMOS DELE —");
bate("#orcamentomanuel", true);   // o que o Mario digitou
bate("#orcamentomanual", true);   // certo
bate("#orçamentomanual", true);   // com cedilha e acento
bate("#Orcamento-Manual", true);  // com hífen e maiúscula
bate("#orcamentomanul", true);    // letra faltando
bate("#orcamentomanaul", true);   // letras invertidas

console.log("\n— OS OUTROS APELIDOS —");
bate("#ajuda", true);
bate("#comandos", true);
bate("#guia", true);
bate("#guiarapido", true);
bate("#help", true);

console.log("\n— O QUE NÃO PODE VIRAR GUIA —");
bate("#fotocabine", false);
bate("#totemretro", false);
bate("#plataforma360", false);
bate("#somdj", false);
bate("#iluminacao", false);
bate("#local", false);
bate("#data", false);
bate("#cliente", false);
bate("#enviarfaltantes", false);
bate("", false);

console.log("\n— APELIDO CURTO NÃO ACEITA ERRO (senão vira loteria) —");
// "ajuda" tem 5 letras: só bate exato. "#ajude" seria erro de 1 letra, mas
// palavra curta com tolerância pegaria comando legítimo pelo caminho.
bate("#ajude", false);

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
