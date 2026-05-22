// services/somDJ.js — NOVA VERSÃO OTIMIZADA

const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");

// ======================================================
// MENSAGEM DE ABERTURA POR TIPO DE EVENTO
// ======================================================
function mensagemAbertura(clb) {
  switch (clb) {
    case 1: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para sua festa de debutante.";
    case 2: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para o seu casamento.";
    case 3: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para o aniversário infantil.";
    case 4: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para o aniversário adolescente.";
    case 5: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para o aniversário adulto.";
    case 6: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para suas Bodas.";
    case 7: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para sua Formatura.";
    case 8: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para seu Evento Corporativo.";
    case 9: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para seu evento.";
    default: return "O serviço de *Som Completo com DJ e Iluminação* é uma excelente escolha para seu evento.";
  }
}

// ======================================================
// TABELA DE ARQUIVOS DO SERVIÇO
// ======================================================
const arquivosSomDJ = {
  fotos2Caixas: [
    urlBase2 + "somdjfoto2caixas1.jpg",
    urlBase2 + "somdjfoto2caixas2.jpg",
    urlBase2 + "somdjfoto2caixas3.jpg",
    urlBase2 + "somdjfoto2caixas4.jpg",
    urlBase2 + "somdjfoto2caixas5.jpg"
  ],

  fotos4Caixas: [
    urlBase2 + "somdjfoto4caixas1.jpg",
    urlBase2 + "somdjfoto4caixas2.jpg",
    urlBase2 + "somdjfoto4caixas3.jpg",
    urlBase2 + "somdjfoto4caixas4.jpg"
  ],

  videos: [
    urlBase2 + "somedjvideo1.mp4",
    urlBase2 + "somedjvideo2.mp4",
    urlBase2 + "somedjvideo3.mp4",
    urlBase2 + "somedjvideo4.mp4",
    urlBase2 + "somedjvideo5.mp4",
    urlBase2 + "somedjvideo6.mp4",
    urlBase2 + "somedjvideo7.mp4",
    urlBase2 + "somedjvideo8.mp4",
    urlBase2 + "somedjvideo9.mp4"
  ],

  contratar: urlBase + "comocontratar.mp3"
};

// ======================================================
// TABELA DE PDFs POR EVENTO
// ======================================================
const orcamentosSomDJ = {
  1: urlBase3 + "orcamentoSomDJ15Anos.pdf",
  2: urlBase3 + "orcamentoSomDJCasamento.pdf",
  3: urlBase3 + "orcamentoSomDJAniversario.pdf",
  4: urlBase3 + "orcamentoSomDJAniversarioAdolescente.pdf",
  5: urlBase3 + "orcamentoSomDJAniversario.pdf",
  6: urlBase3 + "orcamentoSomDJOutros.pdf",
  7: urlBase3 + "orcamentoSomDJOutros.pdf",
  8: urlBase3 + "orcamentoSomDJCorporativo.pdf",
  9: urlBase3 + "orcamentoSomDJOutros.pdf"
};

// ======================================================
// FUNÇÃO — Envia o fluxo completo do Som com DJ e Iluminação
// ======================================================
async function enviarFluxoSomDJ(chatId, clb) {

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(chatId, `*<<<< SOM COMPLETO COM DJ >>>>*`);

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, mensagemAbertura(clb));

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "🎧✨ Nosso DJ toca todos os ritmos, garantindo que cada momento seja inesquecível e que todos os convidados aproveitem a pista de dança."
  );

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(
    chatId,
    "🎁 *Brindes Exclusivos:*\n" +
    "💡 Iluminação cativante para criar uma atmosfera mágica.\n" +
    "🎵 Criamos uma playlist exclusiva baseada no seu gosto musical.\n" +
    "📱 Você também pode enviar sua playlist do Spotify.\n"
  );

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(
    chatId,
    "⏰ *Pacote Especial:* 4 horas de som + 1 hora de brinde (total 5 horas)."
  );

  // Equipamento
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "📸 Confira algumas fotos dos nossos Equipamento");

  // Fotos 2 caixas
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "📸 *Estrutura com 2 Caixas de Som ativas*");

  for (const foto of arquivosSomDJ.fotos2Caixas) {
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, foto, "IMAGE", "");
  }

  // Fotos 4 caixas
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "📸 *Estrutura com 4 caixas de Som - 2 Caixas de Voz e 2 Caixas de Subgrave*");

  for (const foto of arquivosSomDJ.fotos4Caixas) {
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, foto, "IMAGE", "");
  }

  // Vídeos
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "🎬 Veja nosso serviço em ação:");

  for (const video of arquivosSomDJ.videos) {
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, video, "VIDEO", "");
  }

  // Como contratar
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "💼 Como contratar nossos serviços:");
  await sendFileByUrl(chatId, arquivosSomDJ.contratar, "AUDIO", "");
}

// ======================================================
// FUNÇÃO PRINCIPAL — enviarSomDJ()
// ======================================================
async function enviarSomDJ(chatId, clb, convidados, sessionsRef, operatorPaused) {

  if (operatorPaused || estaPausado(chatId)) return;

  if (sessionsRef[chatId]?.enviandoSomDJ) {
    console.log(`⚠️ Já está enviando Som DJ para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoSomDJ = true;

  try {
    const orc = sessionsRef[chatId]?.orcamento || {};
    const dias = orc.dias || 1;

    // ======================================================
    // REGRA CORPORATIVA
    // ======================================================
    if (clb === 8 && dias > 1) {
      await sendTyping(chatId);
      if (estaPausado(chatId)) return;

      await sendText(
        chatId,
        "Estamos preparando um *orçamento especial* para o seu evento corporativo. Em breve entraremos em contato com mais detalhes. 😊"
      );
      return;
    }

    // ======================================================
    // FLUXO COMPLETO
    // ======================================================
    await enviarFluxoSomDJ(chatId, clb);
    if (estaPausado(chatId)) return;

    // ======================================================
    // ENVIO DO PDF
    // ======================================================
    const pdf = orcamentosSomDJ[clb];

    await sendTyping(chatId);
    if (estaPausado(chatId)) return;

    await sendText(
      chatId,
      `💰 Segue o arquivo com o orçamento do *Som Completo com DJ* 🎶✨`
    );

    await sendTyping(chatId);
    if (estaPausado(chatId)) return;

    // Envia o PDF
    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Som-DJ",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 7 }
    );

    // ======================================================
    // DESLOCAMENTO
    // ======================================================
    await sendTyping(chatId);
    if (estaPausado(chatId)) return;

    await sendText(
      chatId,
      "🚗 *Observação importante sobre deslocamento*\n" +
      "O custo de deslocamento **não está incluso** neste orçamento.\n" +
      "Ele será calculado e enviado posteriormente de acordo com o local informado."
    );

  } catch (error) {
    console.error(`❌ Erro ao enviar Som DJ para ${chatId}:`, error);

    if (!estaPausado(chatId)) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento do Som DJ. Tente novamente.");
    }

  } finally {
    if (sessionsRef[chatId]) {
      sessionsRef[chatId].enviandoSomDJ = false;

      if (!sessionsRef[chatId].servicosEnviados.includes(7)) {
        sessionsRef[chatId].servicosEnviados.push(7);
      }
    }
  }
}

module.exports = { enviarSomDJ };