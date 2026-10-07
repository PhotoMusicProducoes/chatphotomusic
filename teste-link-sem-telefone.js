// teste-link-sem-telefone.js
// Banco de medicao do link que o convidado recebe (services/eventos.js).
// Rodar:  node teste-link-sem-telefone.js
//
// 🚨 POR QUE ESTE BANCO EXISTE (29/09/2026): o link do aceite ia com o
// telefone LEGIVEL (`&tel=21996708250`). Esse link e encaminhado de mao em
// mao no WhatsApp - quem recebe le o numero de quem mandou. Agora vai a
// MARCA (`k=`), um hash que o site so usa para CONFERIR. O numero guardado
// passa a ser o que a pessoa DIGITA no formulario.
//
// 📌 A trava: se o site nao responder a marca, o link TEM de continuar
// saindo (com `tel=`). Num evento ao vivo, convidado sem foto e pior do que
// numero exposto - e o site aceita os dois de proposito.

const { montarMensagemEvento } = require("./services/eventos.js");

const evento = {
  titulo: "Evento test 25AGO2026",
  preposicao: "ao",
  token: "b05ab1f6f0",
  instagram: "",
  googleReview: "",
};
const TEL = "5521996708250";
const MARCA = "a1b2c3d4e5f60718293a4b5c";

let falhas = 0;
function checa(cond, rotulo) {
  if (!cond) falhas++;
  console.log((cond ? "[OK]    " : "[FALHOU]"), rotulo);
}

const comMarca = montarMensagemEvento(evento, TEL, MARCA);
checa(comMarca.includes(`k=${MARCA}`),        "com marca: o link leva k=");
checa(!comMarca.includes("tel="),             "com marca: o link NAO leva tel=");
checa(!comMarca.includes("996708250"),        "com marca: o numero NAO aparece em lugar nenhum");
checa(comMarca.includes(evento.token),        "com marca: o token do evento continua indo");

const semMarca = montarMensagemEvento(evento, TEL, "");
checa(semMarca.includes(`tel=${TEL}`),        "site fora do ar: volta para tel= e o link sai");
checa(semMarca.includes(evento.token),        "site fora do ar: o token continua indo");

// evento sem token: cai no link_aceite/links, sem inventar URL quebrada
const semToken = montarMensagemEvento({ ...evento, token: "" }, TEL, MARCA);
checa(!semToken.includes("?t=&"),             "evento sem token nao monta link quebrado");

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s) de 7.`); process.exit(1); }
console.log("RESULTADO: 7/7 OK.");
// carregar o bot deixa temporizadores abertos: sai na marra
process.exit(0);
