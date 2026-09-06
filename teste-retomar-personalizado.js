// teste-retomar-personalizado.js — Banco de medição do "Sim, quero" (retomada)
//
// Caso real relatado pelo Mario (05/09/2026): o cliente recebeu os orçamentos
// pelo lembrete SEM nunca ter interagido, clicou em "1 - Sim, quero" no convite
// do orçamento personalizado e o bot NÃO PERGUNTOU NADA. Motivo: o passo
// guardado para retomar era "aguardando_opcao" (o menu de entrada, que nem
// existe no PERGUNTA_POR_PASSO do job), então a pergunta guardada ficava vazia.
// Pior: o passo dele voltava a ser o menu de entrada, e a próxima mensagem
// levava "opção inválida".
//
// Rodar:  node teste-retomar-personalizado.js

const { resolverRetomada } = require("./index.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— O CASO REAL: nunca interagiu, clicou em 'Sim, quero' —");
const nuncaInteragiu = {
  lembreteRetomarStep: "aguardando_opcao",
  lembreteRetomarPergunta: ""
};
const r1 = resolverRetomada(nuncaInteragiu);
checar("começa o questionário no NOME", r1.passo === "orcamento_nome", r1.passo);
checar("o bot PERGUNTA alguma coisa (não fica mudo)", !!r1.pergunta && r1.pergunta.length > 5, JSON.stringify(r1.pergunta));
checar("a pergunta é o nome", /nome/i.test(r1.pergunta), r1.pergunta);
checar("marcado como começo, não como 'continuar'", r1.doZero === true, String(r1.doZero));
checar("NÃO devolve o cliente para o menu de entrada", r1.passo !== "aguardando_opcao", r1.passo);

console.log("\n— SESSÃO SEM NADA GUARDADO (sessão antiga do volume) —");
for (const [rotulo, sess] of [
  ["sessão vazia", {}],
  ["sem passo", { lembreteRetomarPergunta: "" }],
  ["passo nulo", { lembreteRetomarStep: null }],
  ["convite dentro do convite", { lembreteRetomarStep: "lembrete_retomar" }],
  ["atendimento encerrado", { lembreteRetomarStep: "finalizado" }],
  ["confirmação do menu", { lembreteRetomarStep: "confirmar_opcao_menu" }]
]) {
  const r = resolverRetomada(sess);
  checar(`${rotulo}: começa no nome e pergunta`, r.passo === "orcamento_nome" && !!r.pergunta, JSON.stringify(r));
}

console.log("\n— QUEM PAROU NO MEIO DE VERDADE CONTINUA DE ONDE PAROU —");
const parouNaData = {
  lembreteRetomarStep: "orcamento_data",
  lembreteRetomarPergunta: "Qual a data do evento? (Ex: 01/02/2026)"
};
const r2 = resolverRetomada(parouNaData);
checar("mantém o passo da data", r2.passo === "orcamento_data", r2.passo);
checar("repete a pergunta da data", /data/i.test(r2.pergunta), r2.pergunta);
checar("não é começo do zero", r2.doZero === false, String(r2.doZero));

console.log("\n— PASSO DO MEIO SEM PERGUNTA GUARDADA: usa a última não respondida —");
const semPergunta = {
  lembreteRetomarStep: "orcamento_bairro",
  lembreteRetomarPergunta: "",
  ultimaPerguntaNaoRespondida: "Qual o *bairro* do evento?"
};
const r3 = resolverRetomada(semPergunta);
checar("mantém o passo do bairro", r3.passo === "orcamento_bairro", r3.passo);
checar("usa a última pergunta não respondida", /bairro/i.test(r3.pergunta), r3.pergunta);

console.log("\n— ÚLTIMO RECURSO: passo do meio e nenhuma pergunta em lugar nenhum —");
const r4 = resolverRetomada({ lembreteRetomarStep: "orcamento_bairro" });
checar("recomeça pelo nome em vez de ficar mudo", r4.passo === "orcamento_nome" && !!r4.pergunta, JSON.stringify(r4));

console.log("\n— O QUE NUNCA PODE ACONTECER —");
const todos = [nuncaInteragiu, {}, parouNaData, semPergunta, { lembreteRetomarStep: "orcamento_bairro" }];
checar("nenhum caso devolve pergunta vazia (bot mudo)",
  todos.every(x => { const r = resolverRetomada(x); return !!r.pergunta && r.pergunta.trim().length > 0; }), "");
checar("nenhum caso devolve o cliente ao menu de entrada",
  todos.every(x => resolverRetomada(x).passo !== "aguardando_opcao"), "");

console.log("\n— A ABERTURA PRECISA EXPLICAR O PORQUÊ, COM CARINHO —");
// Pedido do Mario (05/09/2026): o cliente acabou de receber um orçamento
// pronto; ele precisa entender que as perguntas existem para o valor sair sob
// medida para o evento dele.
for (const [rotulo, sess] of [["quem começa do zero", nuncaInteragiu],
                              ["quem continua de onde parou", parouNaData]]) {
  const a = resolverRetomada(sess).abertura || "";
  checar(`${rotulo}: diz que precisa de informações`, /informa[cç][oõ]es/i.test(a), a);
  checar(`${rotulo}: fala do evento dele ou do personalizado`,
    /seu evento|personalizado/i.test(a), a);
  checar(`${rotulo}: coração VERMELHO`, a.includes("❤️"), a);
  checar(`${rotulo}: sem travessão longo`, !a.includes("—"), a);
}
checar("quem continua não é tratado como se estivesse começando",
  /continuar de onde paramos/i.test(resolverRetomada(parouNaData).abertura), "");
checar("quem começa não ouve 'continuar de onde paramos'",
  !/de onde paramos/i.test(resolverRetomada(nuncaInteragiu).abertura), "");

console.log("\n— COMO O CLIENTE VAI VER —\n");
for (const [rotulo, sess] of [["NUNCA INTERAGIU", nuncaInteragiu],
                              ["PAROU NA DATA", parouNaData]]) {
  const r = resolverRetomada(sess);
  console.log(`   [${rotulo}]`);
  console.log((r.abertura + "\n\n" + r.pergunta).replace(/^/gm, "   "));
  console.log("");
}

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
