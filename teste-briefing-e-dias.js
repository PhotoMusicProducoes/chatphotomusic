// teste-briefing-e-dias.js - Banco de medição do caso ADERJ (12/09/2026)
//
// Atendimento real de 12/09/2026: a ADERJ (Associação de Atacadistas do RJ)
// pediu cotação para a festa de 40 anos, 13/11 no Grand Hyatt, e colou o
// briefing inteiro. Dois defeitos estragaram o lead:
//
//   1. O briefing virou o campo NOME ("Nome: Olá! Tudo Bem? sou Da Aderj...").
//   2. O bot aceitou um evento de 90 DIAS calado, e passou a pedir data e
//      horário de cada um ("Dia 3 de 90").
//
// Rodar:  node teste-briefing-e-dias.js

const { pareceBriefing, precisaConfirmarDias, DIAS_SEM_CONFIRMAR } = require("./index.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function nome(texto, esperado, rotulo) {
  const r = pareceBriefing(texto);
  checar(rotulo || `"${String(texto).slice(0, 40)}..."`, r === esperado, `veio ${r}`);
}

console.log("\n— O CASO ADERJ —");
nome(
  "Olá! Tudo bem?\n\nSou da ADERJ - Associação de Atacadistas e Distribuidores do " +
  "Estado do Rio de Janeiro e estamos organizando a nossa Festa do Fornecedor 2026, " +
  "em comemoração aos 40 anos da ADERJ.\n\nGostaria de solicitar uma cotação para:\n" +
  "Data: 13/11/2026",
  true, "o briefing da ADERJ NÃO pode virar nome");

console.log("\n— NOME DE GENTE PASSA —");
nome("Mario", false);
nome("Mario Nazeanze", false);
nome("Maria das Graças Silva Santos", false, '"Maria das Graças Silva Santos" (6 palavras, nome real)');
nome("ana", false);
nome("  Adriana Mendonça  ", false, "nome com espaço sobrando");

console.log("\n— O QUE NÃO É NOME —");
nome("Olá, meu nome é Mario e eu queria um orçamento para a minha festa", true,
  "frase inteira não é nome");
nome("Mario\nNazeanze", true, "quebra de linha não é nome");
nome("a".repeat(61), true, "texto de 61 caracteres não é nome");
nome("Quero uma cabine para o dia 15 de novembro no Grand Hyatt", true,
  "pedido com data e local não é nome");

console.log("\n— BORDAS (é aqui que regra de tamanho quebra) —");
nome("a".repeat(60), false, "60 caracteres ainda passa");
nome("um dois tres quatro cinco seis", false, "6 palavras ainda passa");
nome("um dois tres quatro cinco seis sete", true, "7 palavras já é texto");
nome("", false, "vazio cai na validação de nome curto, não aqui");

console.log("\n— OS DIAS DO EVENTO —");
checar("1 dia não pergunta nada", precisaConfirmarDias(1) === false, "pediu confirmação");
checar("2 dias não pergunta nada", precisaConfirmarDias(2) === false, "pediu confirmação");
checar(`${DIAS_SEM_CONFIRMAR} dias ainda passa direto`,
  precisaConfirmarDias(DIAS_SEM_CONFIRMAR) === false, "pediu confirmação");
checar(`${DIAS_SEM_CONFIRMAR + 1} dias PEDE confirmação`,
  precisaConfirmarDias(DIAS_SEM_CONFIRMAR + 1) === true, "passou calado");
checar("🚨 90 dias PEDE confirmação (o defeito da ADERJ)",
  precisaConfirmarDias(90) === true, "passou calado, é o bug de novo");
checar("texto no lugar do número não vira evento longo",
  precisaConfirmarDias("abc") === false, "NaN não pode virar confirmação");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
