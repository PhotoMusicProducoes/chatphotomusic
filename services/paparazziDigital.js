// services/paparazziDigital.js — VERSÃO PADRONIZADA

// ======================================================================
// IMPORTS
// ======================================================================
const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendLinkPreview, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase1, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");
const { enviarYoutube } = require("../utils/youtubeUtils.js");

// ======================================================================
// DELAY — igual aos outros serviços
// ======================================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================================
// EXTRAI HORAS — padronizado igual Cabine/Totem
// ======================================================================
function extrairHoras(duracao, clb) {
  if (!duracao) return 2;

  const match = duracao.match(/(\d+)/);
  let horas = match ? parseInt(match[1], 10) : 2;

  if (horas <= 1) horas = 2;  
  
  // Corporativo (8), Formatura (7) e Outros (9) podem ter até 10 horas
  // Outros eventos mantêm máximo de 6 horas
  if (![8, 7, 9].includes(clb) && horas > 6) {
    horas = 6;
  } else if ([8, 7, 9].includes(clb) && horas > 10) {
    horas = 10;
  }

  return horas;
}

// ======================================================================
// FUNÇÃO UNIVERSAL — Seleciona PDF pela duração (PAPARAZZI)
// ======================================================================
function selecionarPdfPadraoPaparazzi(tabela, horas, paraCorporativo = false) {
  if (horas <= 1) horas = 2;
  
  // Para corporativo, formatura e outros: permite até 10 horas
  // Para outros eventos: máximo 6 horas
  if (!paraCorporativo && horas >= 6) horas = 6;
  if (paraCorporativo && horas >= 10) horas = 10;

  if (horas === 2) return tabela.pdf2h;
  if (horas === 3) return tabela.pdf3h;
  if (horas === 4) return tabela.pdf3h4h;
  if (horas === 5) return tabela.pdf4h5h;
  if (horas === 6) return tabela.pdf5h6h;
  if (horas === 7) return tabela.pdf6h7h;
  if (horas === 8) return tabela.pdf7h8h;
  if (horas === 9) return tabela.pdf8h9h;
  return tabela.pdf9h10h;
}

// ======================================================================
// MENSAGEM DE ABERTURA — mantida exatamente como no arquivo original
// ======================================================================
function mensagemAbertura(clb) {
  switch (clb) {
    case 1:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para sua festa de debutante.";
    case 2:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para o seu casamento.";
    case 3:
    case 4:
    case 5:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para sua festa de aniversário.";
    case 6:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para suas Bodas.";
    case 7:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para sua Formatura.";
    case 8:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para seu Evento Corporativo.";
    default:
      return "O serviço de *Foto Paparazzi Digital* é uma excelente escolha para o seu evento.";
  }
}

// ======================================================================
// PDFs DO PAPARAZZI — BLOCO COMPLETO (SEM ALTERAR NADA)
// ======================================================================
const pdfs = {
  aniversario: {
    pdf2h: urlBase3 + "orcamentoFotoPaparazziDigitalAniversario2h.pdf",
    pdf3h: urlBase3 + "orcamentoFotoPaparazziDigitalAniversario3h.pdf",
    pdf3h4h: urlBase3 + "orcamentoFotoPaparazziDigitalAniversario3h4h.pdf",
    pdf4h5h: urlBase3 + "orcamentoFotoPaparazziDigitalAniversario4h5h.pdf",
    pdf5h6h: urlBase3 + "orcamentoFotoPaparazziDigitalAniversario5h6h.pdf"
  },

  casamento: {
    pdf2h: urlBase3 + "orcamentoFotoPaparazziDigitalCasamento2h.pdf",
    pdf3h: urlBase3 + "orcamentoFotoPaparazziDigitalCasamento3h.pdf",
    pdf3h4h: urlBase3 + "orcamentoFotoPaparazziDigitalCasamento3h4h.pdf",
    pdf4h5h: urlBase3 + "orcamentoFotoPaparazziDigitalCasamento4h5h.pdf",
    pdf5h6h: urlBase3 + "orcamentoFotoPaparazziDigitalCasamento5h6h.pdf"
  },

  outrosMenos200: {
    pdf2h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros12h.pdf",
    pdf3h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros13h.pdf",
    pdf3h4h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros13h4h.pdf",
    pdf4h5h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros14h5h.pdf",
    pdf5h6h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros15h6h.pdf",
    pdf6h7h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros16h7h.pdf",
    pdf7h8h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros17h8h.pdf",
    pdf8h9h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros18h9h.pdf",
    pdf9h10h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros19h10h.pdf"
  },

  outrosMais200: {
    pdf2h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros22h.pdf",
    pdf3h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros23h.pdf",
    pdf3h4h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros23h4h.pdf",
    pdf4h5h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros24h5h.pdf",
    pdf5h6h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros25h6h.pdf",
    pdf6h7h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros26h7h.pdf",
    pdf7h8h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros27h8h.pdf",
    pdf8h9h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros28h9h.pdf",
    pdf9h10h: urlBase3 + "orcamentoFotoPaparazziDigitalOutros29h10h.pdf"
  },

  corporativoMenos200: {
    pdf2h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo12h.pdf",
    pdf3h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo13h.pdf",
    pdf3h4h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo13h4h.pdf",
    pdf4h5h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo14h5h.pdf",
    pdf5h6h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo15h6h.pdf",
    pdf6h7h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo16h7h.pdf",
    pdf7h8h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo17h8h.pdf",
    pdf8h9h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo18h9h.pdf",
    pdf9h10h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo19h10h.pdf"
  },

  corporativoMais200: {
    pdf2h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo22h.pdf",
    pdf3h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo23h.pdf",
    pdf3h4h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo23h4h.pdf",
    pdf4h5h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo24h5h.pdf",
    pdf5h6h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo25h6h.pdf",
    pdf6h7h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo26h7h.pdf",
    pdf7h8h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo27h8h.pdf",
    pdf8h9h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo28h9h.pdf",
    pdf9h10h: urlBase3 + "orcamentoFotoPaparazziDigitalCorporativo29h10h.pdf"
  }
};

// ======================================================================
// FLUXO COMPLETO DO PAPARAZZI DIGITAL — PADRONIZADO
// ======================================================================
async function enviarFluxoPaparazzi(chatId, clb) {

  // Abertura
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, `*<<<< FOTO PAPARAZZI DIGITAL >>>>*`);

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, mensagemAbertura(clb));

  // Áudios iniciais
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendFileByUrl(chatId, urlBase1 + "iniciofotopaparazzidigital.mp3", "AUDIO", "");

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendFileByUrl(chatId, urlBase1 + "fotopaparazzidigitalaudio.mp3", "AUDIO", "");

  // Explicação inicial
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "Nossa *Foto Paparazzi Digital* é única! Os convidados fazem duas fotos com poses diferentes e, ao final, fazem o download da foto personalizada e do GIF animado."
  );

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "Veja o vídeo da *Foto Paparazzi Digital*:");

  // Link do YouTube (mantido exatamente igual)
  await sendTyping(chatId);
  await delay(6000);
  
  await enviarYoutube(chatId, "https://youtube.com/shorts/Nmv3tIDV0-E");
  await delay(1000)

  // Explicação sobre circulação
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(
    chatId,
    "Nossa equipe circula pelo evento com o fotógrafo, interagindo com os convidados e garantindo fotos incríveis!"
  );

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendFileByUrl(chatId, urlBase1 + "fotoPaparazziDigitalCirculando.mp4", "VIDEO", "");

  // Bastão de LED
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "Utilizamos bastões de LED que garantem fotos perfeitas mesmo em ambientes escuros.");

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendFileByUrl(chatId, urlBase1 + "fotopaparazzibastaoLed-scaled.jpg", "IMAGE", "");

  // Mídias digitais
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "Veja alguns arquivos digitais:");

  async function enviarMidiaPaparazzi(titulo, foto, gif) {
    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;
    await sendText(chatId, titulo);

    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;
    await sendFileByUrl(chatId, foto, "IMAGE", "");

    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;
    await sendFileByUrl(chatId, gif, "VIDEO", "");
  }

  await enviarMidiaPaparazzi(
    "Foto Paparazzi Digital e GIF Animado",
    urlBase1 + "fotopaparazzidigital1.jpg",
    urlBase1 + "fotopaparazzidigital1Gif.mp4"
  );

  await enviarMidiaPaparazzi(
    "Foto Paparazzi Digital e GIF Animado",
    urlBase1 + "fotopaparazzidigital2.jpg",
    urlBase1 + "fotopaparazzidigital2Gif.mp4"
  );

  await enviarMidiaPaparazzi(
    "Foto Paparazzi Digital e GIF Animado",
    urlBase1 + "fotopaparazzidigital3.jpg",
    urlBase1 + "fotopaparazzidigital3Gif.mp4"
  );

  await enviarMidiaPaparazzi(
    "Foto Paparazzi Digital e GIF Animado",
    urlBase1 + "fotopaparazzidigital5.jpg",
    urlBase1 + "fotopaparazzidigital5Gif.mp4"
  );

  await enviarMidiaPaparazzi(
    "Foto Paparazzi Digital e GIF Animado",
    urlBase1 + "fotopaparazzidigital6.jpg",
    urlBase1 + "fotopaparazzidigital6Gif.mp4"
  );

  // Moldura
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "Moldura da Foto Paparazzi Digital (Arte)");

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendFileByUrl(chatId, urlBase + "molduradasfotos.mp3", "AUDIO", "");

  // Como contratar
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendText(chatId, "Como contratar nossos serviços:");

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
}

// ======================================================================
// FUNÇÃO — Enviar Orçamento do Paparazzi Digital (PADRONIZADO)
// ======================================================================
async function enviarOrcamentoPaparazzi(chatId, clb, convidados, duracao, diasCorporativo) {

  const horas = extrairHoras(duracao, clb);

  // ======================================================
  // CASO ESPECIAL — CORPORATIVO (clb === 8)
  // ======================================================
  if (clb === 8) {

    // Regra especial: mais de 1 dia → não envia PDF
    if (diasCorporativo > 1) {

      await sendTyping(chatId); 
      await delay(300);
      if (sessions[chatId]?.pausado) return;

      await sendText(
        chatId,
        "📊 Estamos preparando um *orçamento especial* para o seu evento corporativo.\n" +
        "Enviaremos o quanto antes! 😊"
      );

      return;
    }

    // Seleção Menos200 / Mais200
    const tabela = convidados <= 200
      ? pdfs.corporativoMenos200
      : pdfs.corporativoMais200;

    const pdf = selecionarPdfPadraoPaparazzi(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Paparazzi Digital* 📸✨");

    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;
    
    // Envia o PDF 
    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Foto-Paparazzi-Digital",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 4 }
    );

    // Deslocamento
    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;

    await sendText(
      chatId,
      "🚗 *Observação importante sobre deslocamento*\n" +
      "O custo de deslocamento **não está incluso** neste orçamento.\n" +
      "Ele será calculado e enviado posteriormente de acordo com o local informado."
    );

    return;
  }

  // ======================================================
  // FORMÁTURA (7) E OUTROS (9)
  // usam Menos200 / Mais200 igual aos outros serviços
  // ======================================================
  if (clb === 7 || clb === 9) {

    const tabela = convidados <= 200
      ? pdfs.outrosMenos200
      : pdfs.outrosMais200;

    const pdf = selecionarPdfPadraoPaparazzi(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Paparazzi Digital* 📸✨");

    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;
    
    // Envia o PDF 
    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Foto-Paparazzi-Digital",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 4 }
    );

    // Deslocamento
    await sendTyping(chatId); 
    await delay(300);
    if (sessions[chatId]?.pausado) return;

    await sendText(
      chatId,
      "🚗 *Observação importante sobre deslocamento*\n" +
      "O custo de deslocamento **não está incluso** neste orçamento.\n" +
      "Ele será calculado e enviado posteriormente de acordo com o local informado."
    );
    return;
  }

  // ======================================================
  // EVENTOS NORMAIS (1,3,4,5) / CASAMENTO (2) / BODAS (6)
  // ======================================================
  let tabelaNormal = null;

  if ([1, 3, 4, 5].includes(clb)) tabelaNormal = pdfs.aniversario;
  if (clb === 2) tabelaNormal = pdfs.casamento;
  if (clb === 6) tabelaNormal = convidados <= 200 ? pdfs.outrosMenos200 : pdfs.outrosMais200;

  const pdf = selecionarPdfPadraoPaparazzi(tabelaNormal, horas);

  // Envio do PDF
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;

  await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Paparazzi Digital* 📸✨");

  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;
  
  // Envia o PDF
  await enviarPdfComLink(
    chatId,
    pdf,
    "Orcamento-Foto-Paparazzi-Digital",
    sendTyping,
    sendText,
    sendFileByUrl,
    { session: sessions[chatId], servicoId: 4 }
  );

  // Deslocamento
  await sendTyping(chatId); 
  await delay(300);
  if (sessions[chatId]?.pausado) return;

  await sendText(
    chatId,
    "🚗 *Observação importante sobre deslocamento*\n" +
    "O custo de deslocamento **não está incluso** neste orçamento.\n" +
    "Ele será calculado e enviado posteriormente de acordo com o local informado."
  );
}

// ======================================================================
// FUNÇÃO PRINCIPAL — enviarFotoPaparazzi()
// PADRONIZADA IGUAL À CABINE E TOTEM
// ======================================================================
async function enviarFotoPaparazzi(chatId, clb, convidados, sessionsRef, operatorPaused) {

  // Se operador pausou ou sessão pausada → não envia nada
  if (operatorPaused || sessionsRef[chatId]?.pausado) return;

  // Evita envio duplicado
  if (sessionsRef[chatId]?.enviandoPaparazzi) {
    console.log(`⚠️ Já está enviando Paparazzi para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoPaparazzi = true;

  try {
    const orc = sessionsRef[chatId]?.orcamento || {};
    const duracao = orc.horas?.toString() || "";
    const diasCorporativo = orc.dias || 1;

    // 1) Envia fluxo completo
    await enviarFluxoPaparazzi(chatId, clb);
    if (sessionsRef[chatId]?.pausado) return;

    // 2) Envia orçamento padronizado
    await enviarOrcamentoPaparazzi(
      chatId,
      clb,
      convidados,
      duracao,
      diasCorporativo
    );

  } catch (error) {
    console.error(`❌ Erro ao enviar Paparazzi para ${chatId}:`, error);

    if (!sessionsRef[chatId]?.pausado) {
      await sendTyping(chatId);
      await delay(300);
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento da Foto Paparazzi Digital. Tente novamente.");
    }

  } finally {

    if (sessionsRef[chatId]) {

      // Garante que o array existe
      if (!Array.isArray(sessionsRef[chatId].servicosEnviados)) {
        sessionsRef[chatId].servicosEnviados = [];
      }

      sessionsRef[chatId].enviandoPaparazzi = false;

      // Marca serviço como enviado (4 = Paparazzi Digital)
      if (!sessionsRef[chatId].servicosEnviados.includes(4)) {
        sessionsRef[chatId].servicosEnviados.push(4);
      }
    }
  }
}

module.exports = { enviarFotoPaparazzi };
