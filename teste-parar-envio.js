// teste-parar-envio.js — Banco de medição do freio no envio de orçamento
//
// Pergunta do Mario (07/09/2026): "tem como criar um comando para parar o bot
// quando ele está enviando orçamento, e continuar se o cliente quiser, ou já
// tem esse comando?"
//
// Já tinha: `pausar NUMERO` para e `retomar NUMERO` + `#enviarfaltantes`
// continua. O que faltava era o freio no LAÇO. Cada serviço checa a pausa
// entre uma mensagem e outra (fotoCabine tem 49 checagens, totem 48,
// plataforma360 46...), mas o laço que percorre os serviços não checava nada:
// com o número pausado no meio, ele seguia chamando os próximos e, no fim,
// ainda saíam o PDF, o resumo, a despedida e o menu. O cliente que o operador
// mandou parar recebia a cauda inteira.
//
// ⚠️ Alcance: este banco lê o CÓDIGO (trava contra regressão) e testa a função
// pura do freio. Ele não conversa com a Z-API.
//
// Rodar:  node teste-parar-envio.js

const fs   = require("fs");
const path = require("path");
const { pausarCliente, retomarCliente } = require("./utils/pauseControl.js");
const { envioFoiInterrompido } = require("./index.js");

const fonte = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— O FREIO EM SI —");
const numero = "5521987654321";
retomarCliente(numero);
checar("número livre: o envio segue", envioFoiInterrompido(numero) === false, "");
pausarCliente(numero);
checar("número pausado: o envio para", envioFoiInterrompido(numero) === true, "");
retomarCliente(numero);
checar("depois de retomar: o envio segue de novo", envioFoiInterrompido(numero) === false, "");

console.log("\n— O LAÇO AUTOMÁTICO (lembrete e serviço detectado) —");
const corpoAuto = (fonte.match(
  /async function enviarOrcamentosAutomaticos[\s\S]*?\n}/
) || [""])[0];
checar("checa a pausa a cada serviço",
  /envioFoiInterrompido\(chatId\)/.test(corpoAuto), "");
checar("sai do laço com break, não só pula",
  /interrompido = true;[\s\S]{0,200}break;/.test(corpoAuto), "");
checar("não manda PDF, resumo e despedida depois de parar",
  /if \(interrompido \|\| envioFoiInterrompido\(chatId\)\) \{[\s\S]{0,200}return;/.test(corpoAuto), "");

console.log("\n— O LAÇO DO COMANDO MANUAL —");
checar("checa a pausa a cada comando do lote",
  /envioFoiInterrompido\(chatIdCliente\)/.test(fonte), "");
checar("solta a trava de envio manual ao parar",
  /envioManualInterrompido[\s\S]{0,400}enviandoOrcamentosManualmente = false;/.test(fonte), "");

console.log("\n— O OPERADOR PRECISA SABER O QUE FALTOU —");
const corpoAviso = (fonte.match(
  /async function avisarEnvioInterrompido[\s\S]*?\n}/
) || [""])[0];
checar("diz o que o cliente já tinha recebido", /Já tinha recebido/.test(corpoAviso), "");
checar("diz o que faltou", /Faltaram/.test(corpoAviso), "");
checar("ensina a continuar com retomar", /retomar \$\{chatId\}/.test(corpoAviso), "");
checar("ensina a continuar com #enviarfaltantes", /#enviarfaltantes/.test(corpoAviso), "");

console.log("\n— A PAUSA ESPECIAL TAMBÉM FREIA —");
checar("o freio olha as DUAS listas de pausa",
  /estaPausado\(chatId\) \|\| estaPausadoEspecial\(chatId\)/.test(fonte), "");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
