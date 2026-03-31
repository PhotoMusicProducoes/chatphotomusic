// services/eventos.js
// Funções para fluxo de download de fotos de eventos
// Versão 2.0 — lê da API WordPress (PhotoMusic Pro) em vez do arquivo .txt

const fetch = require("node-fetch");
const { sendText, sendTyping } = require("../utils/index.js");
const { PM_API_BASE, PM_API_KEY } = require("../utils/config.js");

// ======================================================
// BUSCA OS EVENTOS ATIVOS NO WORDPRESS
// Endpoint: GET /wp-json/photomusic/v1/eventos-chatbot
// Retorna apenas eventos com chatbot_ativo = 1
// ======================================================
async function buscarEventos() {
  try {
    const url = `${PM_API_BASE}/eventos-chatbot`;

    const response = await fetch(url, {
      headers: {
        "X-PM-API-Key": PM_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("❌ Erro ao buscar eventos da API WordPress:", response.status, response.statusText);
      return [];
    }

    const dados = await response.json();

    if (!Array.isArray(dados) || dados.length === 0) {
      console.log("ℹ️ Nenhum evento ativo no ChatBot no momento.");
      return [];
    }

    // Normaliza para o formato interno usado pelo fluxo
    return dados.map((e) => ({
      numero: e.numero,        // "1", "2", "3"...
      nome:   e.nome,          // nome do evento (ex: "Casamento João e Maria")
      titulo: e.titulo,        // nome + data formatada
      links:  e.links || [],   // array de { nome, tipo, link }
      id:     e.id,
    }));

  } catch (error) {
    console.error("❌ Erro ao conectar com a API WordPress:", error.message);
    return [];
  }
}

// ======================================================
// MONTA A MENSAGEM DO EVENTO ESCOLHIDO
// ======================================================
async function apresentarEvento(numeroEvento) {
  const eventos = await buscarEventos();
  const evento = eventos.find((e) => e.numero === String(numeroEvento));

  if (!evento) {
    return "Evento não encontrado. Verifique o número digitado!";
  }

  let resposta = `🎉 *${evento.titulo}*\n\n`;

  if (!evento.links || evento.links.length === 0) {
    resposta += "Nenhum link disponível para este evento no momento.\n\n";
  } else {
    for (const link of evento.links) {
      resposta += `📁 *${link.nome}*\n`;
      resposta += `🔗 ${link.link}\n\n`;
    }
  }

  resposta +=
    `Siga a nossa página✨ \n` +
    `🚨 *Instagram PhotoMusic* \n` +
    `https://instagram.com/photomusicproducoes \n\n` +
    `[*Link para avaliação no Google*] \n` +
    `https://g.page/r/CVcwPOqAtId5EBM/review \n\n` +
    `Muitíssimo obrigado🥳`;

  return resposta;
}

// ======================================================
// FLUXO PRINCIPAL PARA O MENU "6 - BAIXAR MINHA FOTO"
// ======================================================
async function fluxoEventos(chatId, session) {
  const eventos = await buscarEventos();

  if (eventos.length === 0) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Nenhum evento disponível no momento. Tente novamente mais tarde!"
    );
    return;
  }

  // Se só há 1 evento, apresenta direto sem pedir número
  if (eventos.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(eventos[0].numero));
    session.step = "aguardando_opcao";
    return;
  }

  // Mais de 1 evento — monta menu de escolha
  let mensagem = "Qual evento você está participando? Digite apenas o número:\n\n";

  eventos.forEach((e) => {
    mensagem += `*${e.numero}* - ${e.nome}\n`;
  });

  await sendTyping(chatId);
  await sendText(chatId, mensagem);

  session.step = "aguardando_numero_evento";
  session.eventosLista = eventos;
}

module.exports = {
  buscarEventos,
  apresentarEvento,
  fluxoEventos,
};
