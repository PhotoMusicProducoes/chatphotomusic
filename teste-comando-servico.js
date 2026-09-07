// teste-comando-servico.js — Banco de medição dos comandos de serviço
//
// Irmão do teste-comando-guia.js. Em 02/09/2026 o "#orcamentomanuel" (com E)
// mandou o Mario para a parede de "não consegui identificar o cliente"; na
// ocasião só o comando do GUIA ganhou tolerância. Os comandos de serviço
// continuavam por igualdade exata, então "#fotocabinne" ou "#iluminação" com
// acento devolviam "comando não reconhecido" e o cliente não recebia nada.
//
// 🚨 A regra mais importante daqui é a do EMPATE: se dois serviços ficam
// igualmente perto do que foi digitado, o bot NÃO adivinha. Mandar o orçamento
// do serviço errado para um cliente é pior do que pedir para repetir.
//
// Rodar:  node teste-comando-servico.js

const { resolverComandoServico, comandosServicos } = require("./index.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function resolve(digitado, esperado) {
  const r = resolverComandoServico(digitado);
  const rotulo = esperado === null
    ? `"${digitado}" NÃO é resolvido (pede para repetir)`
    : `"${digitado}" vira ${esperado}`;
  checar(rotulo, r === esperado, String(r));
}

console.log("\n— TODOS OS COMANDOS OFICIAIS CONTINUAM VALENDO —");
for (const cmd of Object.keys(comandosServicos)) resolve(cmd, cmd);

console.log("\n— ERRO DE DIGITAÇÃO —");
resolve("#fotocabinne", "#fotocabine");
resolve("#fotocabin", "#fotocabine");
resolve("#fotocabien", "#fotocabine");
resolve("#somdjj", "#somdj");
resolve("#plataforma36", "#plataforma360");
resolve("#totenretro", "#totemretro");

console.log("\n— ACENTO E PONTUAÇÃO —");
resolve("#iluminação", "#iluminacao");
resolve("#Foto-Cabine", "#fotocabine");
resolve("#FOTOCABINE", "#fotocabine");
resolve("#plataforma_360", "#plataforma360");

console.log("\n— 🚨 NA DÚVIDA, NÃO ADIVINHA —");
resolve("", null);
resolve("#", null);
resolve("#xyz", null);
resolve("#orcamentomanual", null);   // é o guia, não um serviço
resolve("#local", null);             // outro comando, não serviço
resolve("#data", null);

console.log("\n— NENHUM SERVIÇO PODE VIRAR OUTRO SERVIÇO —");
const oficiais = Object.keys(comandosServicos);
let trocou = null;
for (const cmd of oficiais) {
  const r = resolverComandoServico(cmd);
  if (r !== cmd) { trocou = `${cmd} virou ${r}`; break; }
}
checar("comando oficial nunca é resolvido como outro", trocou === null, String(trocou));

// Um erro que fica igualmente perto de dois comandos não pode ser chutado.
// (Se um dia entrarem dois serviços de nome parecido, este teste avisa.)
const ambiguos = [];
for (const a of oficiais) {
  for (const b of oficiais) {
    if (a >= b) continue;
    const ka = a.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const kb = b.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (Math.abs(ka.length - kb.length) <= 2) {
      let dif = 0;
      for (let i = 0; i < Math.max(ka.length, kb.length); i++) if (ka[i] !== kb[i]) dif++;
      if (dif <= 2) ambiguos.push(`${a} x ${b}`);
    }
  }
}
checar("não existem dois serviços a menos de 2 letras de distância",
  ambiguos.length === 0, ambiguos.join(", "));

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
