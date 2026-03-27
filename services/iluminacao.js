// services/iluminacao.js — VERSÃO FINAL COM PAUSA NOVA
// Serviço complementar: Iluminação de Pista de Dança

const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");

// ======================================================
// MENSAGEM DE ABERTURA POR TIPO DE EVENTO
// ======================================================
function mensagemAberturaIluminacao(clb) {
  switch (clb) {
    case 1: return "A *Iluminação de Pista de Dança* é uma excelente escolha para sua festa de debutante.";
    case 2: return "A *Iluminação de Pista de Dança* é uma excelente escolha para o seu casamento.";
    case 3: return "A *Iluminação de Pista de Dança* é uma excelente escolha para o aniversário infantil.";
    case 4: return "A *Iluminação de Pista de Dança* é uma excelente escolha para o aniversário adolescente.";
    case 5: return "A *Iluminação de Pista de Dança* é uma excelente escolha para o aniversário adulto.";
    case 6: return "A *Iluminação de Pista de Dança* é uma excelente escolha para suas Bodas.";
    case 7: return "A *Iluminação de Pista de Dança* é uma excelente escolha para sua Formatura.";
    case 8: return "A *Iluminação de Pista de Dança* é uma excelente escolha para seu Evento Corporativo.";
    case 9: return "A *Iluminação de Pista de Dança* é uma excelente escolha para seu evento.";
    default: return "A *Iluminação de Pista de Dança* é uma excelente escolha para seu evento.";
  }
}

// ======================================================
// TABELA DE ARQUIVOS DO SERVIÇO
// ======================================================
const arquivosIluminacao = {
  midias: [
    urlBase2 + "iluminacaopistadedanca.jpg",
    urlBase2 + "iluminacaopistadedanca1.mp4",
    urlBase2 + "iluminacaopistadedanca2.mp4"
  ],
  contratar: urlBase + "comocontratar.mp3",
  orcamento: urlBase3 + "orcamentoIluminacaoparaPistadeDanca.pdf"
};

// ======================================================
// FLUXO COMPLETO — Iluminação de Pista
// ======================================================
async function enviarFluxoIluminacao(chatId, clb) {

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "<<<< *ILUMINAÇÃO PARA PISTA DE DANÇA* >>>>");

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, mensagemAberturaIluminacao(clb));

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "✨ Nosso serviço transforma sua pista de dança em um espetáculo de luzes, criando uma atmosfera envolvente e cheia de energia.");

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "As luzes acompanham o ritmo da música, proporcionando uma experiência única para os convidados.");

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "⚠️ *A Iluminação de Pista de Dança não pode ser contratada sozinha.*\n" +
    "Ela só pode ser contratada junto com outro serviço da PhotoMusic.\n\n" +
    "👉 *Exceto quando você contrata o Som Completo com DJ*, pois nesse caso a iluminação já está inclusa."
  );

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Confira algumas fotos e vídeos da nossa iluminação:");

  for (const midia of arquivosIluminacao.midias) {
    const tipo = midia.endsWith(".mp4") ? "VIDEO" : "IMAGE";
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, midia, tipo, "");
  }

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "💼 Como contratar nossos serviços:");
  await sendFileByUrl(chatId, arquivosIluminacao.contratar, "AUDIO", "");
}

// ======================================================
// FUNÇÃO PRINCIPAL — enviarIluminacao()
// ======================================================
async function enviarIluminacao(chatId, clb, convidados, sessionsRef, operatorPaused) {

  if (operatorPaused || estaPausado(chatId)) return;

  if (sessionsRef[chatId]?.enviandoIluminacao) {
    console.log(`⚠️ Já está enviando Iluminação para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoIluminacao = true;

  try {
    const dias = sessionsRef[chatId]?.orcamento?.dias || 1;

    // Caso especial corporativo
    if (clb === 8 && dias > 1) {
      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Estamos preparando um *orçamento especial* para o seu evento corporativo. Em breve entraremos em contato com mais detalhes. 😊");
      return;
    }

    // Fluxo completo
    await enviarFluxoIluminacao(chatId, clb);
    if (estaPausado(chatId)) return;

    // Envio do PDF
    await sendTyping(chatId);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Iluminação para Pista de Dança* ✨");

    await sendTyping(chatId);
    if (estaPausado(chatId)) return;
    await enviarPdfComLink(
      chatId,
      arquivosIluminacao.orcamento,
      "Orcamento-Iluminacao-para-pista-de-danca",
      sendTyping,
      sendText,
      sendFileByUrl
    );

  } catch (error) {
    console.error(`❌ Erro ao enviar Iluminação para ${chatId}:`, error);

    if (!estaPausado(chatId)) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento de Iluminação. Tente novamente.");
    }

  } finally {

    if (sessionsRef[chatId]) {

      sessionsRef[chatId].enviandoIluminacao = false;

      if (!Array.isArray(sessionsRef[chatId].servicosEnviados)) {
        sessionsRef[chatId].servicosEnviados = [];
      }

      if (!sessionsRef[chatId].servicosEnviados.includes(8)) {
        sessionsRef[chatId].servicosEnviados.push(8);
      }
    }
  }
}

module.exports = { enviarIluminacao };
