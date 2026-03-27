// services/eventos.js
// Fluxo de download/visualização de fotos — lê eventos do banco de dados WordPress

const { sendText, sendTyping } = require("../utils/index.js");
const { PM_SITE_URL, PM_API_KEY } = require("../utils/config.js");

// ======================================================
// ÍCONES POR TIPO DE SERVIÇO
// ======================================================
const TIPO_ICONE = {
  foto_cabine : "📸",
  totem       : "🏛️",
  "360"       : "🎡",
  paparazzi   : "🎭",
  lembranca   : "🖼️",
  video       : "🎥",
  gif         : "🎞️",
  outro       : "📎",
};

// ======================================================
// BUSCA OS EVENTOS DE HOJE NO BANCO DE DADOS WORDPRESS
// ======================================================
async function buscarEventos() {
  try {
    const url = `${PM_SITE_URL}/wp-json/photomusic/v1/eventos-hoje`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-PM-API-Key": PM_API_KEY,
        "Accept"       : "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `[Eventos] Erro na API WordPress: HTTP ${response.status} → ${url}`
      );
      return [];
    }

    const dados = await response.json();

    if (!Array.isArray(dados)) {
      console.error("[Eventos] Resposta da API não é um array:", dados);
      return [];
    }

    console.log(`[Eventos] ${dados.length} evento(s) encontrado(s) hoje.`);
    return dados;

  } catch (error) {
    console.error("[Eventos] Erro ao buscar eventos:", error.message);
    return [];
  }
}

// ======================================================
// MONTA A MENSAGEM DO EVENTO ESCOLHIDO
// ======================================================
async function apresentarEvento(numeroEvento) {

  const eventos = await buscarEventos();

  // Aceita busca por número (string "1", "2"...) ou por id numérico
  const evento = eventos.find(
    (e) => e.numero === String(numeroEvento) || e.id === Number(numeroEvento)
  );

  if (!evento) {
    return "Evento não encontrado. Verifique o número digitado!";
  }

  // Cabeçalho
  let resposta = `🎉 *${evento.nome}*\n\n`;

  // Links por serviço
  if (evento.servicos && evento.servicos.length > 0) {

    for (const servico of evento.servicos) {
      const icone = TIPO_ICONE[servico.tipo] || "📎";
      resposta += `${icone} *${servico.nome}*\n`;
      resposta += `${servico.link}\n\n`;
    }

    // Instruções de download (mantidas do fluxo original)
    resposta += `*Passo a Passo para baixar a foto 🖼️:*\n`;
    resposta += `*1º* Salve o Contato 21964428172;\n`;
    resposta += `*2º* Clique no link acima;\n`;
    resposta += `*3º* Procure sua foto;\n`;
    resposta += `*4º* Clique na foto;\n`;
    resposta += `*5º* Clique na seta ⬇️ acima da foto 🖼️ para baixar.\n\n`;

    resposta += `*OBS:* No *Android* a foto é salva direto na galeria. `;
    resposta += `No *iPhone*, escolha "Salvar imagem" para salvar na galeria `;
    resposta += `ou "Salvar arquivo" para salvar em Arquivos.\n\n`;

  } else {
    resposta += `⚠️ Links de fotos ainda não disponíveis para este evento.\n\n`;
  }

  // Rodapé
  resposta += `Siga a nossa página✨\n`;
  resposta += `🚨 *Instagram PhotoMusic*\n`;
  resposta += `https://instagram.com/photomusicproducoes\n\n`;
  resposta += `[*Link para avaliação no Google*]\n`;
  resposta += `https://g.page/r/CVcwPOqAtId5EBM/review\n\n`;
  resposta += `Muitíssimo obrigado 🥳`;

  return resposta;
}

// ======================================================
// FLUXO PRINCIPAL PARA O MENU "6 - BAIXAR MINHA FOTO"
// ======================================================
async function fluxoEventos(chatId, session) {

  const eventos = await buscarEventos();

  // Sem eventos hoje
  if (eventos.length === 0) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      "😕 Não encontrei eventos cadastrados para hoje.\n\n" +
      "Se você está em um evento, entre em contato diretamente: *21964428172*"
    );
    session.step = "aguardando_opcao";
    return;
  }

  // Apenas 1 evento → envia direto
  if (eventos.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(eventos[0].numero));
    session.step = "aguardando_opcao";
    return;
  }

  // Vários eventos → lista para o usuário escolher
  let mensagem = "Qual evento você está participando? Digite apenas o número:\n\n";

  eventos.forEach((e) => {
    mensagem += `*${e.numero}* — ${e.nome}\n`;
  });

  await sendTyping(chatId);
  await sendText(chatId, mensagem);

  session.step        = "aguardando_numero_evento";
  session.eventosLista = eventos;
}

// ======================================================
// EXPORTA AS FUNÇÕES
// ======================================================
module.exports = {
  buscarEventos,
  apresentarEvento,
  fluxoEventos,
};
