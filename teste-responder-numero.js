// teste-responder-numero.js - Banco de medição do comando "responder NUMERO RESPOSTA"
//
// Caso real (11/11/2026): o operador digitou
//     responder 2 21 98539-2405
// (resposta ANTES do número) e o bot disse "Número inválido: 2".
// Agora o número vale com espaço e hífen, com ou sem 55 e +55, e a resposta pode vir
// antes ou depois dele.
//
// Rodar:  node teste-responder-numero.js   (sai com código 1 se algo falhar)

const fs = require("fs");
const { limparPontuacaoNumero, normalizarNumero } = require("./index.js");

// extrairNumeroComResto mora DENTRO do tratador de mensagens: pega o texto da função e roda aqui.
const fonte = fs.readFileSync(__dirname + "/index.js", "utf8");
const ini = fonte.indexOf("function extrairNumeroComResto(texto) {");
if (ini < 0) { console.log("❌ extrairNumeroComResto não encontrada"); process.exit(1); }
let nivel = 0, fim = -1;
for (let i = fonte.indexOf("{", ini); i < fonte.length; i++) {
  if (fonte[i] === "{") nivel++;
  else if (fonte[i] === "}") { nivel--; if (nivel === 0) { fim = i + 1; break; } }
}
const extrairNumeroComResto = new Function("limparPontuacaoNumero", fonte.slice(ini, fim) + "; return extrairNumeroComResto;")(limparPontuacaoNumero);

let falhas = 0;
function checar(nome, ok, detalhe) {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + detalhe}`);
  if (!ok) falhas++;
}

const ALVO = "5521985392405";
function caso(texto, respostaEsperada) {
  const { numero, resto } = extrairNumeroComResto(texto);
  const n = normalizarNumero(numero);
  checar(`"${texto}" → número ${ALVO}, resposta "${respostaEsperada}"`,
    n === ALVO && resto === respostaEsperada, `número=${JSON.stringify(numero)} (${n}) resto=${JSON.stringify(resto)}`);
}

console.log("\n— número depois da resposta ou antes, nos 3 formatos pedidos —");
caso("21 98539-2405 2", "2");
caso("55 21 98539-2405 2", "2");
caso("+55 21 98539-2405 2", "2");
caso("2 21 98539-2405", "2");            // o caso real
caso("2 55 21 98539-2405", "2");
caso("2 +55 21 98539-2405", "2");
caso("pular 21 98539-2405", "pular");
caso("21 98539-2405 pular", "pular");
caso("+5521985392405 2", "2");
caso("21985392405 2", "2");
caso("(21) 98539-2405 2", "2");

console.log("\n— o que já funcionava continua igual —");
{
  const { numero, resto } = extrairNumeroComResto("995021656 2");
  checar("número de 9 dígitos + resposta", numero === "995021656" && resto === "2", JSON.stringify({ numero, resto }));
}
{
  const { numero, resto } = extrairNumeroComResto("5521995021656 nome@email.com");
  checar("resposta com e-mail", numero === "5521995021656" && resto === "nome@email.com", JSON.stringify({ numero, resto }));
}
{
  const { numero, resto } = extrairNumeroComResto("21995021656 meu zap é 21 98888-7777");
  checar("resposta que contém outro telefone: vale o número do começo",
    numero === "21995021656" && resto === "meu zap é 21 98888-7777", JSON.stringify({ numero, resto }));
}

console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
process.exit(falhas ? 1 : 0);
