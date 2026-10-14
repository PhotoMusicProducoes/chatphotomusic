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
 * Evento de vários dias: o motor recebe só a 1ª data (`data_evento`) e o nº de
 * dias, então as datas todas vão em "particularidades" e saem no PDF. Sem isso o
 * cliente de 08 e 09/12 lia uma proposta com uma data só. (13/10/2026.)
 */
/* 🚨 UM DIA DE CADA JEITO (13/10/2026). O bot JA perguntava data e horario
   de cada dia (`orcamento_dia_data`, `_hora_inicio`, `_hora_fim`) e guardava
   tudo em `diasDetalhes` - mas mandava para o gerador so as DATAS, como texto
   solto dentro de `particularidades`. O calculo saia por UMA duracao
   multiplicada pelos dias, entao um corporativo com um dia de 4h e outro de
   12h era cobrado como se todos fossem do maior periodo.
   Agora vai estruturado, no mesmo formato que o formulario do site usa, e o
   gerador soma dia a dia (`preco_todos_os_dias`).
   📌 `datasCorporativo` e o caso "mesmo horario todos os dias": sao so as
   datas, sem hora. Vao assim mesmo - o motor completa cada dia com a duracao
   do evento, que e justamente o que "mesmo horario" quer dizer. */
function diasDetalhe(orc) {
  if (Array.isArray(orc.diasDetalhes) && orc.diasDetalhes.length) {
    return orc.diasDetalhes
      .filter(d => d && (d.data || d.horaInicio))
      .map(d => ({
        data:   d.data || "",
        inicio: d.horaInicio || "",
        fim:    d.horaFim || ""
      }));
  }
  if (Array.isArray(orc.datasCorporativo) && orc.datasCorporativo.length > 1) {
    return orc.datasCorporativo
      .filter(Boolean)
      .map(data => ({ data, inicio: "", fim: "" }));
  }
  return [];
}

function datasDoEvento(orc) {
  if (Array.isArray(orc.datasCorporativo) && orc.datasCorporativo.length > 1) {
    return "Datas do evento: " + orc.datasCorporativo.join(", ") + ".";
  }
  if (Array.isArray(orc.diasDetalhes) && orc.diasDetalhes.length > 1) {
    return "Datas do evento: " + orc.diasDetalhes.map(d => d.data).filter(Boolean).join(", ") + ".";
  }
  return "";
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
    /* 🚨 DOIS PERIODOS NO MESMO DIA (13/10/2026). Com periodos o par
       inicio/termino SAI: era ele que fazia o gerador cobrar as horas
       CORRIDAS entre o comeco da manha e o fim da noite - um evento de 4h30
       de trabalho virava 14h de conta. O motor ja aceitava `periodos`; quem
       nao perguntava era este bot. */
    hora_inicio:      orc.periodos && orc.periodos.length >= 2 ? "" : (orc.horaInicio || ""),
    hora_termino:     orc.periodos && orc.periodos.length >= 2 ? "" : (orc.horaFim || ""),
    periodos:         (orc.periodos && orc.periodos.length >= 2) ? orc.periodos : [],
    dias_detalhe:     diasDetalhe(orc),
    /* Com periodos a duracao vem deles; mandar `horas` aqui faria o motor
       usar a conta corrida de novo, desfazendo o ganho acima. */
    horas:            (orc.periodos && orc.periodos.length >= 2)
                        ? 0
                        : (Number.parseInt(orc.horas, 10) || Number.parseInt(orc.duracao, 10) || 0),
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
    particularidades: [datasDoEvento(orc), orc.detalhes || ""].filter(Boolean).join("\n")
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
