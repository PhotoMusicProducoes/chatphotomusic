// services/fotoCabine.js — NOVA VERSÃO OTIMIZADA
// Mantém o fluxo antigo, mas sem repetição de código

const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, sendLinkPreview } = require("../utils/index.js");
const { sendFileFromUrl } = require("../utils/sendFileFromUrl.js");
const { enviarYoutube } = require("../utils/youtubeUtils.js");
const { urlBase, urlBase1, urlBase2, urlBase3 } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");

// ======================================================
// DELAY — evita conflito de envio na Z-API
// ======================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================
// FUNÇÃO UNIVERSAL — Seleciona PDF pela duração
// ======================================================
function selecionarPdfPadrao(tabela, horas, paraCorporativo = false) {
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

// ======================================================
// FUNÇÃO AUXILIAR — Extrai apenas o número de horas
// ======================================================
function extrairHoras(duracao, clb) {
  if (!duracao) return 2;  // ✔ PADRÃO CORRETO

  const match = duracao.match(/(\d+)/);
  let horas = match ? parseInt(match[1], 10) : 2; // ✔ padrão 2h

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

// ======================================================
// GUESTBOOK — Imagens/vídeos compartilhados por todas as celebrações
// ======================================================
// ✂️ ENXUGADO 2026-07-15: de 13 para 4 (1 vídeo + 3 fotos). Imagem demais
// afoga o cliente e gera reclamação. Os 9 cortados continuam listados abaixo,
// comentados, para reverter fácil se a adesão piorar.
const GUESTBOOK_IMAGENS = [
  urlBase + "guestbook1.mp4",
  urlBase + "guestbook2.jpg",
  urlBase + "guestbook3.jpg",
  urlBase + "guestbook4.jpg"
  // Cortados 2026-07-15:
  // urlBase  + "guestbook6.jpg",
  // urlBase  + "guestbook7.jpg",
  // urlBase2 + "guestbook8.mp4",
  // urlBase2 + "guestbook9.mp4",
  // urlBase  + "guestbook10.jpg",
  // urlBase  + "guestbook11.jpg",
  // urlBase2 + "guestbook12.mp4",
  // urlBase  + "guestbook13.jpg",
  // urlBase  + "guestbook14.jpg"
];

// ======================================================
// ARQUIVOS ESPECÍFICOS POR EVENTO
// (BLOCO COMPLETO, SEM ALTERAR NADA)
// ======================================================
const eventos = {
  1: { // 15 anos
    nome: "15 anos",
    audio: urlBase + "15anosespecialidade.mp3",
    tirinhaDigital: urlBase + "fototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "fototirinhaimpressa.jpg",
    foto10x15: urlBase + "foto10x15.jpg",
    gif1: urlBase + "gif1.mp4",
    gif2: urlBase + "gif2.mp4",
    guestbook: {
      audio: urlBase + "guestbookaudio15anos.mp3",
      imagens: GUESTBOOK_IMAGENS
    },
    orcamentos: {
      "2h": urlBase3 + "orcamentoFotoCabine15anos2h.pdf",
      "3h": urlBase3 + "orcamentoFotoCabine15anos3h.pdf",
      "3h4h": urlBase3 + "orcamentoFotoCabine15anos3h4h.pdf",
      "4h5h": urlBase3 + "orcamentoFotoCabine15anos4h5h.pdf",
      "5h6h": urlBase3 + "orcamentoFotoCabine15anos5h6h.pdf"
    }
  },

  2: { // Casamento
    nome: "Casamento",
    audio: urlBase + "casamentoaudio.mp3",
    tirinhaDigital: urlBase + "casamentofototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "casamentofototirinhaimpressa.jpg",
    foto10x15: urlBase + "casamentofoto10x15.jpg",
    gif1: urlBase + "casamentogif1.mp4",
    gif2: urlBase + "casamentogif2.mp4",
    guestbook: {
      audio: urlBase + "guestbookaudiocasamento.mp3",
      imagens: GUESTBOOK_IMAGENS
    },
    orcamentos: {
      "2h": urlBase3 + "orcamentoFotoCabineCasamento2h.pdf",
      "3h": urlBase3 + "orcamentoFotoCabineCasamento3h.pdf",
      "3h4h": urlBase3 + "orcamentoFotoCabineCasamento3h4h.pdf",
      "4h5h": urlBase3 + "orcamentoFotoCabineCasamento4h5h.pdf",
      "5h6h": urlBase3 + "orcamentoFotoCabineCasamento5h6h.pdf"
    }
  },

  3: { // Infantil
    nome: "Aniversário Infantil",
    audio: urlBase + "aniversarioinfantilaudio.mp3",
    tirinhaDigital: urlBase + "aniversarioinfantilfototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "aniversarioinfantilfototirinhaimpressa.jpg",
    foto10x15: urlBase + "aniversarioinfantilfoto10x15.jpg",
    gif1: urlBase + "aniversarioinfantilGif1.mp4",
    gif2: urlBase + "aniversarioinfantilGif2.mp4",
    guestbook: {
      audio: null,
      imagens: GUESTBOOK_IMAGENS
    },
    orcamentos: {
      "2h": urlBase3 + "orcamentoFotoCabineInfantil2h.pdf",
      "3h": urlBase3 + "orcamentoFotoCabineInfantil3h.pdf",
      "3h4h": urlBase3 + "orcamentoFotoCabineInfantil3h4h.pdf",
      "4h5h": urlBase3 + "orcamentoFotoCabineInfantil4h5h.pdf",
      "5h6h": urlBase3 + "orcamentoFotoCabineInfantil5h6h.pdf"
    }
  },

  4: { // Adolescente
    nome: "Aniversário Adolescente",
    audio: urlBase + "aniversarioadolescenteaudio.mp3",
    tirinhaDigital: urlBase + "fototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "fototirinhaimpressa.jpg",
    foto10x15: urlBase + "foto10x15.jpg",
    gif1: urlBase + "gif1.mp4",
    gif2: urlBase + "gif2.mp4",
    guestbook: {
      audio: null,
      imagens: GUESTBOOK_IMAGENS
    },
    orcamentos: {
      "2h": urlBase3 + "orcamentoFotoCabineAdolescente2h.pdf",
      "3h": urlBase3 + "orcamentoFotoCabineAdolescente3h.pdf",
      "3h4h": urlBase3 + "orcamentoFotoCabineAdolescente3h4h.pdf",
      "4h5h": urlBase3 + "orcamentoFotoCabineAdolescente4h5h.pdf",
      "5h6h": urlBase3 + "orcamentoFotoCabineAdolescente5h6h.pdf"
    }
  },

  5: { // Adulto
    nome: "Aniversário Adulto",
    audio: urlBase + "aniversarioadultoaudio.mp3",
    tirinhaDigital: urlBase + "aniversarioadultofototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "aniversarioadultofototirinhaimpressa.jpg",
    foto10x15: urlBase + "aniversarioadultoGiffoto10x15.jpg",
    gif1: urlBase + "aniversarioadultoGif1.mp4",
    gif2: urlBase + "aniversarioadultoGif2.mp4",
    guestbook: {
      audio: null,
      imagens: GUESTBOOK_IMAGENS
    },
    orcamentos: {
      "2h": urlBase3 + "orcamentoFotoCabineAdulto2h.pdf",
      "3h": urlBase3 + "orcamentoFotoCabineAdulto3h.pdf",
      "3h4h": urlBase3 + "orcamentoFotoCabineAdulto3h4h.pdf",
      "4h5h": urlBase3 + "orcamentoFotoCabineAdulto4h5h.pdf",
      "5h6h": urlBase3 + "orcamentoFotoCabineAdulto5h6h.pdf"
    }
  },

  6: { // Bodas
    nome: "Bodas",
    audio: null,
    tirinhaDigital: urlBase + "bodasfototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "bodasfototirinhaimpressa.jpg",
    foto10x15: urlBase + "bodasfotot10x15.jpg",
    gif1: urlBase + "bodasGif1.mp4",
    gif2: urlBase + "bodasGif2.mp4",
    guestbook: {
      audio: urlBase + "guestbookaudiobodas.mp3",
      imagens: GUESTBOOK_IMAGENS
    },
    orcamentos: {
      "2h": urlBase3 + "orcamentoFotoCabineBodas2h.pdf",
      "3h": urlBase3 + "orcamentoFotoCabineBodas3h.pdf",
      "3h4h": urlBase3 + "orcamentoFotoCabineBodas3h4h.pdf",
      "4h5h": urlBase3 + "orcamentoFotoCabineBodas4h5h.pdf",
      "5h6h": urlBase3 + "orcamentoFotoCabineBodas5h6h.pdf"
    }
  },

  7: { // Formatura
    nome: "Formatura",
    audio: urlBase1 + "formaturaaudio.mp3",
    tirinhaDigital: urlBase1 + "formaturafototirinhadigital.jpg",
    tirinhaImpressa: urlBase1 + "formaturafototirinhaimpressa.jpg",
    foto10x15: urlBase1 + "formaturafoto10x15.jpg",
    gif1: urlBase1 + "formaturaGif1.mp4",
    gif2: urlBase1 + "formaturaGif2.mp4",
    guestbook: null,
    orcamentoMenos200_2h: urlBase3 + "orcamentoFotoCabineFormatura12h.pdf",
    orcamentoMenos200_3h: urlBase3 + "orcamentoFotoCabineFormatura13h.pdf",
    orcamentoMenos200_4h: urlBase3 + "orcamentoFotoCabineFormatura13h4h.pdf",
    orcamentoMenos200_5h: urlBase3 + "orcamentoFotoCabineFormatura14h5h.pdf",
    orcamentoMenos200_6h: urlBase3 + "orcamentoFotoCabineFormatura15h6h.pdf",
    orcamentoMenos200_7h: urlBase3 + "orcamentoFotoCabineFormatura16h7h.pdf",
    orcamentoMenos200_8h: urlBase3 + "orcamentoFotoCabineFormatura17h8h.pdf",
    orcamentoMenos200_9h: urlBase3 + "orcamentoFotoCabineFormatura18h9h.pdf",
    orcamentoMenos200_10h: urlBase3 + "orcamentoFotoCabineFormatura19h10h.pdf",
    orcamentoMais200_2h: urlBase3 + "orcamentoFotoCabineFormatura22h.pdf",
    orcamentoMais200_3h: urlBase3 + "orcamentoFotoCabineFormatura23h.pdf",
    orcamentoMais200_4h: urlBase3 + "orcamentoFotoCabineFormatura23h4h.pdf",
    orcamentoMais200_5h: urlBase3 + "orcamentoFotoCabineFormatura24h5h.pdf",
    orcamentoMais200_6h: urlBase3 + "orcamentoFotoCabineFormatura25h6h.pdf",
    orcamentoMais200_7h: urlBase3 + "orcamentoFotoCabineFormatura26h7h.pdf",
    orcamentoMais200_8h: urlBase3 + "orcamentoFotoCabineFormatura27h8h.pdf",
    orcamentoMais200_9h: urlBase3 + "orcamentoFotoCabineFormatura28h9h.pdf",
    orcamentoMais200_10h: urlBase3 + "orcamentoFotoCabineFormatura29h10h.pdf"
  },

  8: { // Corporativo
    nome: "Evento Corporativo",
    audio: null,
    tirinhaDigital: urlBase1 + "corporativofototirinhadigital.jpg",
    tirinhaImpressa: urlBase1 + "corporativofototirinhaimpressa.jpg",
    foto10x15: urlBase1 + "corporativofoto10x15.jpg",
    gif1: urlBase1 + "corporativoGif1.mp4",
    gif2: urlBase1 + "corporativoGif2.mp4",
    guestbook: null,
    orcamentoMenos200_2h: urlBase3 + "orcamentoFotoCabineCorporativo12h.pdf",
    orcamentoMenos200_3h: urlBase3 + "orcamentoFotoCabineCorporativo13h.pdf",
    orcamentoMenos200_4h: urlBase3 + "orcamentoFotoCabineCorporativo13h4h.pdf",
    orcamentoMenos200_5h: urlBase3 + "orcamentoFotoCabineCorporativo14h5h.pdf",
    orcamentoMenos200_6h: urlBase3 + "orcamentoFotoCabineCorporativo15h6h.pdf",
    orcamentoMenos200_7h: urlBase3 + "orcamentoFotoCabineCorporativo16h7h.pdf",
    orcamentoMenos200_8h: urlBase3 + "orcamentoFotoCabineCorporativo17h8h.pdf",
    orcamentoMenos200_9h: urlBase3 + "orcamentoFotoCabineCorporativo18h9h.pdf",
    orcamentoMenos200_10h: urlBase3 + "orcamentoFotoCabineCorporativo19h10h.pdf",
    orcamentoMais200_2h: urlBase3 + "orcamentoFotoCabineCorporativo22h.pdf",
    orcamentoMais200_3h: urlBase3 + "orcamentoFotoCabineCorporativo23h.pdf",
    orcamentoMais200_4h: urlBase3 + "orcamentoFotoCabineCorporativo23h4h.pdf",
    orcamentoMais200_5h: urlBase3 + "orcamentoFotoCabineCorporativo24h5h.pdf",
    orcamentoMais200_6h: urlBase3 + "orcamentoFotoCabineCorporativo25h6h.pdf",
    orcamentoMais200_7h: urlBase3 + "orcamentoFotoCabineCorporativo26h7h.pdf",
    orcamentoMais200_8h: urlBase3 + "orcamentoFotoCabineCorporativo27h8h.pdf",
    orcamentoMais200_9h: urlBase3 + "orcamentoFotoCabineCorporativo28h9h.pdf",
    orcamentoMais200_10h: urlBase3 + "orcamentoFotoCabineCorporativo29h10h.pdf"
  },

  9: { // Outros
    nome: "o seu Evento",
    audio: null,
    tirinhaDigital: urlBase + "fototirinhadigital.jpg",
    tirinhaImpressa: urlBase + "fototirinhaimpressa.jpg",
    foto10x15: urlBase + "foto10x15.jpg",
    gif1: urlBase + "gif1.mp4",
    gif2: urlBase + "gif2.mp4",
    guestbook: null,
    orcamentoMenos200_2h: urlBase3 + "orcamentoFotoCabineOutros12h.pdf",
    orcamentoMenos200_3h: urlBase3 + "orcamentoFotoCabineOutros13h.pdf",
    orcamentoMenos200_4h: urlBase3 + "orcamentoFotoCabineOutros13h4h.pdf",
    orcamentoMenos200_5h: urlBase3 + "orcamentoFotoCabineOutros14h5h.pdf",
    orcamentoMenos200_6h: urlBase3 + "orcamentoFotoCabineOutros15h6h.pdf",
    orcamentoMenos200_7h: urlBase3 + "orcamentoFotoCabineOutros16h7h.pdf",
    orcamentoMenos200_8h: urlBase3 + "orcamentoFotoCabineOutros17h8h.pdf",
    orcamentoMenos200_9h: urlBase3 + "orcamentoFotoCabineOutros18h9h.pdf",
    orcamentoMenos200_10h: urlBase3 + "orcamentoFotoCabineOutros19h10h.pdf",
    orcamentoMais200_2h: urlBase3 + "orcamentoFotoCabineOutros22h.pdf",
    orcamentoMais200_3h: urlBase3 + "orcamentoFotoCabineOutros23h.pdf",
    orcamentoMais200_4h: urlBase3 + "orcamentoFotoCabineOutros23h4h.pdf",
    orcamentoMais200_5h: urlBase3 + "orcamentoFotoCabineOutros24h5h.pdf",
    orcamentoMais200_6h: urlBase3 + "orcamentoFotoCabineOutros25h6h.pdf",
    orcamentoMais200_7h: urlBase3 + "orcamentoFotoCabineOutros26h7h.pdf",
    orcamentoMais200_8h: urlBase3 + "orcamentoFotoCabineOutros27h8h.pdf",
    orcamentoMais200_9h: urlBase3 + "orcamentoFotoCabineOutros28h9h.pdf",
    orcamentoMais200_10h: urlBase3 + "orcamentoFotoCabineOutros29h10h.pdf"
  }
};

// ======================================================
// FUNÇÃO — Envia o fluxo atualizado da Foto Cabine
// ======================================================
async function enviarFluxoPadrao(chatId, evento, clb) {

  // 1) Mensagem de abertura

  // ======================================================
  // ABERTURA
  // ======================================================
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, `*<<<< FOTO CABINE >>>>*`);

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, `O serviço de 📸 *Foto Cabine* é uma excelente escolha para *${evento.nome}*!`);

  // 14) Audio celebrações, exceto Corporativo e outros
  if (evento.audio) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, evento.audio, "AUDIO", "");
  }

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Nossa *Foto Cabine* possui 3 pacotes: *Premium*, *Tirinha* e *Gold*. Em todos eles as fotos são *ilimitadas*, ou seja, os convidados podem tirar fotos quantas vezes desejarem. 🎉"
  );

  // 2) Mini camarim
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Levamos um *mini camarim animado* com óculos, chapéus, perucas, boás de plumas e muito mais, para os convidados fazerem aquela foto maluca super divertida. 😄\n\n" +
    "Mas quem preferir pode fazer sua foto especial sem acessórios também."
  );

  if (estaPausado(chatId)) return;
  await sendTyping(chatId);
  await delay(300);
  await sendFileByUrl(chatId, urlBase + "fotocabineacessorios.jpg", "IMAGE", "");

  // 3) Acessórios
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Levamos uma grande variedade de acessórios 😍");

  // 4) Vídeo da cabine
  await sendTyping(chatId);
  await delay(500); // VÍDEO
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase + "fotocabine.mp4", "VIDEO", "");

  // 5) Diversão
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Contratando nossa *Foto Cabine*, a diversão é garantida no seu evento!");

  await sendTyping(chatId);
  await delay(6000);
  
  await enviarYoutube(chatId, "https://youtube.com/shorts/ACFx52czRnE");
  await delay(1000);

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase + "diversao.jpg", "IMAGE", "");

  await sendTyping(chatId);
  await delay(500); // VÍDEO
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, urlBase + "diversao.mp4", "VIDEO", "");

  // 6) Pacotes da Foto Cabine
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "*📦 Pacotes da Foto Cabine*");

  // Como funciona
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Ao chegar na frente do Totem, o nosso sistema permite que os convidados escolham o modelo da foto que desejam receber, *foto tirinha* ou *foto 10x15* (*Pacote Premium e Gold*), eles fazem uma sequência de 4 fotos e ao terminarem recebem a foto impressa");

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

  // 7) Explicação sobre arquivos digitais
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(
    chatId,
    "Nosso sistema também permite que os convidados façam o *download da versão digital* da foto impressa, das *4 fotos capturadas dentro da cabine* e ainda recebam um *GIF animado* com essas imagens. 🔥"
  );

  // 8) Texto especial para corporativo
  if (clb === 8) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "*Além disso, nossa equipe incentiva de forma natural e estratégica a interação dos participantes com as redes sociais da empresa, aumentando o engajamento e ampliando o alcance do evento, tudo isso na hora e direto no seu aparelho celular.* ⬇️"
    );
  }

  // 9) Foto 10x15
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, evento.foto10x15, "IMAGE", "");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Foto 10x15 ☝️");

  // 10) GIFs
  await sendTyping(chatId);
  await delay(500); // VÍDEO
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, evento.gif1, "VIDEO", "");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "GIF Animado ☝️");

  // 11) Tirinha Digital
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, evento.tirinhaDigital, "IMAGE", "");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Foto Tirinha Digital ☝️");

  // 12) Tirinha Impressa
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, evento.tirinhaImpressa, "IMAGE", "");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Foto Tirinha Impressa ☝️");

  // 13) GIFs
  await sendTyping(chatId);
  await delay(500); // VÍDEO
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, evento.gif2, "VIDEO", "");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "GIF Animado ☝️");

  // 14) Guestbook — 15 anos, Casamento, Bodas e todos os Aniversários
  if (evento.guestbook) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "*📘 Guestbook (Álbum de Assinaturas)*");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "O Guestbook é um álbum digital onde os convidados deixam mensagens especiais em vídeo ou foto, criando uma lembrança emocionante e inesquecível do seu evento. 💖"
    );

    // Áudio específico da celebração (15 anos, casamento, bodas) — aniversários não têm
    if (evento.guestbook.audio) {
      await sendTyping(chatId);
      await delay(300);
      if (estaPausado(chatId)) return;
      await sendFileByUrl(chatId, evento.guestbook.audio, "AUDIO", "");
    }

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "Confira alguns registros reais feitos no Guestbook:");

    for (const arquivo of evento.guestbook.imagens) {
      const tipo = arquivo.endsWith(".mp4") ? "VIDEO" : "IMAGE";

      await sendTyping(chatId);
      await delay(tipo === "VIDEO" ? 500 : 300);

      if (estaPausado(chatId)) return;
      await sendFileByUrl(chatId, arquivo, tipo, "");
    }
  }

  // 15) Moldura + 16) Como contratar — suprimidos quando não for o último serviço
  const _mp1 = sessions[chatId]?._envioMultiplo || {};
  const _moldura1 = _mp1.ehUltimoComMoldura ?? true;
  const _ultimo1  = _mp1.ehUltimo ?? true;

  if (_moldura1) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🖼️ Moldura da Foto (Arte):");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "molduradasfotos.mp3", "AUDIO", "");
  }

  if (_ultimo1) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "💼 Como contratar nossos serviços:");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
  }
}

// ======================================================
// FUNÇÃO — Enviar orçamento (PDF correto)
// ======================================================
async function enviarOrcamento(chatId, evento, clb, convidados, duracao, diasCorporativo) {

  const horas = extrairHoras(duracao, clb);

  // ============================
  //  CASO ESPECIAL — CORPORATIVO
  // ============================
  if (clb === 8) {

    // Se dias > 1 → orçamento especial
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

    // Seleção da tabela correta (Menos200 / Mais200)
    const tabela = convidados < 200
      ? {
          "2h": evento.orcamentoMenos200_2h,
          "3h": evento.orcamentoMenos200_3h,
          "3h4h": evento.orcamentoMenos200_4h,
          "4h5h": evento.orcamentoMenos200_5h,
          "5h6h": evento.orcamentoMenos200_6h,
          "6h7h": evento.orcamentoMenos200_7h,
          "7h8h": evento.orcamentoMenos200_8h,
          "8h9h": evento.orcamentoMenos200_9h,
          "9h10h": evento.orcamentoMenos200_10h
        }
      : {
          "2h": evento.orcamentoMais200_2h,
          "3h": evento.orcamentoMais200_3h,
          "3h4h": evento.orcamentoMais200_4h,
          "4h5h": evento.orcamentoMais200_5h,
          "5h6h": evento.orcamentoMais200_6h,
          "6h7h": evento.orcamentoMais200_7h,
          "7h8h": evento.orcamentoMais200_8h,
          "8h9h": evento.orcamentoMais200_9h,
          "9h10h": evento.orcamentoMais200_10h
        };

    const pdf = selecionarPdfPadrao(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId); 
    await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Cabine* 📸✨");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;

    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Foto-Cabine",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 1 }
    );

    return;
  }

  // ============================
  //  FORMÁTURA (7) E OUTROS (9)
  //  usam a mesma lógica do corporativo
  //  (Menos200 / Mais200)
  // ============================
  if (clb === 7 || clb === 9) {

    const tabela = convidados < 200
      ? {
          "2h": evento.orcamentoMenos200_2h,
          "3h": evento.orcamentoMenos200_3h,
          "3h4h": evento.orcamentoMenos200_4h,
          "4h5h": evento.orcamentoMenos200_5h,
          "5h6h": evento.orcamentoMenos200_6h,
          "6h7h": evento.orcamentoMenos200_7h,
          "7h8h": evento.orcamentoMenos200_8h,
          "8h9h": evento.orcamentoMenos200_9h,
          "9h10h": evento.orcamentoMenos200_10h
        }
      : {
          "2h": evento.orcamentoMais200_2h,
          "3h": evento.orcamentoMais200_3h,
          "3h4h": evento.orcamentoMais200_4h,
          "4h5h": evento.orcamentoMais200_5h,
          "5h6h": evento.orcamentoMais200_6h,
          "6h7h": evento.orcamentoMais200_7h,
          "7h8h": evento.orcamentoMais200_8h,
          "8h9h": evento.orcamentoMais200_9h,
          "9h10h": evento.orcamentoMais200_10h
        };

    const pdf = selecionarPdfPadrao(tabela, horas, true);

    // Envio do PDF
    await sendTyping(chatId); 
    await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Cabine* 📸✨");

    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;

    await enviarPdfComLink(
      chatId,
      pdf,
      "Orcamento-Foto-Cabine",
      sendTyping,
      sendText,
      sendFileByUrl,
      { session: sessions[chatId], servicoId: 1 }
    );

    return;
  }

  // ============================
  //  EVENTOS NORMAIS (1 a 6)
  // ============================
  const pdf = selecionarPdfPadrao(evento.orcamentos, horas);

  // Envio do PDF
  await sendTyping(chatId); 
  await delay(300);
  if (estaPausado(chatId)) return;

  await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Foto Cabine* 📸✨");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;

  await enviarPdfComLink(
    chatId,
    pdf,
    "Orcamento-Foto-Cabine",
    sendTyping,
    sendText,
    sendFileByUrl,
    { session: sessions[chatId], servicoId: 1 }
  );
}

// ======================================================
// FUNÇÃO PRINCIPAL — enviarFotoCabine()
// ======================================================
async function enviarFotoCabine(chatId, clb, convidados, sessionsRef, operatorPaused) {

  if (sessionsRef[chatId]?.enviandoFotoCabine) {
    console.log(`⚠️ Foto Cabine já está sendo enviada para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoFotoCabine = true;

  try {
    if (operatorPaused || sessionsRef[chatId]?.pausado) return;

    const evento = eventos[clb];
    if (!evento) {
      if (sessionsRef[chatId]?.pausado) return;
      await sendText(chatId, "❌ Tipo de celebração inválido para Foto Cabine.");
      return;
    }

    const duracao = sessionsRef[chatId]?.orcamento?.horas?.toString() || "";
    const diasCorporativo = sessionsRef[chatId]?.orcamento?.dias || 1;

    // Fluxo completo da cabine (as fotos/vídeos = os DETALHES).
    // apenasOrcamento: manda só o preço, sem a apresentação. É o espelho do
    // apenasFluxo abaixo, e serve ao fluxo novo (2026-07-15): o cliente
    // recebe o orçamento primeiro e só vê os detalhes se pedir.
    if (!sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      await enviarFluxoPadrao(chatId, evento, clb);
    }

    // Multi-dia: apenas apresentação, orçamento enviado no resumo central
    if (sessions[chatId]?._envioMultiplo?.apenasFluxo) return;

    // Envio do orçamento
    await enviarOrcamento(
      chatId,
      evento,
      clb,
      convidados,
      duracao,
      diasCorporativo
    );

  } catch (error) {
    console.error(`❌ Erro ao enviar Foto Cabine para ${chatId}:`, error);
    if (!sessionsRef[chatId]?.pausado) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento de Foto Cabine. Tente novamente.");
    }
  } finally {
    if (sessionsRef[chatId]) {
      sessionsRef[chatId].enviandoFotoCabine = false;

      if (!sessionsRef[chatId].orcamento.servicosEnviados.includes(1)) {
        sessionsRef[chatId].orcamento.servicosEnviados.push(1);
      }
    }
  }
}

module.exports = { enviarFotoCabine, enviarOrcamento };
