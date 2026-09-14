// teste-lista-servicos-unica.js - Toda lista de serviço sai da MESMA fonte
//
// Caso real (cliente Monique, 13/09/2026): ela parou na escolha do serviço e o
// lembrete de 1h mandou uma lista VELHA, de antes da renumeração de 17/08.
// O estrago não foi só o Totem Retrô faltando: os números saíram DESLOCADOS.
//
//   O lembrete dizia:  *1* - Foto Cabine
//   O parser entende:  1 = Totem Retrô
//
// Ou seja, quem pedisse Foto Cabine receberia Totem Retrô, calado. E a Foto
// Cabine, que é o carro-chefe, nem aparecia (ela é o *0*).
//
// Rodar:  node teste-lista-servicos-unica.js

const {
  linhasMenuServicos, TODOS_SERVICOS, SERVICOS_NOMES, EXIBICAO_PARA_ID,
} = require("./index.js");
const { PERGUNTA_POR_PASSO } = require("./jobs/lembreteOrcamento.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

const canonica = linhasMenuServicos(TODOS_SERVICOS);
const doLembrete = PERGUNTA_POR_PASSO["orcamento_escolher_servico"];

console.log("\n— A LISTA DO LEMBRETE É A LISTA DO MENU —");

checar("o lembrete usa exatamente as linhas do menu",
  doLembrete.includes(canonica),
  `veio:\n${doLembrete}`);

console.log("\n— TODO SERVIÇO APARECE, COM O NÚMERO CERTO —");

for (const id of TODOS_SERVICOS) {
  const exib = Object.keys(EXIBICAO_PARA_ID).find(e => EXIBICAO_PARA_ID[e] === id);
  const linha = `*${exib}* - ${SERVICOS_NOMES[id]}`;
  checar(`${linha}`, doLembrete.includes(linha), "faltou ou saiu com outro número");
}

console.log("\n— O QUE MATOU O ATENDIMENTO DA MONIQUE —");

checar("🚨 a Foto Cabine é o *0*, nunca o *1*",
  doLembrete.includes("*0* - Foto Cabine") && !doLembrete.includes("*1* - Foto Cabine"),
  "a lista velha voltou: quem pedir Foto Cabine vai receber Totem Retrô");

checar("🚨 o Totem Retrô está na lista",
  doLembrete.includes("Totem Retrô"),
  "serviço novo sumiu do lembrete de novo");

checar("o exemplo de digitação não induz ao erro",
  !doLembrete.includes("1,3,5"),
  "o exemplo ainda usa a numeração velha");

console.log("\n— A LISTA NÃO ESTÁ CONGELADA NO ARQUIVO —");

const fonte = require("fs").readFileSync("./jobs/lembreteOrcamento.js", "utf8");
const nomesCravados = TODOS_SERVICOS.filter(id => {
  const nome = SERVICOS_NOMES[id];
  // o nome pode aparecer em comentário; o que não pode é numerado à mão
  return new RegExp(`\\*\\d\\*\\s*-\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(fonte);
});
checar("nenhum serviço numerado à mão no lembrete",
  nomesCravados.length === 0,
  `cravados: ${nomesCravados.map(id => SERVICOS_NOMES[id]).join(", ")}`);

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
