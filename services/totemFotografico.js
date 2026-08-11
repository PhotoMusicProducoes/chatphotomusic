// services/totemFotografico.js — VERSÃO PADRONIZADA

// ======================================================================
// IMPORTS
// ======================================================================
const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendFileFromUrl } = require("../utils/index.js");
const { urlBase, urlBase1, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");

// ======================================================================
// DELAY — igual ao da Foto Cabine
// ======================================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================================
// EXTRAI HORAS — igual ao da Foto Cabine
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
// FUNÇÃO UNIVERSAL — Seleciona PDF pela duração (TOTEM)
// ======================================================================
function selecionarPdfPadraoTotem(tabela, horas, paraCorporativo = false) {
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
// FUNÇÃO AUXILIAR — Mapeia horas para chave de PDF
// ======================================================================
function selecionarChavePdf(horas, paraCorporativo = false) {
  if (horas <= 1) horas = 2;
  if (!paraCorporativo && horas >= 6) horas = 6;
  if (paraCorporativo && horas >= 10) horas = 10;

  if (horas === 2) return "2h";
  if (horas === 3) return "3h";
  if (horas === 4) return "3h4h";
  if (horas === 5) return "4h5h";
  if (horas === 6) return "5h6h";
  if (horas === 7) return "6h7h";
  if (horas === 8) return "7h8h";
  if (horas === 9) return "8h9h";
  return "9h10h";
}

// ======================================================================
// MENSAGEM DE ABERTURA — mantida exatamente como no arquivo original
// ======================================================================
function mensagemAberturaTotem(clb) {
  switch (clb) {
    case 1: return "📸 O *Totem Fotográfico* é uma excelente escolha para sua festa de 15 anos!";
    case 2: return "📸 O *Totem Fotográfico* é uma excelente escolha para o seu casamento!";
    case 3: return "📸 O *Totem Fotográfico* é uma excelente escolha para o aniversário infantil!";
    case 4: return "📸 O *Totem Fotográfico* é uma excelente escolha para o aniversário adolescente!";
    case 5: return "📸 O *Totem Fotográfico* é uma excelente escolha para o aniversário adulto!";
    case 6: return "📸 O *Totem Fotográfico* é uma excelente escolha para suas Bodas!";
    case 7: return "📸 O *Totem Fotográfico* é uma excelente escolha para sua Formatura!";
    case 8: return "📸 O *Totem Fotográfico* é uma excelente escolha para seu Evento Corporativo!";
    case 9: return "📸 O *Totem Fotográfico* é uma excelente escolha para seu evento!";
    default: return "📸 O *Totem Fotográfico* é uma excelente escolha para seu evento!";
  }
}

// ======================================================================
// EVENTOS DO TOTEM — BLOCO COMPLETO (SEM ALTERAR NADA)
// ======================================================================
const eventosTotem = {
  1: {
    nome: "15 anos",
    guestbook: {
      audio: urlBase + "guestbookaudio15anos.mp3",
      // ✂️ ENXUGADO 2026-07-15: de 13 para 4 (1 vídeo + 3 fotos), igual ao
      // fotoCabine.js. Ver comentário lá para o porquê e para reverter.
      imagens: [
        urlBase + "guestbook1.mp4",
        urlBase + "guestbook2.jpg",
        urlBase + "guestbook3.jpg",
        urlBase + "guestbook4.jpg"
      ]
    }
  },

  2: {
    nome: "Casamento",
    guestbook: {
      audio: urlBase + "guestbookaudiocasamento.mp3",
      // ✂️ ENXUGADO 2026-07-15: de 13 para 4 (1 vídeo + 3 fotos), igual ao
      // fotoCabine.js. Ver comentário lá para o porquê e para reverter.
      imagens: [
        urlBase + "guestbook1.mp4",
        urlBase + "guestbook2.jpg",
        urlBase + "guestbook3.jpg",
        urlBase + "guestbook4.jpg"
      ]
    }
  },

  6: {
    nome: "Bodas",
    guestbook: {
      audio: urlBase + "guestbookaudiobodas.mp3",
      // ✂️ ENXUGADO 2026-07-15: de 13 para 4 (1 vídeo + 3 fotos), igual ao
      // fotoCabine.js. Ver comentário lá para o porquê e para reverter.
      imagens: [
        urlBase + "guestbook1.mp4",
        urlBase + "guestbook2.jpg",
        urlBase + "guestbook3.jpg",
        urlBase + "guestbook4.jpg"
      ]
    }
  }

};

// ======================================================================
// ARQUIVOS DIGITAIS DO TOTEM — BLOCO COMPLETO (SEM ALTERAR NADA)
// ======================================================================
const arquivosTotem = {
  aniversario: [
    { legenda: "Foto 10x15", arquivo: urlBase3 + "totemAniversario10x151.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemAniversarioGIF1.mp4" },

    { legenda: "Foto 10x15", arquivo: urlBase3 + "totemAniversario10x152.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemAniversarioGIF2.mp4" },

    { legenda: "Foto Tirinha", arquivo: urlBase3 + "totemAniversarioTirinha1.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemAniversarioGIF3.mp4" },

    { legenda: "Foto Tirinha Impressa", arquivo: urlBase3 + "totemAniversarioTirinha1a.jpg" },

    { legenda: "Foto Tirinha", arquivo: urlBase3 + "totemAniversarioTirinha2.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemAniversarioGIF4.mp4" },

    { legenda: "Foto Tirinha Impressa", arquivo: urlBase3 + "totemAniversarioTirinha2a.jpg" }
  ],

  casamento: [
    { legenda: "Foto 10x15", arquivo: urlBase3 + "totemCasamento10x151.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCasamentoGIF1.mp4" },

    { legenda: "Foto Tirinha", arquivo: urlBase3 + "totemCasamentoTirinha1.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCasamentoGIF2.mp4" },

    { legenda: "Foto Tirinha Impressa", arquivo: urlBase3 + "totemCasamentoTirinha1a.jpg" },

    { legenda: "Foto 10x15", arquivo: urlBase3 + "totemCasamento10x152.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCasamentoGIF3.mp4" },

    { legenda: "Foto Tirinha", arquivo: urlBase3 + "totemCasamentoTirinha2.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCasamentoGIF4.mp4" },

    { legenda: "Foto Tirinha Impressa", arquivo: urlBase3 + "totemCasamentoTirinha2a.jpg" }
  ],

  corporativo: [
    { legenda: "Foto 10x15", arquivo: urlBase3 + "totemCorporativo10x151.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCorporativoGIF1.mp4" },

    { legenda: "Foto Tirinha", arquivo: urlBase3 + "totemCorporativotirinha1.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCorporativoGIF2.mp4" },

    { legenda: "Foto Tirinha Impressa", arquivo: urlBase3 + "totemCorporativotirinha1a.jpg" },

    { legenda: "Foto 10x15", arquivo: urlBase3 + "totemCorporativo10x152.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCorporativoGIF3.mp4" },

    { legenda: "Foto Tirinha", arquivo: urlBase3 + "totemCorporativotirinha2.jpg" },
    { legenda: "GIF Animado", arquivo: urlBase3 + "totemCorporativoGIF4.mp4" },

    { legenda: "Foto Tirinha Impressa", arquivo: urlBase3 + "totemCorporativotirinha2a.jpg" }
  ]
};

// ======================================================================
// PDFs DO TOTEM — BLOCO COMPLETO (SEM ALTERAR NADA)
// ======================================================================
const pdfTotemAniversario = {
  "2h": urlBase3 + "orcamentoTotemFotograficoAniversario2h.pdf",
  "3h": urlBase3 + "orcamentoTotemFotograficoAniversario3h.pdf",
  "3h4h": urlBase3 + "orcamentoTotemFotograficoAniversario3h4h.pdf",
  "4h5h": urlBase3 + "orcamentoTotemFotograficoAniversario4h5h.pdf",
  "5h6h": urlBase3 + "orcamentoTotemFotograficoAniversario5h6h.pdf"
};

const pdfTotemCasamento = {
  "2h": urlBase3 + "orcamentoTotemFotograficoCasamento2h.pdf",
  "3h": urlBase3 + "orcamentoTotemFotograficoCasamento3h.pdf",
  "3h4h": urlBase3 + "orcamentoTotemFotograficoCasamento3h4h.pdf",
  "4h5h": urlBase3 + "orcamentoTotemFotograficoCasamento4h5h.pdf",
  "5h6h": urlBase3 + "orcamentoTotemFotograficoCasamento5h6h.pdf"
};

const pdfTotemOutrosMenos200 = {
  "2h": urlBase3 + "orcamentoTotemFotograficoOutros12h.pdf",
  "3h": urlBase3 + "orcamentoTotemFotograficoOutros13h.pdf",
  "3h4h": urlBase3 + "orcamentoTotemFotograficoOutros13h4h.pdf",
  "4h5h": urlBase3 + "orcamentoTotemFotograficoOutros14h5h.pdf",
  "5h6h": urlBase3 + "orcamentoTotemFotograficoOutros15h6h.pdf",
  "6h7h": urlBase3 + "orcamentoTotemFotograficoOutros16h7h.pdf",
  "7h8h": urlBase3 + "orcamentoTotemFotograficoOutros17h8h.pdf",
  "8h9h": urlBase3 + "orcamentoTotemFotograficoOutros18h9h.pdf",
  "9h10h": urlBase3 + "orcamentoTotemFotograficoOutros19h10h.pdf"
};

const pdfTotemOutrosMais200 = {
  "2h": urlBase3 + "orcamentoTotemFotograficoOutros22h.pdf",
  "3h": urlBase3 + "orcamentoTotemFotograficoOutros23h.pdf",
  "3h4h": urlBase3 + "orcamentoTotemFotograficoOutros23h4h.pdf",
  "4h5h": urlBase3 + "orcamentoTotemFotograficoOutros24h5h.pdf",
  "5h6h": urlBase3 + "orcamentoTotemFotograficoOutros25h6h.pdf",
  "6h7h": urlBase3 + "orcamentoTotemFotograficoOutros26h7h.pdf",
  "7h8h": urlBase3 + "orcamentoTotemFotograficoOutros27h8h.pdf",
  "8h9h": urlBase3 + "orcamentoTotemFotograficoOutros28h9h.pdf",
  "9h10h": urlBase3 + "orcamentoTotemFotograficoOutros29h10h.pdf"
};

const pdfTotemCorporativoMenos200 = {
  "2h": urlBase3 + "orcamentoTotemFotograficoCorporativo12h.pdf",
  "3h": urlBase3 + "orcamentoTotemFotograficoCorporativo13h.pdf",
  "3h4h": urlBase3 + "orcamentoTotemFotograficoCorporativo13h4h.pdf",
  "4h5h": urlBase3 + "orcamentoTotemFotograficoCorporativo14h5h.pdf",
  "5h6h": urlBase3 + "orcamentoTotemFotograficoCorporativo15h6h.pdf",
  "6h7h": urlBase3 + "orcamentoTotemFotograficoCorporativo16h7h.pdf",
  "7h8h": urlBase3 + "orcamentoTotemFotograficoCorporativo17h8h.pdf",
  "8h9h": urlBase3 + "orcamentoTotemFotograficoCorporativo18h9h.pdf",
  "9h10h": urlBase3 + "orcamentoTotemFotograficoCorporativo19h10h.pdf"
};

const pdfTotemCorporativoMais200 = {
  "2h": urlBase3 + "orcamentoTotemFotograficoCorporativo22h.pdf",
  "3h": urlBase3 + "orcamentoTotemFotograficoCorporativo23h.pdf",
  "3h4h": urlBase3 + "orcamentoTotemFotograficoCorporativo23h4h.pdf",
  "4h5h": urlBase3 + "orcamentoTotemFotograficoCorporativo24h5h.pdf",
  "5h6h": urlBase3 + "orcamentoTotemFotograficoCorporativo25h6h.pdf",
  "6h7h": urlBase3 + "orcamentoTotemFotograficoCorporativo26h7h.pdf",
  "7h8h": urlBase3 + "orcamentoTotemFotograficoCorporativo27h8h.pdf",
  "8h9h": urlBase3 + "orcamentoTotemFotograficoCorporativo28h9h.pdf",
  "9h10h": urlBase3 + "orcamentoTotemFotograficoCorporativo29h10h.pdf"
};

// ======================================================================
// FLUXO COMPLETO DO TOTEM — PADRONIZADO IGUAL À FOTO CABINE
// ======================================================================
async function enviarFluxoTotem(chatId, clb) {

  if (estaPausado(chatId)) return;

  // Flags de deduplicação (definidas por enviarMultiplosOrcamentos)
  const _mpT = sessions[chatId]?._envioMultiplo || {};
  const _molduraT = _mpT.ehUltimoComMoldura ?? true;
  const _ultimoT  = _mpT.ehUltimo ?? true;
  const _listaT   = _mpT.servicosNaLista || [];

  // Abertura
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, `*<<<< TOTEM FOTOGRÁFICO >>>>*`);

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, mensagemAberturaTotem(clb));

  // Mensagem especial quando cliente pediu Foto Cabine + Totem juntos
  if (_listaT.includes(1)) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "✨ *Uma coisa importante sobre a diferença entre os dois serviços:*\n\n" +
      "No Totem, diferente da Cabine, o fundo da foto é o *próprio ambiente da sua festa* — " +
      "capturando o clima, a decoração e a energia do evento. " +
      "É uma experiência completamente diferente e que combina perfeitamente com a Cabine! 🎉"
    );
  }

  // Introdução
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Nosso *Totem Fotográfico* possui 3 pacotes: *Premium*, *Tirinha* e *Gold*. Em todos eles as fotos são *ilimitadas* 🎉");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Levamos um *mini camarim animado* com óculos, chapéus, perucas e muito mais 😄");

  // Fotos principais
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Confira algumas fotos do nosso Totem:");

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase3 + "fotoTotem2.jpg", "IMAGE", "");
  await delay(500);

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase3 + "fotoTotem3.jpg", "IMAGE", "");
  await delay(500);

  // Funcionamento
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "O convidado escolhe entre *Tirinha 05x15* ou *Foto 10x15*, faz 4 fotos e recebe a impressão na hora.");

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase3 + "videoTotem.mp4", "VIDEO", "");
  await delay(500);

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase3 + "fotoTotem1.jpg", "IMAGE", "");
  await delay(500);

  // Guestbook (somente 15 anos e casamento)
  const evento = eventosTotem[clb];
  if (evento?.guestbook) {

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "*📘 Guestbook (Álbum de Assinaturas)*");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "O Guestbook é um álbum digital onde os convidados deixam mensagens especiais em vídeo ou foto 💖");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, evento.guestbook.audio, "AUDIO", "");
    await delay(500);

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "Confira alguns registros reais:");

    for (const arquivo of evento.guestbook.imagens) {
      if (estaPausado(chatId)) return;

      const tipo = arquivo.endsWith(".mp4") ? "VIDEO" : "IMAGE";

      await sendFileByUrl(chatId, arquivo, tipo, "");
      await delay(tipo === "VIDEO" ? 500 : 300);
    }
  }

  // Pacotes — versão resumida quando cliente já viu a Foto Cabine
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "*📦 Pacotes do Totem Fotográfico*");

  if (_listaT.includes(1)) {
    // Cliente já recebeu a descrição dos pacotes na Foto Cabine — resumo rápido
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "Assim como na *Foto Cabine*, o Totem Fotográfico também trabalha com os pacotes *Premium*, *Tirinha* e *Gold* — com as mesmas regras de quantidade de pessoas e revelação por vez. 😊\n\n" +
      "A grande diferença está na experiência: no Totem o fundo é o *ambiente da sua festa*, enquanto na Cabine o fundo é *personalizado com o tema do evento*. Os dois se complementam perfeitamente! 🎉"
    );
  } else {
    // Cliente não viu a Foto Cabine — exibe descrição completa dos pacotes
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "Ao entrar na cabine, o nosso sistema permite que os convidados escolham o modelo da foto que desejam receber, *foto tirinha* ou *foto 10x15* (*Pacote Premium e Gold*), eles fazem uma sequência de 4 fotos e ao saírem recebem a foto impressa"
    );

    // Premium
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "*Pacote Premium*\n" +
      "• Foto 10x15: até *4 pessoas* → cada uma recebe uma cópia (até 4 fotos)\n" +
      "• Foto Tirinha: até *6 pessoas* → cada uma recebe uma cópia (até 6 fotos)\n" +
      "• Revelamos até *4 fotos 10x15* ou até *6 fotos tirinhas* por vez"
    );

    // Tirinha
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "*Pacote Tirinha*\n" +
      "• Foto Tirinha 05x15\n" +
      "• Até *4 pessoas* por vez → cada uma recebe uma cópia\n" +
      "• Revelamos até *4 fotos tirinhas* por vez"
    );

    // Gold
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "*Pacote Gold*\n" +
      "• Independente da quantidade de pessoas\n" +
      "• Foto 10x15 → revelamos *1 foto*\n" +
      "• Foto Tirinha → revelamos *2 fotos*\n" +
      "• Por quê? Porque a tirinha é uma 10x15 dividida ao meio 😉"
    );
  }

  // Mídias digitais
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Agora veja alguns *exemplos digitais* que os convidados recebem:");

  let midias = [];
  if ([1, 3, 4, 5].includes(clb)) midias = arquivosTotem.aniversario;
  if ([2, 6].includes(clb)) midias = arquivosTotem.casamento;
  if ([7, 8, 9].includes(clb)) midias = arquivosTotem.corporativo;

  for (const item of midias) {
    if (estaPausado(chatId)) return;

    const tipo = item.arquivo.endsWith(".mp4") ? "VIDEO" : "IMAGE";

    await sendTyping(chatId);
    await delay(200);
    if (estaPausado(chatId)) return;
    await sendText(chatId, `➡️ *${item.legenda}*`);

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, item.arquivo, tipo, "");
    await delay(tipo === "VIDEO" ? 500 : 300);
  }

  // Explicação digital
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Os convidados também podem baixar a *versão digital*, das *4 fotos capturadas pelo Totem Fotográfico* e um *GIF animado da 4 fotos* 🔥"
  );

  // Corporativo
  if (clb === 8) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "*Nossa equipe incentiva a interação com as redes sociais da empresa, ampliando o alcance do evento.*"
    );
  }

  // Moldura + Como contratar — suprimidos quando não for o último serviço
  if (_molduraT) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🖼️ Moldura da Foto (Arte):");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "molduradasfotos.mp3", "AUDIO", "");
    await delay(300);
  }

  if (_ultimoT) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "💼 Como contratar nossos serviços:");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
  }
}

// ======================================================================
// FUNÇÃO — Enviar Orçamento do Totem Fotográfico (PADRONIZADO)
// ======================================================================
async function enviarOrcamentoTotem(chatId, clb, convidados, duracao, diasCorporativo, even) {

  const horas = extrairHoras(duracao, clb);

  // ======================================================
  // CASO ESPECIAL — CORPORATIVO (clb === 8)
  // ======================================================
  if (clb === 8) {

    // Regra especial: mais de 1 dia → não envia PDF
    if (diasCorporativo > 1) {
      await sendTyping(chatId);
      await delay(300);
      if (estaPausado(chatId)) return;

      await sendText(
        chatId,
        "📊 Estamos preparando um *orçamento especial* para o seu evento corporativo.\n" +
        "Enviaremos o quanto antes! 😊"
      );

      // MENSAGENS FINAIS
      await sendTyping(chatId);
      await delay(300);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Perfeito! Qualquer dúvida estou por aqui 😊");

      await sendTyping(chatId);
      await delay(300);
      if (estaPausado(chatId)) return;
      await sendText(chatId, "Deus abençoe você e sua família, grandiosamente!!!");

      return;
    }

    // Seleção Menos200 / Mais200
    const tabela = convidados <= 200
      ? pdfTotemCorporativoMenos200
      : pdfTotemCorporativoMais200;

    const chave = selecionarChavePdf(horas, true);
    const pdf = tabela[chave];

    // Envio do PDF
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento do *Totem Fotográfico!* 📸✨");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    // Envia o PDF
    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Totem-Fotografico",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 2 }
    );

    return;
  }

  // ======================================================
  // FORMÁTURA (7) E OUTROS (9)
  // ======================================================
  if (clb === 7 || clb === 9) {

    const tabela = convidados <= 200
      ? pdfTotemOutrosMenos200
      : pdfTotemOutrosMais200;

    const pdf = selecionarPdfPadraoTotem(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento do *Totem Fotográfico!* 📸✨");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;

    // Envia o PDF
    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Totem-Fotografico",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 2 }
    );

    return;
  }

  // ======================================================
  // EVENTOS NORMAIS (1,3,4,5) / CASAMENTO (2) / BODAS (6)
  // ======================================================
  let tabelaNormal = null;

  if ([1, 3, 4, 5].includes(clb)) tabelaNormal = pdfTotemAniversario;
  if (clb === 2) tabelaNormal = pdfTotemCasamento;
  if (clb === 6) tabelaNormal = pdfTotemOutrosMenos200;

  const pdf = selecionarPdfPadraoTotem(tabelaNormal, horas);

  // Envio do PDF
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "💰 Segue o arquivo com o orçamento do *Totem Fotográfico!* 📸✨");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;

  // Envia o PDF
  await enviarPdfComLink(
    chatId,
    pdf,
    "Orcamento-Totem-Fotografico",
    sendTyping,
    sendText,
    sendFileByUrl,
    { session: sessions[chatId], servicoId: 2 }
  );
}

// ======================================================================
// FUNÇÃO PRINCIPAL — enviarTotemFotografico()
// PADRONIZADA IGUAL À FOTO CABINE
// ======================================================================
async function enviarTotemFotografico(chatId, clb, convidados, sessionsRef, operatorPaused) {

  // Se operador pausou ou cliente pausado → não envia nada
  if (operatorPaused || estaPausado(chatId)) return;

  // Evita envio duplicado
  if (sessionsRef[chatId]?.enviandoTotem) {
    console.log(`⚠️ Já está enviando Totem para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoTotem = true;

  try {
    const duracao = sessionsRef[chatId]?.orcamento?.horas?.toString() || "";
    const diasCorporativo = sessionsRef[chatId]?.orcamento?.dias || 1;

    // 1) Envia fluxo completo (os DETALHES). apenasOrcamento = espelho do
    // apenasFluxo: só o preço, sem a apresentação (fluxo novo 2026-07-15).
    if (!sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      await enviarFluxoTotem(chatId, clb);
    }
    if (estaPausado(chatId)) return;

    // Multi-dia: apenas apresentação, orçamento enviado no resumo central
    if (sessions[chatId]?._envioMultiplo?.apenasFluxo) return;

    // 2) Envia orçamento padronizado
    await enviarOrcamentoTotem(
      chatId,
      clb,
      convidados,
      duracao,
      diasCorporativo
    );

    // GuestBook: no envio ENXUTO o fluxo completo não roda e ele sumia da
    // proposta. Volta em 1 mensagem + 4 arquivos. Ver services/guestbook.js.
    if (sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      try {
        const { enviarGuestbook } = require("./guestbook.js");
        await enviarGuestbook(chatId, clb, "Totem Fotográfico");
      } catch (e) {
        console.error("⚠️ GuestBook (Totem):", e.message);
      }
    }

  } catch (error) {
    console.error(`❌ Erro ao enviar Totem para ${chatId}:`, error);

    if (!estaPausado(chatId)) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento do Totem. Tente novamente.");
    }

  } finally {
    // Libera o envio
    if (sessionsRef[chatId]) {
      sessionsRef[chatId].enviandoTotem = false;

      // Marca serviço como enviado (2 = Totem)
      if (!sessionsRef[chatId].servicosEnviados.includes(2)) {
        sessionsRef[chatId].servicosEnviados.push(2);
      }
    }
  }
}

module.exports = { enviarTotemFotografico };
