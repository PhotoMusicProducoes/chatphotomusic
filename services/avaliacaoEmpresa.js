// services/avaliacaoEmpresa.js — CommonJS

const { sendText, sendTyping, sendFileByUrl, sendLinkPreview } = require("../utils/index.js");
const { urlBase } = require("../utils/config.js");
const { enviarYoutube } = require("../utils/youtubeUtils.js");
const { estaPausado } = require("../utils/pauseControl.js");

// Delay entre envios para evitar conflito na Z-API
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const urlsAvaliacao = {
  infoempresa: urlBase + "infoempresa.mp3",
  avaliacao1: urlBase + "avaliacao1.jpg",
  avaliacao2: urlBase + "avaliacao2.jpg",
  avaliacao3: urlBase + "avaliacao3.jpg",
  avaliacao4: urlBase + "avaliacao4.jpg",
  avaliacao5: urlBase + "avaliacao5.jpg",
  avaliacao6: urlBase + "avaliacao6.jpg",
  agradecimentocliente1: urlBase + "agradecimentocliente1.mp3",
  agradecimentocliente2: urlBase + "agradecimentocliente2.mp3",
};

async function enviarAvaliacaoEmpresa(chatId, sessions) {

  if (sessions[chatId]?.enviandoAvaliacao) {
    console.log(`⚠️ Já está enviando avaliação para ${chatId}`);
    return;
  }

  sessions[chatId].enviandoAvaliacao = true;

  try {

    // Função auxiliar para permitir pausa sem travar o fluxo
    const interromper = () => estaPausado(chatId);

    while (true) {

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "*Gratidão por solicitar nosso orçamento!!!😍🥳*");
      await delay(600);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "*Desejo que Deus abençoe grandiosamente, toda preparação para este dia super especial!!!🙏🙏🙏*");
      await delay(600);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.infoempresa);
      await delay(800);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "*Somos a empresa mais bem avaliada no Google no Estado do RJ e em todo Brasil😍🥳*");
      await delay(600);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.avaliacao1);
      await delay(800);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "Seguem algumas avaliações do Google 😍🥳");
      await delay(600);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.avaliacao2);
      await delay(800);

      if (interromper()) break;
      await sendFileByUrl(chatId, urlsAvaliacao.avaliacao3);
      await delay(800);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.avaliacao4);
      await delay(800);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.avaliacao5);
      await delay(800);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.avaliacao6);
      await delay(800);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "Seguem vídeos e áudios de depoimentos e agradecimentos");
      await delay(600);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "*Depoimento da Foto Cabine PhotoMusic Produções*");
      
      await sendTyping(chatId);
      await delay(600);
      
      await enviarYoutube(chatId, "https://youtube.com/shorts/9pX4YZGS8lc");
      await delay(300);

      await sendTyping(chatId);
      await delay(300);
      if (interromper()) return;
      await sendText(chatId, "*Depoimentos dos nossos clientes pela nossa Foto Cabine e Plataforma 360º*");
      
      await sendTyping(chatId);
      await delay(600);
      
      await enviarYoutube(chatId, "https://youtube.com/shorts/ZprUmUp8BSY");
      await delay(300);

      await sendTyping(chatId);
      if (interromper()) return;
      await sendText(chatId, "*Ouça agora um agradecimento muito especial de uma das nossas clientes 🥰*");
      await delay(600);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.agradecimentocliente1);
      await delay(800);

      if (interromper()) return;
      await sendFileByUrl(chatId, urlsAvaliacao.agradecimentocliente2);
      await delay(800);

      break; // encerra normalmente
    }

  } finally {
    // 🔥 GARANTE que o flag SEMPRE é liberado
    if (sessions[chatId]) {
      sessions[chatId].enviandoAvaliacao = false;
    }
  }
}

module.exports = { enviarAvaliacaoEmpresa };
