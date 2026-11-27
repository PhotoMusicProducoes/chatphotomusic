// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\jobs\mensagemDiaFesta.js
/* 🎉 "CHEGOU O GRANDE DIA" (26/11/2026, Mario + parecer do ChatGPT)
   Pela manha do dia do evento, o contratante recebe a mensagem da festa.
   E ATENDIMENTO do evento contratado, separado da rotina anual de parabens
   (que segue desligada e exige autorizacao). O PhotoMusic Pro decide QUEM
   recebe e manda o texto pronto: evento confirmado, de hoje, nao cancelado,
   nao teste, so o contratante, sem bloqueio e sem SAIR. Chave propria la.
   Aqui, antes de CADA envio: pausas do bot, pausa especial, SAIR local e uma
   2a conferencia no PhotoMusic Pro (o evento pode ter mudado). Falha = nao envia. */

const axios = require("axios");
const cron = require("node-cron");
const { esperaEntreEnvios } = require("../utils/intervaloEnvio.js");
const { sendText } = require("../utils/index.js");
const { marcarComemorativa } = require("../utils/carinho.js");
const { PM_API_KEY } = require("../utils/config");
const { estaPausado } = require("../utils/pauseControl.js");
const { estaPausadoEspecial } = require("../utils/pausaEspecialControl.js");
const { estaRevogadoLocal } = require("../utils/revogacaoParabens.js");

const URL_LISTA   = "https://photomusic.com.br/wp-json/photomusic/v1/festa-do-dia";
const URL_ENVIADO = "https://photomusic.com.br/wp-json/photomusic/v1/festa-do-dia-enviado";
const HORARIO     = "30 8 * * *";          // 8h30
const FUSO        = "America/Sao_Paulo";

function chatIdDe(telefone) {
  const t = String(telefone || "").replace(/\D+/g, "");
  return t.length >= 12 ? `${t}@c.us` : "";
}

/** Pode enviar agora? "" = pode; senao o motivo. Qualquer erro = nao envia. */
async function conferir(item, deps = {}) {
  const pausado  = deps.estaPausado || estaPausado;
  const especial = deps.estaPausadoEspecial || estaPausadoEspecial;
  const revogado = deps.estaRevogadoLocal || estaRevogadoLocal;
  const get      = deps.get || ((url, opts) => axios.get(url, opts));
  try {
    const chatId = chatIdDe(item && item.telefone);
    if (!chatId) return "telefone_invalido";
    if (!item.mensagem || typeof item.mensagem !== "string") return "sem_mensagem";
    if (pausado(chatId)) return "pausado_no_bot";
    if (especial(chatId)) return "pausa_especial";
    if (revogado(chatId)) return "revogou_no_whatsapp";
    // 2a conferencia, na hora: o evento ainda vale e ainda nao foi enviado?
    const r = await get(URL_LISTA, {
      timeout: 8000,
      headers: { "X-PM-Api-Key": PM_API_KEY || "" },
      params: { id_evento: item.id_evento }
    });
    const d = r && r.data;
    if (!d || d.ativo !== true || !Array.isArray(d.lista)) return "desligada_ou_resposta_invalida";
    const ok = d.lista.some(x => x && Number(x.id_evento) === Number(item.id_evento));
    return ok ? "" : "evento_nao_vale_mais";
  } catch (e) {
    return "falha_conferencia";
  }
}

async function executarDiaFesta(deps = {}) {
  // 27/11: WhatsApp desconectado = a rotina PAUSA sem marcar nada como enviado (a do dia roda sozinha ao reconectar)
  if (require("../utils/conexaoZapi.js").pausarSeDesconectado("dia da festa", () => executarDiaFesta())) return;
  const get   = deps.get   || ((url, opts) => axios.get(url, opts));
  const post  = deps.post  || ((url, body, opts) => axios.post(url, body, opts));
  const enviar = deps.sendText || sendText;
  const esperar = deps.esperar || (ms => new Promise(r => setTimeout(r, ms)));
  const res = { enviadas: 0, barradas: 0, erros: 0 };
  let lista = [];
  try {
    const r = await get(URL_LISTA, { timeout: 10000, headers: { "X-PM-Api-Key": PM_API_KEY || "" } });
    const d = r && r.data;
    if (!d || d.ativo !== true) { console.log("🎉 Dia da festa: desligado no PhotoMusic Pro."); return res; }
    lista = Array.isArray(d.lista) ? d.lista : [];
  } catch (e) {
    console.log("🎉 Dia da festa: nao consegui ler a lista, nada enviado.");
    return res;
  }
  console.log(`🎉 Dia da festa: ${lista.length} evento(s) hoje.`);
  let idx = 0;
  for (const item of lista) {
    const motivo = await conferir(item, deps);
    if (motivo) { res.barradas++; console.log(`   ⛔ evento ${item && item.id_evento}: ${motivo}`); continue; }
    try {
      const chatId = chatIdDe(item.telefone);
      const saiu = await enviar(chatId, item.mensagem);
      // 27/11: nao saiu (desconectado/falha) = nao marca: sai na repescagem ou no proximo dia
      if (saiu === false) throw new Error("a mensagem nao saiu");
      res.enviadas++;
      try { (deps.marcarComemorativa || marcarComemorativa)(chatId, item.mensagem); } catch (e) {}
      try {
        await post(URL_ENVIADO, { id_evento: item.id_evento }, { timeout: 8000, headers: { "X-PM-Api-Key": PM_API_KEY || "" } });
      } catch (e) {
        console.log(`   ⚠️ evento ${item.id_evento}: enviada, mas nao consegui marcar no PhotoMusic Pro.`);
      }
      idx++;
      await esperar(esperaEntreEnvios(idx));
    } catch (e) {
      res.erros++;
    }
  }
  console.log(`🎉 Dia da festa: ${res.enviadas} enviada(s), ${res.barradas} barrada(s), ${res.erros} erro(s).`);
  return res;
}

let tarefa = null;
function inicializarDiaFesta() {
  if (tarefa) tarefa.stop();
  tarefa = cron.schedule(HORARIO, () => { executarDiaFesta().catch(() => {}); }, { timezone: FUSO });
  console.log(`🎉 Mensagem do dia da festa agendada (${HORARIO}, ${FUSO}). Liga e desliga no PhotoMusic Pro.`);
}

module.exports = { inicializarDiaFesta, executarDiaFesta, conferir, chatIdDe };
