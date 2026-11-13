// teste-bairro-sugestao-google.js - bairro FORA da tabela: o Google sugere a cidade e o bot so CONFIRMA com 1 toque (12/11/2026)
// O plugin e simulado (nenhuma chamada real). Rodar:  node teste-bairro-sugestao-google.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
const axios = require("axios");
axios.post = async () => ({ data: {} });
// o que o endpoint /deslocamento-consultar responde, por bairro
const RESP = {
  "Ipanema":      { status: "encontrado", bairro: "Ipanema", cidade: "Rio de Janeiro", valor: 100, cidades_do_bairro: ["Rio de Janeiro"] },
  "Icaraí":       { status: "nao_encontrado", bairro: "Icaraí", cidade: "", sugestao_cidade: { bairro: "Icaraí", cidade: "Niterói" } },
  "Centro":       { status: "nao_encontrado", bairro: "Centro", cidade: "", sugestao_cidade: { bairro: "Centro", cidade: "Rio de Janeiro" } },
  "Bairro Xyzzy": { status: "nao_encontrado", bairro: "Bairro Xyzzy", cidade: "" },
  "Piabeta":      { status: "nao_encontrado", bairro: "Piabeta", cidade: "", sugestao_cidade: { bairro: "Acari", cidade: "Rio de Janeiro" } },
};
axios.get = async (url, cfg) => ({ data: RESP[(cfg && cfg.params && cfg.params.bairro) || ""] || { status: "nao_encontrado" } });

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 250)}`); if (!ok) falhas++; }
let CHAT = "5521900000090";
const sess = () => sessions[CHAT] || {};
async function bairro(texto) {
  CHAT = "55219000000" + String(10 + (++seq)).slice(-2);
  sessions[CHAT] = { step: "orcamento_bairro", orcamento: { nome: "Ana", servicosEnviados: [], celebracaoId: 4, convidados: 100 }, menuInicialEnviado: true };
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "bg-" + seq, text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
async function resp(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "bg-r" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}

(async () => {
  let r = await bairro("Ipanema");
  checar("bairro da tabela e único: segue direto para o salão (como sempre)", sess().step === "orcamento_salao" && sess().orcamento.cidade === "Rio de Janeiro", sess().step);

  r = await bairro("Icaraí");
  checar("bairro FORA da tabela: o Google sugere e o bot CONFIRMA com 1 toque", sess().step === "orcamento_cidade_confirmar" && /Icaraí.*Niterói/.test(r), sess().step + " | " + r);
  r = await resp("1");
  checar("confirmou: grava bairro e cidade e vai ao salão", sess().step === "orcamento_salao" && sess().orcamento.cidade === "Niterói" && sess().orcamento.bairro === "Icaraí", JSON.stringify(sess().orcamento));

  r = await bairro("Icaraí");
  r = await resp("2");
  checar("'É em outra cidade': pergunta a cidade, sem usar a sugestão", sess().step === "orcamento_cidade" && !sess().orcamento.cidade, sess().step);

  r = await bairro("Centro");
  checar("nome ambíguo (Centro): NÃO deduz, pergunta a cidade", sess().step === "orcamento_cidade", sess().step + " | " + r);

  r = await bairro("Bairro Xyzzy");
  checar("Google sem resposta: pergunta a cidade como sempre", sess().step === "orcamento_cidade", sess().step);

  r = await bairro("Piabeta");
  checar("Google devolveu OUTRO bairro (Acari): descarta a sugestão e pergunta a cidade", sess().step === "orcamento_cidade", sess().step + " | " + r);

  if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8");
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error("💥", e); process.exit(1); });
