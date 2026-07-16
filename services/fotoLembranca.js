// services/fotoLembranca.js — VERSÃO FINAL CORRIGIDA E OTIMIZADA

const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");
const { enviarYoutube } = require("../utils/youtubeUtils.js");

// ======================================================
// DELAY — evita conflito de envio na Z-API
// ======================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================
// FUNÇÃO AUXILIAR — Extrai número (não usado, mas mantido)
// ======================================================
function extrairNumero(texto) {
  const match = texto.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// ======================================================
// MENSAGEM DE ABERTURA POR TIPO DE EVENTO
// ======================================================
function mensagemAberturaFotoLembranca(clb) {
  switch (clb) {
    case 1: return "📸 A *Foto Lembrança* é perfeita para sua festa de 15 anos!";
    case 3: return "📸 A *Foto Lembrança* é perfeita para o aniversário infantil!";
    case 4: return "📸 A *Foto Lembrança* é perfeita para o aniversário adolescente!";
    case 5: return "📸 A *Foto Lembrança* é perfeita para o aniversário adulto!";
    case 2: return "📸 A *Foto Lembrança* é perfeita para o seu casamento!";
    case 6: return "📸 A *Foto Lembrança* é perfeita para suas Bodas!";
    case 7: return "📸 A *Foto Lembrança* é perfeita para sua Formatura!";
    case 8: return "📸 A *Foto Lembrança* é perfeita para seu Evento Corporativo!";
    case 9: return "📸 A *Foto Lembrança* é perfeita para seu evento!";
    default: return "📸 A *Foto Lembrança* é perfeita para seu evento!";
  }
}

// ======================================================
// MENSAGENS DOS PACOTES — TRADICIONAL E ULTRA RÁPIDO
// ======================================================
const mensagemPacoteTradicional = 
  "*Pacote Tradicional — Foto Lembrança*\n\n" +
  "No modelo Tradicional, o fotógrafo registra os convidados, " +
  "processa as fotos com a moldura personalizada e realiza a revelação, " +
  "entregando tudo de forma organizada com o vale foto numerado\n\n" +
  "• Impressão durante o período contratado\n" +
  "• Fotos no tamanho 10x15\n" +
  "• Moldura personalizada com o tema do evento\n" +
  "• Equipamento profissional de impressão\n" +
  "• Entrega das fotos ao convidado durante o evento";

const mensagemPacoteUltraRapido = 
  "*Pacote Ultra Rápido — Foto Lembrança*\n\n" +
  "No modelo Ultra Rápido, o fotógrafo tira a foto e o sistema aplica " +
  "automaticamente a moldura personalizada, revelando a imagem em até 10 " +
  "segundos. O convidado recebe sua lembrança na hora e pode baixar a versão " +
  "digital pelo QR Code\n\n" +
  "• Fotos no tamanho 10x15\n" +
  "• Moldura personalizada com o tema do evento\n" +  
  "• Equipamento profissional de impressão";

const mensagemDiferencaPacotes =
  "A diferença entre os pacotes está principalmente na *velocidade de impressão* e no *tipo de equipamento utilizado*.\n" +
  "Ambos entregam fotos 10x15 com moldura personalizada.";

// ======================================================
// PDFs — Tabelas de Orçamento POR CELEBRAÇÃO
// ======================================================
const pdfFotoLembranca = {
  1: urlBase3 + "orcamentoFotoLembrança15anos.pdf",                 // 15 anos
  3: urlBase3 + "orcamentoFotoLembrançaAniversárioInfantil.pdf",    // Infantil
  4: urlBase3 + "orcamentoFotoLembrançaAniversário.pdf",            // Adolescente
  5: urlBase3 + "orcamentoFotoLembrançaAniversário.pdf",            // Adulto
  2: urlBase3 + "orcamentoFotoLembrançaCasamento.pdf",              // Casamento
  6: urlBase3 + "orcamentoFotoLembrançaBodas.pdf",                  // Bodas

  // Formatura
  formaturaMenos200:   urlBase3 + "orcamentoFotoLembrançaFormatura1.pdf",
  formaturaMais200:    urlBase3 + "orcamentoFotoLembrançaFormatura2.pdf",

  // Corporativo
  corporativoMenos200: urlBase3 + "orcamentoFotoLembrançaCorporativo1.pdf",
  corporativoMais200:  urlBase3 + "orcamentoFotoLembrançaCorporativo2.pdf",

  // Outros
  outrosMenos200:      urlBase3 + "orcamentoFotoLembrançaOutros1.pdf",
  outrosMais200:       urlBase3 + "orcamentoFotoLembrançaOutros2.pdf"
};

// ======================================================
// FLUXO COMPLETO DA FOTO LEMBRANÇA
// ======================================================
async function enviarFluxoFotoLembranca(chatId, clb) {

  await sendTyping(chatId);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "*<<<< FOTO LEMBRANÇA >>>>*");

  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, mensagemAberturaFotoLembranca(clb));

  // Introdução
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "📸 A *Foto Lembrança* é perfeita para eternizar momentos especiais do seu evento.\n" +
    "Os convidados tiram a foto e recebem a impressão durante o evento ou na hora!"
  );

  // Vídeo explicativo
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "Nossa Foto Lembrança, o fotógrafo percorre o evento ou permanece em um ponto fixo, " +
    "com uma câmera profissional, capturando momentos especiais"
  );

  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await enviarYoutube(chatId, "https://www.youtube.com/shorts/1Tvbh13_Kjo");
  await delay(600);

  // Pacotes
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "Nossa *Foto Lembrança* está disponível nos pacotes *Tradicional* e " +
    "*Ultra Rápido* ambos com *60 fotos*, *100 fotos* e *200 fotos* impressas"
  );

  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "Cofira nossos Pacotes de *Foto Lembrança*:"
  );

  // Pacote Tradicional
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, mensagemPacoteTradicional);

  // Pacote Ultra Rápido
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, mensagemPacoteUltraRapido);

  // Diferença entre os pacotes
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, mensagemDiferencaPacotes);

  // Fotos da Foto Lembrança
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "Confira alguns exemplos reais da nossa *Foto Lembrança*:");

  let fotos = [];

  // 15 anos e Adolescente
  if (clb === 1 || clb === 4) {
    fotos = [
      urlBase2 + "fotolembranca12.jpg",
      urlBase2 + "fotolembranca11.jpg",
      urlBase2 + "fotolembranca8.jpg"
    ];
  }

  // Aniversário Adulto
  else if (clb === 5) {
    fotos = [
      urlBase2 + "fotolembranca11.jpg",
      urlBase2 + "fotolembranca8.jpg",
      urlBase2 + "fotolembranca10.jpg"
    ];
  }

  // Infantil
  else if (clb === 3) {
    fotos = [
      urlBase2 + "fotolembranca1.jpg",
      urlBase2 + "fotolembranca2.jpg",
      urlBase2 + "fotolembranca3.jpg",
      urlBase2 + "fotolembranca4.jpg",
      urlBase2 + "fotolembranca9.jpg",
      urlBase2 + "fotolembranca8.jpg",
      urlBase2 + "fotolembranca11.jpg"
    ];
  }

  // Casamento
  else if (clb === 2) {
    fotos = [
      urlBase2 + "fotolembranca6.jpg",
      urlBase2 + "fotolembranca7.jpg",
      urlBase2 + "fotolembranca8.jpg",
      urlBase2 + "fotolembranca10.jpg"
    ];
  }

  // Bodas
  else if (clb === 6) {
    fotos = [
      urlBase2 + "fotolembranca8.jpg",
      urlBase2 + "fotolembranca10.jpg"
    ];
  }

  // Corporativo e Formatura
  else if (clb === 8 || clb === 7) {
    fotos = [
      urlBase2 + "fotolembranca8.jpg",
      urlBase2 + "fotolembranca13.jpg",
      urlBase2 + "fotolembranca14.jpg",
      urlBase2 + "fotolembranca11.jpg"
    ];
  }

  // Outros
  else if (clb === 9) {
    fotos = [
      urlBase2 + "fotolembranca1.jpg",
      urlBase2 + "fotolembranca2.jpg",
      urlBase2 + "fotolembranca3.jpg",
      urlBase2 + "fotolembranca4.jpg",
      urlBase2 + "fotolembranca6.jpg",
      urlBase2 + "fotolembranca7.jpg",
      urlBase2 + "fotolembranca8.jpg",
      urlBase2 + "fotolembranca9.jpg",
      urlBase2 + "fotolembranca10.jpg",
      urlBase2 + "fotolembranca11.jpg",
      urlBase2 + "fotolembranca12.jpg",
      urlBase2 + "fotolembranca13.jpg",
      urlBase2 + "fotolembranca14.jpg"
    ];
  }

  // Envio das fotos
  for (const foto of fotos) {
    if (sessions[chatId]?.pausado) return;
    await sendFileByUrl(chatId, foto, "IMAGE", "");
    await delay(600);
  }

  // Moldura + Como contratar — suprimidos quando não for o último serviço
  const _mp5 = sessions[chatId]?._envioMultiplo || {};
  const _moldura5 = _mp5.ehUltimoComMoldura ?? true;
  const _ultimo5  = _mp5.ehUltimo ?? true;

  if (_moldura5) {
    await sendTyping(chatId); await delay(300);
    if (sessions[chatId]?.pausado) return;
    await sendText(chatId, "🖼️ Moldura da Foto (Arte):");
    if (sessions[chatId]?.pausado) return;
    await sendFileByUrl(chatId, urlBase + "molduradasfotos.mp3", "AUDIO", "");
  }

  if (_ultimo5) {
    await sendTyping(chatId); await delay(300);
    if (sessions[chatId]?.pausado) return;
    await sendText(chatId, "💼 Como contratar nossos serviços:");
    if (sessions[chatId]?.pausado) return;
    await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
  }

  // Transição para o PDF
  await sendTyping(chatId); await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "Agora vou te enviar a tabela de valores de acordo com a celebração do seu evento 😊"
  );
}

// ======================================================
// SELECIONA PDF CORRETO — POR CELEBRAÇÃO
// ======================================================
function selecionarPdfFotoLembranca(clb, convidados) {

  // 15 anos, Infantil, Adolescente, Adulto, Casamento, Bodas
  if ([1, 2, 3, 4, 5, 6].includes(clb)) {
    return pdfFotoLembranca[clb];
  }

  // Formatura
  if (clb === 7) {
    return convidados <= 200
      ? pdfFotoLembranca.formaturaMenos200
      : pdfFotoLembranca.formaturaMais200;
  }

  // Corporativo
  if (clb === 8) {
    return convidados <= 200
      ? pdfFotoLembranca.corporativoMenos200
      : pdfFotoLembranca.corporativoMais200;
  }

  // Outros
  if (clb === 9) {
    return convidados <= 200
      ? pdfFotoLembranca.outrosMenos200
      : pdfFotoLembranca.outrosMais200;
  }

  return null;
}

// ======================================================
// FUNÇÃO PRINCIPAL — enviarFotoLembranca()
// ======================================================
async function enviarFotoLembranca(chatId, clb, convidados, sessionsRef, operatorPaused) {

  if (operatorPaused || sessionsRef[chatId]?.pausado) return;

  if (sessionsRef[chatId]?.enviandoFotoLembranca) {
    console.log(`⚠️ Já está enviando Foto Lembrança para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoFotoLembranca = true;

  try {
    const diasCorporativo = sessionsRef[chatId]?.orcamento?.dias || 1;

    // 1) Fluxo completo (os DETALHES). apenasOrcamento = espelho do
    // apenasFluxo: só o preço, sem a apresentação (fluxo novo 2026-07-15).
    if (!sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      await enviarFluxoFotoLembranca(chatId, clb);
    }
    if (sessionsRef[chatId]?.pausado) return;

    // Multi-dia: apenas apresentação, orçamento enviado no resumo central
    if (sessions[chatId]?._envioMultiplo?.apenasFluxo) return;

    // 2) Seleciona PDF
    const pdf = selecionarPdfFotoLembranca(clb, convidados);

    // 3) Caso especial — Corporativo com mais de 1 dia
    if (clb === 8 && diasCorporativo > 1) {
      await sendTyping(chatId); await delay(300);
      if (sessionsRef[chatId]?.pausado) return;
      await sendText(
        chatId,
        "📊 Estamos preparando um *orçamento especial* para o seu evento corporativo.\nEnviaremos o quanto antes! 😊"
      );
      return;
    }

    // 4) Eventos normais
    if (!pdf) {
      if (!sessionsRef[chatId]?.pausado) {
        await sendText(chatId, "❌ Não foi possível localizar o orçamento para este evento.");
      }
      return;
    }

    // Envio do PDF
    await sendTyping(chatId); 
    await delay(300);
    if (sessionsRef[chatId]?.pausado) return;
    
    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Lembrança* 📸✨");
    
    await sendTyping(chatId); await delay(300);
    if (sessionsRef[chatId]?.pausado) return;
    // Envia o PDF
    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Foto-Lembranca",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 5 }
    );
    await delay(600);

  } catch (error) {
    console.error(`❌ Erro ao enviar Foto Lembrança para ${chatId}:`, error);
    if (!sessionsRef[chatId]?.pausado) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento da Foto Lembrança. Tente novamente.");
    }
  } finally {
    if (sessionsRef[chatId]) {
      sessionsRef[chatId].enviandoFotoLembranca = false;

      if (!Array.isArray(sessionsRef[chatId].servicosEnviados)) {
        sessionsRef[chatId].servicosEnviados = [];
      }

      if (!sessionsRef[chatId].servicosEnviados.includes(5)) {
        sessionsRef[chatId].servicosEnviados.push(5);
      }
    }
  }
}

module.exports = { enviarFotoLembranca };
