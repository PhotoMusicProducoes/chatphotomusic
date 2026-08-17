// utils/orcamentoApi.js
// Fala com o endpoint de orçamento do PhotoMusic Pro (WordPress) e devolve o
// PDF gerado na hora. É a alternativa aos PDFs estáticos que o bot manda hoje.
//
// 🚨 SERVIÇO SEMPRE POR SLUG, NUNCA POR ID.
// O endpoint lê "servicos" como dígitos do menu do bot, então o id 13 do Totem
// Retrô seria lido como 1 e 3 (Foto Cabine + Plataforma 360). Por slug não tem
// essa ambiguidade. Slugs válidos vêm do GET /orcamento-servicos.

const axios = require("axios");
const { PM_API_BASE, PM_API_KEY } = require("./config.js");

// O cálculo pode bater no Google Maps do deslocamento e o PDF do caso mais
// pesado (todos os serviços) levou 6 segundos no teste. 180s é folga proposital.
const TIMEOUT_MS = 180000;

// Só dígitos: o chatId vem como "5521999999999@c.us".
function telefoneDoChatId(chatId) {
  return String(chatId || "").replace(/\D+/g, "");
}

/**
 * Gera um orçamento no PhotoMusic Pro a partir dos dados que o bot já coletou.
 *
 * @param {object}   session  sessão do cliente (usa session.orcamento)
 * @param {string}   chatId   id do WhatsApp, vira o telefone do orçamento
 * @param {string[]} slugs    slugs dos serviços, ex: ["totem-retro"]
 * @returns {Promise<{id:number,url:string,total:number,horas:number,servicos:string[],ignorados:string[]}>}
 * @throws  Error com .codigo quando o endpoint recusa (data_no_passado, etc.)
 */
async function gerarOrcamento(session, chatId, slugs) {
  if (!PM_API_KEY) {
    const e = new Error("PM_API_KEY não configurada no .env");
    e.codigo = "sem_chave";
    throw e;
  }

  const orc = (session && session.orcamento) || {};

  const corpo = {
    celebracao:       orc.celebracaoId,
    data_evento:      orc.data || "",
    hora_inicio:      orc.horaInicio || "",
    hora_termino:     orc.horaFim || "",
    horas:            Number.parseInt(orc.horas, 10) || Number.parseInt(orc.duracao, 10) || 0,
    publico:          Number.parseInt(orc.convidados, 10) || 0,
    dias:             Number.parseInt(orc.dias, 10) || 1,
    servicos:         slugs,
    cliente_nome:     orc.nome || "",
    cliente_telefone: telefoneDoChatId(chatId),
    empresa:          orc.empresa || "",
    bairro:           orc.bairro || "",
    cidade:           orc.cidade || "",
    estado:           "RJ",
    local_evento:     orc.salao || "",
    particularidades: orc.detalhes || ""
  };

  console.log(`🧾 [orcamentoApi] Pedindo orçamento de [${slugs.join(", ")}] para ${chatId}`);

  try {
    const resp = await axios.post(`${PM_API_BASE}/orcamento`, corpo, {
      timeout: TIMEOUT_MS,
      headers: {
        "X-PM-API-Key": PM_API_KEY,
        "Content-Type": "application/json"
      }
    });

    const dados = resp.data || {};
    if (!dados.url) {
      const e = new Error("Endpoint respondeu sem URL de PDF");
      e.codigo = "sem_url";
      throw e;
    }

    console.log(
      `✅ [orcamentoApi] Orçamento ${dados.id} gerado: R$ ${dados.total} — ${dados.url}`
    );

    return dados;

  } catch (erro) {
    // O endpoint devolve { status, codigo, erro } no corpo. Vale mais que a
    // mensagem crua do axios ("status code 400") na hora de ler o log do Fly.
    const corpoErro = erro.response && erro.response.data;
    const codigo    = (corpoErro && corpoErro.codigo) || erro.codigo || "falha_rede";
    const detalhe   = (corpoErro && corpoErro.erro) || erro.message;

    console.error(`🚨 [orcamentoApi] ${codigo}: ${detalhe}`);

    const e = new Error(detalhe);
    e.codigo = codigo;
    throw e;
  }
}

module.exports = { gerarOrcamento };
