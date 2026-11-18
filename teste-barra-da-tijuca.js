// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-barra-da-tijuca.js
// teste-barra-da-tijuca.js - 18/11/2026 (PM): quem digita só "Barra" como bairro do evento quer dizer Barra da Tijuca.
// Antes o bot não achava "Barra" na tabela e perguntava a cidade. Dirige o handleIncomingMessage REAL; nada vai à rede.
// Rodar:  node teste-barra-da-tijuca.js   (conferir o CODIGO DE SAIDA).

const fs = require("fs");
const path = require("path");
const ARQ_SESSOES = path.join(__dirname, "sessions.json");
const ARQ_RR = path.join(__dirname, "followupRespostaRapida.json");
const guardar = (a) => (fs.existsSync(a) ? fs.readFileSync(a, "utf8") : null);
const sessoesAntes = guardar(ARQ_SESSOES), rrAntes = guardar(ARQ_RR);
function devolver(a, c) { if (c === null) { try { fs.unlinkSync(a); } catch (e) {} } else fs.writeFileSync(a, c, "utf8"); }

const enviados = [];
const utils = require("./utils/index.js");
const numerado = (t, o) => t + "\n\n" + (o || []).map(x => `*${x.id}* - ${x.label}`).join("\n");
utils.sendText       = async (c, t) => { enviados.push([String(c), String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + numerado(t, o)]); return true; };
utils.sendOptionList = async (c, t, o) => { enviados.push([String(c), "LISTA: " + numerado(t, o)]); return true; };
utils.sendFileByUrl  = async () => true;
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;

const axios = require("axios");
const consultas = [];
// a tabela de deslocamento conhece "Barra da Tijuca" (só no Rio) e NÃO conhece "Barra" sozinho
axios.get = async (url, cfg) => {
  if (/deslocamento-consultar/.test(url)) {
    const b = String((cfg && cfg.params && cfg.params.bairro) || "");
    consultas.push(b);
    if (b.toLowerCase() === "recreio dos bandeirantes") return { data: { status: "encontrado", bairro: "Recreio dos Bandeirantes", cidade: "Rio de Janeiro", cidades_do_bairro: ["Rio de Janeiro"] } };
    if (b.toLowerCase() === "barra da tijuca") return { data: { status: "encontrado", bairro: "Barra da Tijuca", cidade: "Rio de Janeiro", cidades_do_bairro: ["Rio de Janeiro"] } };
    return { data: { status: "nao_encontrado" } };
  }
  return { data: {} };
};
axios.post = async () => ({ data: {} });

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 400)}`);
  if (!ok) falhas++;
}
async function cliente(chat, texto) {
  enviados.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "bt-" + (++seq), text: { message: texto }, fromMe: false });
  await new Promise(r => setTimeout(r, 30));
}
function novaSessao(chat) {
  sessions[chat] = { step: "orcamento_bairro", menuInicialEnviado: true, orcamento: { nome: "Cliente", servicosEnviados: [] }, servicosEnviados: [] };
}

(async () => {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  for (const [i, digitado] of ["Barra", "barra", " BARRA. ", "Barra"].entries()) {
    const A = "55219000099" + String(10 + i);
    novaSessao(A);
    consultas.length = 0;
    await cliente(A, digitado);
    const o = sessions[A].orcamento;
    checar(`"${digitado.trim()}" vira Barra da Tijuca`, o.bairro.toLowerCase() === "barra da tijuca", o.bairro);
    checar(`  a cidade já fica Rio de Janeiro, sem perguntar "Qual a cidade"`, o.cidade === "Rio de Janeiro" && !enviados.some(e => /Qual a \*cidade\*/.test(e[1])), JSON.stringify([o.cidade, enviados.map(e => e[1].slice(0, 50))]));
    checar(`  segue para o salão`, sessions[A].step === "orcamento_salao", sessions[A].step);
    checar(`  a consulta usou "Barra da Tijuca"`, consultas.some(x => x.toLowerCase() === "barra da tijuca"), JSON.stringify(consultas));
  }

  console.log("\n— Outros bairros NÃO mudam —");
  for (const [i, b] of ["Barra Mansa", "Barra do Piraí", "Barra de Guaratiba", "Recreio Novo"].entries()) {
    const A = "55219000099" + String(20 + i);
    novaSessao(A);
    await cliente(A, b);
    checar(`"${b}" continua como digitado`, sessions[A].orcamento.bairro.toLowerCase() === b.toLowerCase(), sessions[A].orcamento.bairro);
  }

  console.log("\n— Recreio vira Recreio dos Bandeirantes —");
  for (const [i, d] of ["Recreio", "recreio", " RECREIO. "].entries()) {
    const R = "55219000099" + String(30 + i);
    novaSessao(R); consultas.length = 0;
    await cliente(R, d);
    const o = sessions[R].orcamento;
    checar(`"${d.trim()}" vira Recreio dos Bandeirantes, cidade Rio de Janeiro, segue para o salão`, o.bairro.toLowerCase() === "recreio dos bandeirantes" && o.cidade === "Rio de Janeiro" && sessions[R].step === "orcamento_salao", JSON.stringify([o.bairro, o.cidade, sessions[R].step]));
  }

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });
