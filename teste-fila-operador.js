// teste-fila-operador.js — Banco de medição da fila do operador
//
// 🚨 O CASO REAL (Mario, 07/09/2026)
// A cliente pediu mais detalhes, viu o preço, disse que estava fora do
// orçamento dela, e o bot seguiu despejando arquivo. O Mario tentou
// "pausarespecial" e "resetar" e nada aconteceu na hora: os comandos só
// surtiram efeito DEPOIS que o envio inteiro terminou.
//
// Não era o comando: era a FILA. Existe uma fila por número (para duas
// mensagens do mesmo cliente não se atropelarem) e a chave era sempre
// `payload.phone`. Como o Mario opera digitando DENTRO do chat do cliente,
// pela própria linha do bot, a Z-API manda `fromMe: true` com
// `phone` = número do CLIENTE. O comando dele entrava na mesma fila do envio
// em andamento e esperava o envio acabar.
//
// Rodar:  node teste-fila-operador.js

const { escolherChaveFila } = require("./utils/filaWebhook.js");

const CLIENTE = "5521999998888";
const LINHA   = "5521964428172";

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— O CASO REAL —");
// O envio para a cliente está rodando na fila dela...
const filaDaCliente = escolherChaveFila({ phone: CLIENTE, fromMe: false });
// ...e o Mario digita "pausar" DENTRO do chat dela, pela linha do bot.
const filaDoComando = escolherChaveFila({ phone: CLIENTE, fromMe: true, connectedPhone: LINHA });

console.log(`   fila da cliente: ${filaDaCliente}`);
console.log(`   fila do comando: ${filaDoComando}`);
checar("o comando do operador NÃO cai na fila da cliente",
  filaDoComando !== filaDaCliente, "cai na mesma fila e espera o envio acabar");
checar("o comando roda numa fila de operador", /^operador:/.test(filaDoComando), filaDoComando);

console.log("\n— O CLIENTE CONTINUA COM FILA PRÓPRIA (não pode se atropelar) —");
checar("mensagem da cliente usa o número dela", filaDaCliente === CLIENTE, filaDaCliente);
checar("dois clientes diferentes, filas diferentes",
  escolherChaveFila({ phone: "5511111111111" }) !== escolherChaveFila({ phone: "5522222222222" }), "");
checar("duas mensagens do MESMO cliente, mesma fila",
  escolherChaveFila({ phone: CLIENTE }) === escolherChaveFila({ phone: CLIENTE }), "");

console.log("\n— COMANDOS DO OPERADOR NÃO SE ATROPELAM ENTRE SI —");
const c1 = escolherChaveFila({ phone: CLIENTE,  fromMe: true, connectedPhone: LINHA });
const c2 = escolherChaveFila({ phone: "5533333333333", fromMe: true, connectedPhone: LINHA });
checar("dois comandos, em chats diferentes, na MESMA fila de operador",
  c1 === c2, `${c1} x ${c2}`);

console.log("\n— 🚨 CLIENTE NÃO PODE FURAR A FILA —");
// fromMe é da linha do bot; cliente nenhum consegue mandar isso.
checar("cliente escrevendo 'pausar' continua na fila dele",
  escolherChaveFila({ phone: CLIENTE, fromMe: false }) === CLIENTE, "");
checar("fromMe ausente conta como cliente",
  escolherChaveFila({ phone: CLIENTE }) === CLIENTE, "");
checar("fromMe 'true' em texto NÃO vale (só booleano)",
  escolherChaveFila({ phone: CLIENTE, fromMe: "true" }) === CLIENTE,
  escolherChaveFila({ phone: CLIENTE, fromMe: "true" }));

console.log("\n— CASOS TORTOS —");
checar("sem phone, usa o from", escolherChaveFila({ from: "abc@c.us" }) === "abc@c.us", "");
checar("sem nada, não quebra", escolherChaveFila({}) === "desconhecido", "");
checar("payload nulo, não quebra", escolherChaveFila(null) === "desconhecido", "");
checar("operador sem connectedPhone, ainda tem fila própria",
  /^operador:/.test(escolherChaveFila({ phone: CLIENTE, fromMe: true })), "");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
