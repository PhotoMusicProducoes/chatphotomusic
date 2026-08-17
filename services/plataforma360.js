// services/plataforma360.js — VERSÃO PADRONIZADA COMPLETA

// ======================================================================
// IMPORTS
// ======================================================================
const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase1, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");
// Serviço migrado para o orçamento GERADO não manda mais o PDF estático dele.
const { usaOrcamentoGerado } = require("./orcamentoGerado.js");

// ======================================================================
// DELAY — padrão dos outros serviços
// ======================================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================================
// EXTRAI HORAS — padronizado igual Cabine / Totem / Paparazzi
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
// MENSAGEM DE ABERTURA — mantida exatamente como no arquivo original
// ======================================================================
function getMensagemAbertura(clb) {
  switch (clb) {
    case 1:
      return "O serviço de *Plataforma 360⁰* é uma excelente escolha para sua festa de debutante.";
    case 2:
      return "O serviço de *Plataforma 360⁰* é uma excelente escolha para o seu casamento.";
    case 3:
    case 4:
    case 5:
      return "O serviço de *Plataforma 360⁰* é uma excelente escolha para sua festa de aniversário.";
    case 6:
      return "O serviço de *Plataforma 360⁰* é uma excelente escolha para suas Bodas.";
    case 7:
      return "O *Serviço Plataforma 360⁰* é uma excelente escolha para a sua Formatura.";
    case 8:
    case 9:
    default:
      return "O *Serviço Plataforma 360⁰* é uma excelente escolha para o seu evento.";
  }
}

// ======================================================================
// MENSAGEM DO LETREIRO DE LED — mantida exatamente como no original
// ======================================================================
function getMensagemLed(clb) {
  if (clb === 1) return "No letreiro de LED fica passando o nome da Debutante, ou uma mensagem para ela ou para os convidados.";
  if (clb === 2) return "No letreiro de LED fica passando o nome dos Noivos, ou uma mensagem para os Noivos ou para os convidados.";
  if (clb === 3 || clb === 4 || clb === 5) return "No letreiro de LED fica passando o nome do(a) aniversariante, ou uma mensagem para ele(a) ou para os convidados.";
  if (clb === 6) return "No letreiro de LED fica passando o nome do Casal, ou uma mensagem para o casal ou para os convidados.";
  if (clb === 7) return "No letreiro de LED fica passando uma mensagem para os Formandos ou nome da Instituição de Ensino.";
  if (clb === 8) return "No letreiro de LED fica passando o nome da empresa, nome do evento, uma mensagem para os participantes e convidados.";
  return "No letreiro de LED fica passando o nome do(a) aniversariante, nome da empresa, nome do evento, uma mensagem para os convidados.";
}

// ======================================================================
// TABELAS DE PDFs — Plataforma 360º (SEM ALTERAR NADA)
// ======================================================================

const pdfPlataforma15Anos = {
  "2h":   urlBase3 + "orcamentoPlataforma36015anos2h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma36015anos3h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma36015anos3h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma36015anos4h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma36015anos5h6h.pdf"
};

const pdfPlataformaAniversario = {
  "2h":   urlBase3 + "orcamentoPlataforma360Aniversario2h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Aniversario3h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Aniversario3h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Aniversario4h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Aniversario5h6h.pdf"
};

const pdfPlataformaCasamento = {
  "2h":   urlBase3 + "orcamentoPlataforma360Casamento2h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Casamento3h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Casamento3h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Casamento4h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Casamento5h6h.pdf"
};

const pdfPlataformaBodas = {
  "2h":   urlBase3 + "orcamentoPlataforma360Outros12h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Outros13h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Outros13h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Outros14h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Outros15h6h.pdf"
};

const pdfPlataformaOutrosMenos200 = {
  "2h":   urlBase3 + "orcamentoPlataforma360Outros12h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Outros13h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Outros13h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Outros14h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Outros15h6h.pdf",
  "6h7h": urlBase3 + "orcamentoPlataforma360Outros16h7h.pdf",
  "7h8h": urlBase3 + "orcamentoPlataforma360Outros17h8h.pdf",
  "8h9h": urlBase3 + "orcamentoPlataforma360Outros18h9h.pdf",
  "9h10h": urlBase3 + "orcamentoPlataforma360Outros19h10h.pdf"
};

const pdfPlataformaOutrosMais200 = {
  "2h":   urlBase3 + "orcamentoPlataforma360Outros22h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Outros23h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Outros23h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Outros24h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Outros25h6h.pdf",
  "6h7h": urlBase3 + "orcamentoPlataforma360Outros26h7h.pdf",
  "7h8h": urlBase3 + "orcamentoPlataforma360Outros27h8h.pdf",
  "8h9h": urlBase3 + "orcamentoPlataforma360Outros28h9h.pdf",
  "9h10h": urlBase3 + "orcamentoPlataforma360Outros29h10h.pdf"
};

const pdfPlataformaCorporativoMenos200 = {
  "2h":   urlBase3 + "orcamentoPlataforma360Corporativo12h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Corporativo13h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Corporativo13h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Corporativo14h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Corporativo15h6h.pdf",
  "6h7h": urlBase3 + "orcamentoPlataforma360Corporativo16h7h.pdf",
  "7h8h": urlBase3 + "orcamentoPlataforma360Corporativo17h8h.pdf",
  "8h9h": urlBase3 + "orcamentoPlataforma360Corporativo18h9h.pdf",
  "9h10h": urlBase3 + "orcamentoPlataforma360Corporativo19h10h.pdf"
};

const pdfPlataformaCorporativoMais200 = {
  "2h":   urlBase3 + "orcamentoPlataforma360Corporativo22h.pdf",
  "3h":   urlBase3 + "orcamentoPlataforma360Corporativo23h.pdf",
  "3h4h": urlBase3 + "orcamentoPlataforma360Corporativo23h4h.pdf",
  "4h5h": urlBase3 + "orcamentoPlataforma360Corporativo24h5h.pdf",
  "5h6h": urlBase3 + "orcamentoPlataforma360Corporativo25h6h.pdf",
  "6h7h": urlBase3 + "orcamentoPlataforma360Corporativo26h7h.pdf",
  "7h8h": urlBase3 + "orcamentoPlataforma360Corporativo27h8h.pdf",
  "8h9h": urlBase3 + "orcamentoPlataforma360Corporativo28h9h.pdf",
  "9h10h": urlBase3 + "orcamentoPlataforma360Corporativo29h10h.pdf"
};

// ======================================================================
// FUNÇÃO UNIVERSAL — Seleciona PDF pela duração (Plataforma 360º)
// ======================================================================
function selecionarPdfPadraoPlataforma(tabela, horas, paraCorporativo = false) {
  if (!tabela) return null;
  if (horas <= 1) horas = 2;
  
  // Para corporativo, formatura e outros: permite até 10 horas
  // Para outros eventos: máximo 6 horas
  if (!paraCorporativo && horas >= 6) horas = 6;
  if (paraCorporativo && horas >= 10) horas = 10;

  if (horas === 2) return tabela["2h"];
  if (horas === 3) return tabela["3h"];
  if (horas === 4) return tabela["3h4h"];
  if (horas === 5) return tabela["4h5h"];
  if (horas === 6) return tabela["5h6h"];
  if (horas === 7) return tabela["6h7h"];
  if (horas === 8) return tabela["7h8h"];
  if (horas === 9) return tabela["8h9h"];
  return tabela["9h10h"];
}

// ======================================================================
// FLUXO COMPLETO — Plataforma 360º (PADRONIZADO, SEM ALTERAR CONTEÚDO)
// ======================================================================
async function enviarFluxoPlataforma360(chatId, clb) {

  // Abertura
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, `*<<<< PLATAFORMA 360º >>>>*`);

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase1 + "inicioPlataforma360.mp3", "VIDEO", "");

  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, getMensagemAbertura(clb));

  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Nossa Plataforma leva alegria e muita diversão para o seu evento");

  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Nossa plataforma 360° é a única que tem 📸 foto e 🎥 vídeo, os " +
    "convidados ao chegarem na plataforma fazer duas fotos e ao término do giro 360° fazem " +
    "o download do vídeo e da foto paparazzi digital personalizada"
  );

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase1 + "fotopaparazziplataforma360.mp3", "VIDEO", "");

  // Introdução das mídias
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Seguem alguns vídeos 360º e Foto Paparazzi digital com GIF animado:");

  // ======================================================================
  // 🎓 FORMATURA (clb === 7)
  // ======================================================================
  if (clb === 7) {

    const base = urlBase1;

    // BLOCO 1
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎥 Vídeo 360º");
    await sendFileByUrl(chatId, base + "plataformaformatura1.mp4", "VIDEO", "");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "📸 Foto Paparazzi Digital");
    await sendFileByUrl(chatId, base + "plataformaformatura1fotopa.jpg", "IMAGE", "");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎞️ GIF Animado");
    await sendFileByUrl(chatId, base + "plataformaformatura1fotopaGif.mp4", "VIDEO", "");

    // ✂️ ENXUGADO 2026-07-15: BLOCO 2 e BLOCO 3 cortados — 1 exemplo basta.
    // Eram 3 exemplos x 3 arquivos = 9 envios só aqui. Para reverter, os
    // arquivos são plataformaformatura2/2fotopa/2fotopaGif e
    // plataformaformatura3/3(.jpg)/3fotopaGif, no mesmo padrão do BLOCO 1.
  }

  // ======================================================================
  // 🏢 CORPORATIVO (clb === 8)
  // ======================================================================
  else if (clb === 8) {

    const base = urlBase1;

    // BLOCO 1
    // ✂️ ENXUGADO 2026-07-15: eram 4 vídeos seguidos (corporativo1/2/3/3a);
    // ficou 1. Os outros 3 continuam no servidor, é só reinserir a linha.
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎥 Vídeo 360º");
    await sendFileByUrl(chatId, base + "plataformacorporativo1.mp4", "VIDEO", "");

    // BLOCO 2 — o exemplo completo (vídeo + foto + GIF) que fica.
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎥 Vídeo 360º");
    await sendFileByUrl(chatId, base + "plataformacorporativo4.mp4", "VIDEO", "");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "📸 Foto Paparazzi Digital");
    await sendFileByUrl(chatId, base + "plataformacorporativo4fotopa.jpg", "IMAGE", "");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎞️ GIF Animado");
    await sendFileByUrl(chatId, base + "plataformacorporativo4fotopaGif.mp4", "VIDEO", "");

    // ✂️ ENXUGADO 2026-07-15: BLOCO 3 (corporativo5*) e BLOCO 4 (corporativo6*)
    // cortados — mesmo padrão do BLOCO 2, é só recriar para reverter.
  }

  // ======================================================================
  // 🎉 ANIVERSÁRIOS / BODAS / OUTROS
  // ======================================================================
  else {

    const base = urlBase1;

    // BLOCO 1
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎥 Vídeo 360º");
    await sendFileByUrl(chatId, base + "plataforma1.mp4", "VIDEO", "");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "📸 Foto Paparazzi Digital");
    await sendFileByUrl(chatId, base + "plataforma1fotopa.jpg", "IMAGE", "");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🎞️ GIF Animado");
    await sendFileByUrl(chatId, base + "plataforma1fotopaGif.mp4", "VIDEO", "");

    // ✂️ ENXUGADO 2026-07-15: BLOCO 2 (plataforma2*) e BLOCO 3 (plataforma4*)
    // cortados — mesmo padrão do BLOCO 1, é só recriar para reverter.
  }

  // ======================================================================
  // LED + iPhone + edição
  // ======================================================================
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "A nossa plataforma vai completa, com luzes de LED, 📲 iPhone, música e edição no vídeo."
  );

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase1 + "ledplataformaecabineVideo.mp4", "VIDEO", "");

  // Letreiro de LED
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, getMensagemLed(clb));

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase1 + "ledplataforma1.jpg", "IMAGE", "");

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase1 + "ledplataforma2.jpg", "IMAGE", "");

  // Microfone
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Levamos microfone para animar os convidados durante o giro 360°, para que o vídeo fique animado e super divertido."
  );

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase2 + "microfoneanimacao.mp4", "VIDEO", "");

  // Download no celular
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Os convidados fazem o download do vídeo e da Foto Paparazzi Digital pelo link que recebem em seu WhatsApp."
  );

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase1 + "downloadnocelular.mp4", "VIDEO", "");

  // Moldura, Música, Como contratar — suprimidos quando não for o último serviço
  const _mp3 = sessions[chatId]?._envioMultiplo || {};
  const _moldura3 = _mp3.ehUltimoComMoldura ?? true;
  const _ultimo3  = _mp3.ehUltimo ?? true;

  if (_moldura3) {
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "Moldura do vídeo 360º e da Foto Paparazzi Digital (Arte):");

    if (clb === 8) {
      if (estaPausado(chatId)) return;
      await sendFileByUrl(chatId, urlBase1 + "molduraplataformaCorporativoAudio.mp3", "AUDIO", "");
    } else {
      if (estaPausado(chatId)) return;
      await sendFileByUrl(chatId, urlBase1 + "molduraplataformaAudio.mp3", "AUDIO", "");
    }

    // Música
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "Música do vídeo 360º:");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase1 + "musicaplataformaAudio.mp3", "AUDIO", "");
  }

  if (_ultimo3) {
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "Como contratar nossos serviços:");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
  }
}

// ======================================================================
// ORÇAMENTO — Plataforma 360º (PADRONIZADO IGUAL AOS OUTROS SERVIÇOS)
// ======================================================================
async function enviarOrcamentoPlataforma360(chatId, clb, convidados, duracao, diasCorporativo) {

  const horas = extrairHoras(duracao, clb);

  // ======================================================
  // CASO ESPECIAL — CORPORATIVO (clb === 8)
  // ======================================================
  if (clb === 8) {

    // Regra especial: mais de 1 dia → orçamento especial
    if (diasCorporativo > 1) {

      await sendTyping(chatId); await delay(300);
      if (estaPausado(chatId)) return;

      await sendText(
        chatId,
        "📊 Estamos preparando um *orçamento especial* para o seu evento corporativo.\n" +
        "Enviaremos o quanto antes! 😊"
      );

      // MENSAGENS FINAIS
      await sendTyping(chatId); await delay(300);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Perfeito! Qualquer dúvida estou por aqui 😊");

      await sendTyping(chatId); await delay(300);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Deus abençoe você e sua família, grandiosamente!!!");

      return;
    }

    // Seleção Menos200 / Mais200
    const tabela = convidados <= 200
      ? pdfPlataformaCorporativoMenos200
      : pdfPlataformaCorporativoMais200;

    const pdf = selecionarPdfPadraoPlataforma(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Plataforma 360º* 🎥✨");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;

    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Plataforma-360",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 3 }
    );

    return;
  }

  // ======================================================
  // FORMÁTURA (7) E OUTROS (9)
  // ======================================================
  if (clb === 7 || clb === 9) {

    const tabela = convidados <= 200
      ? pdfPlataformaOutrosMenos200
      : pdfPlataformaOutrosMais200;

    const pdf = selecionarPdfPadraoPlataforma(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Plataforma 360º* 🎥✨");

    await sendTyping(chatId); await delay(300);
    if (estaPausado(chatId)) return;

    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Plataforma-360",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 3 }
    );

    return;
  }

  // ======================================================
  // EVENTOS NORMAIS (1,2,3,4,5,6)
  // ======================================================
  let tabelaNormal = null;

  if (clb === 1) tabelaNormal = pdfPlataforma15Anos;
  if ([3, 4, 5].includes(clb)) tabelaNormal = pdfPlataformaAniversario;
  if (clb === 2) tabelaNormal = pdfPlataformaCasamento;
  if (clb === 6) tabelaNormal = convidados <= 200 ? pdfPlataformaOutrosMenos200 : pdfPlataformaOutrosMais200;

  const pdf = selecionarPdfPadraoPlataforma(tabelaNormal, horas);

  // Envio do PDF
  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Plataforma 360º* 🎥✨");

  await sendTyping(chatId); await delay(300);
  if (estaPausado(chatId)) return;

  await enviarPdfComLink(
    chatId,
    pdf,
    "Orcamento-Plataforma-360",
    sendTyping,
    sendText,
    sendFileByUrl,
    { session: sessions[chatId], servicoId: 3 }
  );
}


// ======================================================================
// FUNÇÃO PRINCIPAL — enviarPlataforma360()
// PADRONIZADA IGUAL AOS OUTROS SERVIÇOS
// ======================================================================
async function enviarPlataforma360(chatId, clb, convidados, sessionsRef, operatorPaused) {

  if (operatorPaused || estaPausado(chatId)) return;

  if (sessionsRef[chatId]?.enviandoPlataforma360) return;
  sessionsRef[chatId].enviandoPlataforma360 = true;

  try {
    const orc = sessionsRef[chatId]?.orcamento || {};
    const duracao = orc.horas?.toString() || "";
    const diasCorporativo = orc.dias || 1;

    // 1) Envia o fluxo (os DETALHES). apenasOrcamento = espelho do apenasFluxo:
    // manda só o preço, sem a apresentação (fluxo novo 2026-07-15).
    if (!sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      await enviarFluxoPlataforma360(chatId, clb);
    } else {
      /* 🚨 TÍTULO ANTES DA FOTO (a falha que o Mario pegou no Totem Retrô,
         17/08/2026): o `*<<<< PLATAFORMA 360º >>>>*` mora no
         enviarFluxoPlataforma360(), que é o bloco pulado aqui, então a foto
         chegaria solta, sem nada dizer de que serviço era.
         📌 A FOTO existe para o cliente VER O EQUIPAMENTO que está
         contratando: no envio enxuto ele recebia o preço sem ter visto a
         plataforma. */
      await sendTyping(chatId);
      await delay(300);
      if (estaPausado(chatId)) return;
      await sendText(chatId, `*<<<< PLATAFORMA 360º >>>>*`);

      if (estaPausado(chatId)) return;
      await sendFileByUrl(chatId, urlBase1 + "ledplataforma1.jpg", "IMAGE", "");
      await delay(500);
    }

    // Multi-dia: apenas apresentação, orçamento enviado no resumo central
    if (sessions[chatId]?._envioMultiplo?.apenasFluxo) return;

    /* 2) PDF ESTÁTICO DESLIGADO para quem já usa o orçamento GERADO
       (Plataforma 360 migrada em 17/08/2026). O PDF sai do
       `services/orcamentoGerado.js`, UMA vez, com todos os serviços do pedido
       juntos e com o desconto de combo aplicado. */
    if (!usaOrcamentoGerado(3)) {
      await enviarOrcamentoPlataforma360(
        chatId,
        clb,
        convidados,
        duracao,
        diasCorporativo
      );
    }

  } finally {
    sessionsRef[chatId].enviandoPlataforma360 = false;
  }
}

module.exports = { enviarPlataforma360, enviarOrcamentoPlataforma360 };
