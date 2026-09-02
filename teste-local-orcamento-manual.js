// teste-local-orcamento-manual.js — Banco de medição do LOCAL no orçamento manual
//
// Caso real (01/09/2026, cliente 21 96868-4218): o cliente informou "Botafogo,
// Rio de Janeiro" no fluxo, o bot parou de responder, o operador mandou o
// orçamento na mão SEM #local e a proposta saiu SEM deslocamento. O código
// zerava bairro/cidade sempre que não houvesse #local, para não vazar o local
// de um cliente para o próximo (caso 22/07/2026) — e junto apagava o local que
// o próprio cliente tinha dado.
//
// Rodar:  node teste-local-orcamento-manual.js

const { resolverLocalOrcamentoManual } = require("./index.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

// ------------------------------------------------------
// 1) O CASO REAL — cliente informou o local, operador não usou #local
// ------------------------------------------------------
const doCliente = { bairro: "Botafogo", cidade: "Rio De Janeiro", _localOrigem: "cliente" };
const r1 = resolverLocalOrcamentoManual(doCliente, null);
checar(
  "local dito pelo CLIENTE sobrevive ao orçamento manual sem #local",
  r1.acao === "cliente" && r1.bairro === "Botafogo" && r1.cidade === "Rio De Janeiro",
  JSON.stringify(r1)
);

// Sessão ANTIGA (as 1322 que já estão no volume não têm o campo _localOrigem)
const legado = { bairro: "Recreio", cidade: "Rio De Janeiro" };
const r2 = resolverLocalOrcamentoManual(legado, null);
checar(
  "sessão antiga, sem _localOrigem, também preserva o local",
  r2.acao === "cliente" && r2.bairro === "Recreio",
  JSON.stringify(r2)
);

// ------------------------------------------------------
// 2) A PROTEÇÃO DE 22/07 CONTINUA DE PÉ — #local não vaza para o próximo
// ------------------------------------------------------
const sobraDeManual = { bairro: "Califórnia", cidade: "Nova Iguaçu", _localOrigem: "manual" };
const r3 = resolverLocalOrcamentoManual(sobraDeManual, null);
checar(
  "local de um #local ANTERIOR é apagado (não vaza p/ o próximo)",
  r3.acao === "limpar" && r3.bairro === null && r3.cidade === null,
  JSON.stringify(r3)
);

// ------------------------------------------------------
// 3) #local desta rodada manda em tudo (inclusive corrige o cliente)
// ------------------------------------------------------
const r4 = resolverLocalOrcamentoManual(doCliente, { bairro: "Califórnia", cidade: "Nova Iguaçu" });
checar(
  "#local desta rodada troca o que o cliente informou",
  r4.acao === "manual" && r4.bairro === "Califórnia" && r4.cidade === "Nova Iguaçu",
  JSON.stringify(r4)
);

// Só a cidade (uso "#local Nova Iguaçu")
const r5 = resolverLocalOrcamentoManual({}, { bairro: null, cidade: "Nova Iguaçu" });
checar(
  "#local só com a cidade funciona",
  r5.acao === "manual" && r5.cidade === "Nova Iguaçu",
  JSON.stringify(r5)
);

// ------------------------------------------------------
// 4) Sem local nenhum — segue sem deslocamento, como antes
// ------------------------------------------------------
const r6 = resolverLocalOrcamentoManual({}, null);
checar("sem local nenhum, fica vazio", r6.acao === "vazio" && r6.cidade === null, JSON.stringify(r6));

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
