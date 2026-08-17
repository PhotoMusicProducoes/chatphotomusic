// services/fotografia.js — VERSÃO FINAL COM PAUSA NOVA

const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");
// Serviço migrado para o orçamento GERADO não manda mais o PDF estático dele.
const { usaOrcamentoGerado } = require("./orcamentoGerado.js");

// ======================================================
// MENSAGEM DE ABERTURA POR TIPO DE EVENTO
// ======================================================
function mensagemAberturaFotografia(clb) {
  switch (clb) {
    case 3: return "📸 A *Cobertura Fotográfica* é uma excelente escolha para o seu Aniversário Infantil!";
    case 4: return "📸 A *Cobertura Fotográfica* é uma excelente escolha para o Aniversário Adolescente!";
    case 5: return "📸 A *Cobertura Fotográfica* é uma excelente escolha para o Aniversário Adulto!";
    case 6: return "📸 Obrigado pelo interesse na *Cobertura Fotográfica* para suas Bodas!";
    case 7: return "📸 Obrigado pelo interesse na *Cobertura Fotográfica* para sua Formatura!";
    case 8: return "📸 Obrigado pelo interesse na *Cobertura Fotográfica* para seu Evento Corporativo!";
    case 9: return "📸 Obrigado pelo interesse na *Cobertura Fotográfica* para seu evento!";
    default: return "📸 Obrigado pelo interesse na *Cobertura Fotográfica*!";
  }
}

// ======================================================
// TABELA DE FOTOS POR TIPO DE EVENTO
// ======================================================
const fotosFotografia = {
  infantil: [
    urlBase3 + "fotografiaIntantil1.jpg",
    urlBase3 + "fotografiaIntantil2.jpg",
    urlBase3 + "fotografiaIntantil3.jpg",
    urlBase3 + "fotografiaIntantil4.jpg"
  ],

  adolescente: [
    urlBase3 + "fotografiaAdolescente1.jpg",
    urlBase3 + "fotografiaAdolescente2.jpg",
    urlBase3 + "fotografiaAdolescente3.jpg",
    urlBase3 + "fotografiaAdolescente4.jpg",
    urlBase3 + "fotografiaAdolescente5.jpg",
    urlBase3 + "fotografiaAdolescente6.jpg"
  ],

  adulto: [
    urlBase3 + "fotografiaAdulto1.jpg",
    urlBase3 + "fotografiaAdulto2.jpg",
    urlBase3 + "fotografiaAdulto3.jpg",
    urlBase3 + "fotografiaAdulto4.jpg"
  ]
};

// ======================================================
// TABELA DE PDFs POR TIPO DE EVENTO
// ======================================================
const pdfFotografia = {
  3: urlBase3 + "orcamentoFotografiaAniversarioInfantil.pdf",
  4: urlBase3 + "orcamentoFotografiaAdolescente.pdf",
  5: urlBase3 + "orcamentoFotografia.pdf"
};

// ======================================================
// FLUXO COMPLETO — Cobertura Fotográfica
// ======================================================
async function enviarFluxoFotografia(chatId, clb) {

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "*<<<< COBERTURA FOTOGRÁFICA >>>>*");

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, mensagemAberturaFotografia(clb));

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Capturamos cada detalhe do seu evento com sensibilidade, técnica e profissionalismo. 📸✨");

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Nosso fotógrafo registra momentos espontâneos, sorrisos, emoções e tudo aquilo que torna o seu evento único.");

  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "As fotos são entregues em alta resolução, com edição profissional e link digital para download.");

  // Fotos de exemplo
  let fotos = [];

  if (clb === 3) fotos = fotosFotografia.infantil;
  if (clb === 4) fotos = fotosFotografia.adolescente;
  if (clb === 5) fotos = fotosFotografia.adulto;

  if (fotos.length > 0) {
    await sendTyping(chatId);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "Confira algumas fotos de eventos que já registramos:");

    for (const foto of fotos) {
      if (estaPausado(chatId)) return;
      await sendFileByUrl(chatId, foto, "IMAGE", "");
    }
  }

  // Como funciona a entrega
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "📦 *Como funciona a entrega das fotos:*\n" +
    "• Todas as fotos são entregues em alta resolução\n" +
    "• Edição profissional inclusa\n" +
    "• Link digital para download\n" +
    "• Envio das melhores fotos no WhatsApp\n" +
    "• Galeria online organizada por momentos do evento"
  );

  // Informações adicionais
  await sendTyping(chatId);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Se desejar, também podemos montar um álbum digital ou físico. Basta solicitar após o evento. 📘✨");

  // Como contratar — suprimido quando não for o último serviço
  const _mp6 = sessions[chatId]?._envioMultiplo || {};
  const _ultimo6 = _mp6.ehUltimo ?? true;

  if (_ultimo6) {
    await sendTyping(chatId);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "💼 Como contratar nossos serviços:");
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
  }
}

// ======================================================
// FUNÇÃO PRINCIPAL — enviarFotografia()
// ======================================================
async function enviarFotografia(chatId, clb, convidados, sessionsRef, operatorPaused) {

  if (operatorPaused || estaPausado(chatId)) return;

  if (sessionsRef[chatId]?.enviandoFotografia) {
    console.log(`⚠️ Já está enviando Fotografia para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoFotografia = true;

  try {

    // 1) NÃO prestamos serviço para 15 anos e casamento
    if (clb === 1 || clb === 2) {

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "*<<<< COBERTURA FOTOGRÁFICA >>>>*");

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, `📸 Obrigado pelo interesse na *Cobertura Fotográfica* para *${clb === 1 ? "15 anos" : "Casamento"}*!`);

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Infelizmente, não prestamos serviço de cobertura fotográfica para esse tipo de evento. 😔");

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Mas temos outros serviços incríveis que podem tornar seu evento inesquecível! 🎉");

      return;
    }

    // 2) Eventos com orçamento pronto
    if (clb === 3 || clb === 4 || clb === 5) {

      // apenasOrcamento = espelho do apenasFluxo: só o preço, sem a
      // apresentação (fluxo novo 2026-07-15).
      if (!sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
        await enviarFluxoFotografia(chatId, clb);
      } else {
        /* 🚨 TÍTULO ANTES DA FOTO (falha pega no Totem Retrô, 17/08/2026): o
           título mora no enviarFluxoFotografia(), que é o bloco pulado aqui.
           📌 A FOTO existe para o cliente VER o que está contratando. */
        await sendTyping(chatId);
        if (estaPausado(chatId)) return;
        await sendText(chatId, "*<<<< COBERTURA FOTOGRÁFICA >>>>*");

        /* Sem foto "universal" aqui: os conjuntos são por celebração e não se
           repetem. Como este ramo só roda para 3, 4 e 5, vai a PRIMEIRA foto
           do conjunto certo, que casa com o tipo de evento do cliente. */
        const capa = (clb === 3 ? fotosFotografia.infantil
                    : clb === 4 ? fotosFotografia.adolescente
                    : fotosFotografia.adulto)[0];

        // 🚨 Sem `delay()` aqui: este arquivo não tem esse helper, diferente
        // dos outros services. Chamar quebraria em runtime, não no lint.
        if (estaPausado(chatId)) return;
        await sendFileByUrl(chatId, capa, "IMAGE", "");
      }
      if (estaPausado(chatId)) return;

      // Multi-dia: apenas apresentação, orçamento enviado no resumo central
      if (sessions[chatId]?._envioMultiplo?.apenasFluxo) return;

      /* PDF ESTÁTICO DESLIGADO para quem já usa o orçamento GERADO (Cobertura
         migrada em 18/08/2026). O PDF sai do `services/orcamentoGerado.js`,
         uma vez, com todos os serviços juntos.
         📌 Este ramo só roda para infantil (3), adolescente (4) e adulto (5),
         que eram os únicos com PDF pronto. 15 anos e casamento continuam
         recusados acima, e bodas/formatura/corporativo/outros continuam com a
         mensagem de orçamento a preparar. Ver CELEBRACOES_POR_SERVICO. */
      if (!usaOrcamentoGerado(6, clb)) {
        await sendTyping(chatId);
        await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Cobertura Fotográfica* 📸✨");

        await sendTyping(chatId);
        if (estaPausado(chatId)) return;
        await enviarPdfComLink(
          chatId,
          pdfFotografia[clb],
          "Orcamento-Cobertura-Fotografica",
          sendTyping,
          sendText,
          sendFileByUrl,
          { session: sessions[chatId], servicoId: 6 }
        );
      }

      return;
    }

    // 3) Eventos sem orçamento pronto
    if ([6, 7, 8, 9].includes(clb)) {

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, mensagemAberturaFotografia(clb));

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Estamos preparando um orçamento especial para você! ⏳");

      await sendTyping(chatId);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Em breve entraremos em contato com mais detalhes. 😊");

      return;
    }

  } catch (error) {
    console.error(`❌ Erro ao enviar Fotografia para ${chatId}:`, error);

    if (!estaPausado(chatId)) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar as informações de Fotografia. Tente novamente.");
    }

  } finally {

    if (sessionsRef[chatId]) {

      sessionsRef[chatId].enviandoFotografia = false;

      if (!Array.isArray(sessionsRef[chatId].servicosEnviados)) {
        sessionsRef[chatId].servicosEnviados = [];
      }

      if (!sessionsRef[chatId].servicosEnviados.includes(6)) {
        sessionsRef[chatId].servicosEnviados.push(6);
      }
    }
  }
}

module.exports = { enviarFotografia };
