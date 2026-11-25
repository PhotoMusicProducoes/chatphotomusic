// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\utils\revogacaoParabens.js
// 🔐 REVOGACAO DOS PARABENS pelo WhatsApp (25/11/2026, RJN - privacidade fase 2C).
//
// - "SAIR" (sozinho) vale em QUALQUER estado da conversa.
// - Pedidos naturais de parar as mensagens de aniversario/parabens tambem.
// - So revoga os PARABENS: nao pausa nem bloqueia o atendimento (o "sair" no
//   meio do orcamento continua sendo tratado como desistencia pelo index.js).
// - Grava LOCALMENTE (sobrevive a reinicio) E no PhotoMusic Pro, por
//   acrescimo. Se o PhotoMusic Pro estiver fora, a copia local ja barra o
//   envio (a rotina confere esta lista antes de cada mensagem).

const fs    = require("fs");
const path  = require("path");
const axios = require("axios");
const { PM_API_KEY } = require("./config");

const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(__dirname, "..");
const ARQUIVO  = path.join(DATA_DIR, "parabensRevogados.json");
const URL_REVOGAR = "https://photomusic.com.br/wp-json/photomusic/v1/comemoracao-revogar";

let revogados = {};   // ultimos 8 digitos -> { quando, sincronizado }
try {
  if (fs.existsSync(ARQUIVO)) revogados = JSON.parse(fs.readFileSync(ARQUIVO, "utf8")) || {};
} catch (e) {
  console.error("⚠️ parabensRevogados.json ilegivel:", e.message);
  revogados = {};
}

function salvar() {
  try {
    const tmp = ARQUIVO + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(revogados));
    fs.renameSync(tmp, ARQUIVO);
  } catch (e) {
    console.error("⚠️ Erro ao salvar parabensRevogados.json:", e.message);
  }
}

function chave(telefone) {
  const d = String(telefone || "").replace(/@.*/, "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
}

function normalizar(texto) {
  return String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

const PEDIDOS_NATURAIS = [
  /\bnao (quero|desejo) (mais )?receber (mais )?(as |essas |estas )?(mensage(m|ns) )?(de )?(parabens|aniversario|felicitac)/,
  /\b(parar|pare|para de|cancelar|cancela|tirar|tira|remover|remova) (de )?(receber |mandar |enviar )?(as |essas |estas |a )?(mensage(m|ns) )?(de )?(parabens|aniversario|felicitac)/,
  /\bnao (me )?(mande|manda|envie|envia) (mais )?(mensage(m|ns) de )?(parabens|aniversario|felicitac)/,
  /\b(sem|chega de) (mensage(m|ns) de )?(parabens|aniversario)\b/
];

/**
 * Devolve "sair" (a palavra sozinha), "natural" (pedido claro de parar os
 * parabens) ou "" (nao e pedido de revogacao).
 */
function pedidoDeRevogacao(texto) {
  const t = normalizar(texto);
  if (!t || t.length > 140) return "";
  if (t === "sair") return "sair";
  if (PEDIDOS_NATURAIS.some(r => r.test(t))) return "natural";
  return "";
}

function estaRevogadoLocal(telefone) {
  const k = chave(telefone);
  return !!(k && revogados[k]);
}

/* 🧪 Rodando um teste-*.js: nada vai ao disco nem ao PhotoMusic Pro (licao de
   15/11: teste do bot gravou pausados.json de verdade). */
const EM_TESTE = /teste-[^\\/]*\.js$/i.test(process.argv[1] || "");

/** Registra a revogacao (local primeiro, depois no PhotoMusic Pro). Nunca lanca. */
async function revogarParabens(telefone, trecho, deps = {}) {
  const k = chave(telefone);
  if (!k) return { local: false, remoto: false };
  if (EM_TESTE && !deps.post) {
    revogados[k] = { quando: Date.now(), sincronizado: false };
    return { local: true, remoto: false };
  }
  if (EM_TESTE) deps = { ...deps, semDisco: true };
  revogados[k] = { quando: Date.now(), sincronizado: false };
  if (!deps.semDisco) salvar();
  const post = deps.post || ((url, corpo, opts) => axios.post(url, corpo, opts));
  try {
    const numero = String(telefone).replace(/@.*/, "").replace(/\D/g, "");
    const r = await post(URL_REVOGAR, { telefone: numero, trecho: String(trecho || "").slice(0, 120) }, {
      timeout: 8000, headers: { "X-PM-Api-Key": PM_API_KEY || "" }
    });
    const ok = !!(r && r.data && r.data.registrado === true);
    revogados[k].sincronizado = ok;
    if (!deps.semDisco) salvar();
    return { local: true, remoto: ok };
  } catch (e) {
    console.error(`⚠️ Revogação dos parabéns de ${k} ficou só local: ${e.message}`);
    return { local: true, remoto: false };
  }
}

const RESPOSTA_REVOGACAO =
  "Pronto! Você não vai mais receber mensagens de aniversário da PhotoMusic. ❤️\n\n" +
  "Se precisar de qualquer coisa, é só chamar por aqui.";

const RODAPE_COMO_PARAR = "\n\n_Para não receber mais mensagens de aniversário, responda SAIR._";

/* Rodape com o LINK de nao receber mais (Mario, 25/11/2026), gerado pelo
   PhotoMusic Pro. So aceita link do proprio dominio; sem link valido, fica
   o SAIR (que funciona sempre). */
function rodapeComoParar(link) {
  const ok = typeof link === "string" && /^https:\/\/photomusic\.com\.br\/\?pm_parabens_sair=[a-f0-9]{32}$/.test(link);
  if (!ok) return RODAPE_COMO_PARAR;
  return "\n\n_Para não receber mais mensagens de aniversário, responda SAIR ou toque aqui:_\n" + link;
}

module.exports = {
  pedidoDeRevogacao, revogarParabens, estaRevogadoLocal,
  RESPOSTA_REVOGACAO, RODAPE_COMO_PARAR, rodapeComoParar,
  _limparParaTeste: () => { revogados = {}; }
};
