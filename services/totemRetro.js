// services/totemRetro.js
//
// Cópia do totemFotografico.js com 3 diferenças de propósito:
//   1) todo "Totem Fotográfico" virou "Totem Retrô";
//   2) as fotos do equipamento são as do Retrô (as fotos IMPRESSAS e os GIFs
//      continuam sendo os do Totem, porque a impressão é a mesma — o que muda
//      é a máquina);
//   3) o orçamento NÃO vem de PDF estático: é gerado na hora pelo PhotoMusic
//      Pro (utils/orcamentoApi.js). O Totem Retrô nunca teve PDF pronto, então
//      ele é o primeiro serviço a rodar no orçamento automático.
//
// 🚧 EM TESTE: o Totem Retrô ainda NÃO aparece no menu de serviços. Ele entra
// pelo número escondido 0 e pelo comando #totemretro. Quando o Mario validar,
// vira o nº 2 do menu e a numeração dos outros anda uma casa.

// ======================================================================
// IMPORTS
// ======================================================================
const { sendText, sendTyping, sendFileByUrl, enviarPdfComLink, gerarOrcamento } = require("../utils/index.js");
const { urlBase, urlBase3, urlBase4, OPERADOR_TELEFONE_ID } = require("../utils/config.js");
const { sessions } = require("../utils/sessions");
const { estaPausado } = require("../utils/pauseControl.js");

// Id do serviço no PhotoMusic Pro. 🚨 No endpoint ele entra por SLUG, nunca por
// este número: "13" seria lido como os dígitos 1 e 3 do menu do bot.
const SERVICO_ID   = 13;
const SERVICO_SLUG = "totem-retro";

// Fotos do equipamento. São só 3 por enquanto (fotos e vídeos próprios entram
// depois; o Mario decidiu subir com o que já existe porque os clientes estão
// chegando do Instagram).
const FOTO_RETRO_1 = urlBase4 + "totemretro1.jpg";
const FOTO_RETRO_2 = urlBase4 + "totemretro2.jpg";
const FOTO_RETRO_3 = urlBase4 + "totemretro3.jpg";

// ======================================================================
// DELAY
// ======================================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================================================================
// MENSAGEM DE ABERTURA
// ======================================================================
function mensagemAberturaRetro(clb) {
  switch (clb) {
    case 1: return "📸 O *Totem Retrô* é uma excelente escolha para sua festa de 15 anos!";
    case 2: return "📸 O *Totem Retrô* é uma excelente escolha para o seu casamento!";
    case 3: return "📸 O *Totem Retrô* é uma excelente escolha para o aniversário infantil!";
    case 4: return "📸 O *Totem Retrô* é uma excelente escolha para o aniversário adolescente!";
    case 5: return "📸 O *Totem Retrô* é uma excelente escolha para o aniversário adulto!";
    case 6: return "📸 O *Totem Retrô* é uma excelente escolha para suas Bodas!";
    case 7: return "📸 O *Totem Retrô* é uma excelente escolha para sua Formatura!";
    case 8: return "📸 O *Totem Retrô* é uma excelente escolha para seu Evento Corporativo!";
    case 9: return "📸 O *Totem Retrô* é uma excelente escolha para seu evento!";
    default: return "📸 O *Totem Retrô* é uma excelente escolha para seu evento!";
  }
}

// ======================================================================
// EVENTOS DO TOTEM RETRÔ — guestbook só para 15 anos, casamento e bodas
// Os arquivos do guestbook são genéricos, valem para qualquer equipamento.
// ======================================================================
const eventosRetro = {
  1: {
    nome: "15 anos",
    guestbook: {
      audio: urlBase + "guestbookaudio15anos.mp3",
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
// ARQUIVOS DIGITAIS — iguais aos do Totem Fotográfico de propósito.
// A foto que sai impressa e o GIF são o mesmo produto; o que muda é a máquina.
// ======================================================================
const arquivosRetro = {
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
// FLUXO COMPLETO DO TOTEM RETRÔ (os DETALHES)
// ======================================================================
async function enviarFluxoRetro(chatId, clb) {

  if (estaPausado(chatId)) return;

  // Flags de deduplicação (definidas por enviarMultiplosOrcamentos)
  const _mpR = sessions[chatId]?._envioMultiplo || {};
  const _molduraR = _mpR.ehUltimoComMoldura ?? true;
  const _ultimoR  = _mpR.ehUltimo ?? true;
  const _listaR   = _mpR.servicosNaLista || [];

  // Abertura
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, `*<<<< TOTEM RETRÔ >>>>*`);

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, mensagemAberturaRetro(clb));

  // É a novidade da casa — vale dizer.
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "🆕 Ele é a *nossa novidade*, com visual retrô que combina com qualquer decoração e vira cenário na festa 😍");

  // Quando o cliente pediu o Totem Fotográfico junto: explicar o que muda
  if (_listaR.includes(2)) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "✨ *A diferença para o Totem Fotográfico:*\n\n" +
      "A experiência e as fotos são as mesmas, o que muda é o *visual do equipamento*. " +
      "O Retrô tem acabamento vintage e chama atenção na decoração — muita gente fotografa o próprio totem! 📷"
    );
  } else if (_listaR.includes(1)) {
    // Mesma explicação do Totem Fotográfico: o fundo é o ambiente da festa
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "✨ *Uma coisa importante sobre a diferença entre os dois serviços:*\n\n" +
      "No Totem Retrô, diferente da Cabine, o fundo da foto é o *próprio ambiente da sua festa* — " +
      "capturando o clima, a decoração e a energia do evento. " +
      "É uma experiência completamente diferente e que combina perfeitamente com a Cabine! 🎉"
    );
  }

  // Introdução
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Nosso *Totem Retrô* possui 3 pacotes: *Premium*, *Tirinha* e *Gold*. Em todos eles as fotos são *ilimitadas* 🎉");

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Levamos um *mini camarim animado* com óculos, chapéus, perucas e muito mais 😄");

  // Fotos principais
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "Confira algumas fotos do nosso Totem Retrô:");

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, FOTO_RETRO_1, "IMAGE", "");
  await delay(500);

  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, FOTO_RETRO_2, "IMAGE", "");
  await delay(500);

  // Funcionamento
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "O convidado escolhe entre *Tirinha 05x15* ou *Foto 10x15*, faz 4 fotos e recebe a impressão na hora.");

  // ⏳ Aqui o Totem Fotográfico manda vídeo + foto. O Retrô ainda não tem vídeo
  // próprio, então vai a 3ª foto. Trocar quando as fotos e vídeos novos ficarem
  // prontos (decisão do Mario: subir agora com o que existe).
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, FOTO_RETRO_3, "IMAGE", "");
  await delay(500);

  // Guestbook (somente 15 anos, casamento e bodas)
  const evento = eventosRetro[clb];
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

  // Pacotes — versão resumida quando o cliente já viu Cabine ou Totem
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "*📦 Pacotes do Totem Retrô*");

  if (_listaR.includes(1) || _listaR.includes(2)) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "O Totem Retrô trabalha com os mesmos pacotes *Premium*, *Tirinha* e *Gold* que você já viu — " +
      "com as mesmas regras de quantidade de pessoas e revelação por vez. 😊\n\n" +
      "O que muda é o *visual do equipamento*, que entra na decoração da festa. 🎉"
    );
  } else {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "O nosso sistema permite que os convidados escolham o modelo da foto que desejam receber, *foto tirinha* ou *foto 10x15* (*Pacote Premium e Gold*), eles fazem uma sequência de 4 fotos e ao saírem recebem a foto impressa"
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
  if ([1, 3, 4, 5].includes(clb)) midias = arquivosRetro.aniversario;
  if ([2, 6].includes(clb)) midias = arquivosRetro.casamento;
  if ([7, 8, 9].includes(clb)) midias = arquivosRetro.corporativo;

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
    "Os convidados também podem baixar a *versão digital*, das *4 fotos capturadas pelo Totem Retrô* e um *GIF animado da 4 fotos* 🔥"
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
  if (_molduraR) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "🖼️ Moldura da Foto (Arte):");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "molduradasfotos.mp3", "AUDIO", "");
    await delay(300);
  }

  if (_ultimoR) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, "💼 Como contratar nossos serviços:");

    if (estaPausado(chatId)) return;
    await sendFileByUrl(chatId, urlBase + "comocontratar.mp3", "AUDIO", "");
  }
}

// ======================================================================
// FUNÇÃO — Orçamento do Totem Retrô (GERADO NA HORA pelo PhotoMusic Pro)
// ======================================================================
async function enviarOrcamentoRetro(chatId, clb, diasCorporativo) {

  // Regra especial mantida do Totem: corporativo de mais de 1 dia não recebe
  // PDF automático, o orçamento é montado a mão.
  if (clb === 8 && diasCorporativo > 1) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;

    await sendText(
      chatId,
      "📊 Estamos preparando um *orçamento especial* para o seu evento corporativo.\n" +
      "Enviaremos o quanto antes! 😊"
    );

    return;
  }

  /* 🚨 O TÍTULO TEM QUE VIR ANTES DA FOTO (Mario pegou no teste do cliente,
     17/08/2026). O `*<<<< TOTEM RETRÔ >>>>*` mora no enviarFluxoRetro(), que é
     justamente o bloco PULADO no envio enxuto (`apenasOrcamento`). Resultado: a
     foto do equipamento chegava solta, logo depois da avaliação, sem nada dizer
     de que serviço era.
     Só mandamos aqui quando o fluxo completo NÃO rodou, senão sai duas vezes.
     📌 Nos outros 8 serviços isso não aparecia porque nenhum manda foto antes
     do preço; quem identifica lá é a frase "Segue o orçamento da <serviço>".
     Quando a foto for replicada neles, o título tem que ir junto. */
  const _soOrcamento = !!sessions[chatId]?._envioMultiplo?.apenasOrcamento;
  if (_soOrcamento) {
    await sendTyping(chatId);
    await delay(300);
    if (estaPausado(chatId)) return;
    await sendText(chatId, `*<<<< TOTEM RETRÔ >>>>*`);
  }

  // Foto do serviço ANTES do orçamento: no envio enxuto o cliente recebe o PDF
  // sem ter visto nada do equipamento, e ficava difícil VISUALIZAR o
  // equipamento que está contratando (a razão é essa, não identificar o
  // serviço). A foto vai sempre, mesmo no fluxo completo, porque ela abre o
  // bloco de preço.
  if (estaPausado(chatId)) return;
  await sendFileByUrl(chatId, FOTO_RETRO_1, "IMAGE", "");
  await delay(500);

  // 🚨 GERA ANTES DE ANUNCIAR. Na primeira versão o bot dizia "Segue o arquivo"
  // e só depois tentava gerar; quando falhava, o cliente lia "Segue o arquivo"
  // seguido de "estou finalizando", uma contradição (Mario pegou no 1º teste).
  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;

  let dados;
  try {
    dados = await gerarOrcamento(sessions[chatId], chatId, [SERVICO_SLUG]);
  } catch (erro) {
    console.error(`🚨 [totemRetro] Orçamento automático falhou para ${chatId}: ${erro.codigo} — ${erro.message}`);

    // Avisa o OPERADOR com o motivo. Sem isso a falha só aparecia no log do
    // Fly e o Mario ficava sem saber por que o cliente não recebeu o PDF.
    try {
      await sendText(
        OPERADOR_TELEFONE_ID,
        `🚨 *Orçamento do Totem Retrô não saiu*\n` +
        `Cliente: ${String(chatId).replace(/\D+/g, "")}\n` +
        `Motivo: *${erro.codigo}*\n${erro.message}`
      );
    } catch (e) {
      console.error("⚠️ Não consegui avisar o operador:", e.message);
    }

    if (estaPausado(chatId)) return;
    await sendText(
      chatId,
      "📊 Estou finalizando o seu orçamento do *Totem Retrô* e te envio em instantes! 😊"
    );

    return;
  }

  await sendTyping(chatId);
  await delay(300);
  if (estaPausado(chatId)) return;
  await sendText(chatId, "💰 Segue o arquivo com o orçamento do *Totem Retrô!* 📸✨");

  if (estaPausado(chatId)) return;

  await enviarPdfComLink(
    chatId,
    dados.url,
    "Orcamento-Totem-Retro",
    sendTyping,
    sendText,
    sendFileByUrl,
    { session: sessions[chatId], servicoId: SERVICO_ID }
  );
}

// ======================================================================
// FUNÇÃO PRINCIPAL — enviarTotemRetro()
// ======================================================================
async function enviarTotemRetro(chatId, clb, convidados, sessionsRef, operatorPaused) {

  // Se operador pausou ou cliente pausado → não envia nada
  if (operatorPaused || estaPausado(chatId)) return;

  // Evita envio duplicado
  if (sessionsRef[chatId]?.enviandoTotemRetro) {
    console.log(`⚠️ Já está enviando Totem Retrô para ${chatId}`);
    return;
  }
  sessionsRef[chatId].enviandoTotemRetro = true;

  try {
    const diasCorporativo = sessionsRef[chatId]?.orcamento?.dias || 1;

    // 1) Fluxo completo (os DETALHES). apenasOrcamento = só o preço.
    if (!sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      await enviarFluxoRetro(chatId, clb);
    }
    if (estaPausado(chatId)) return;

    // Multi-dia: apenas apresentação, orçamento enviado no resumo central
    if (sessions[chatId]?._envioMultiplo?.apenasFluxo) return;

    // 2) Orçamento gerado na hora
    await enviarOrcamentoRetro(chatId, clb, diasCorporativo);

    // GuestBook: no envio ENXUTO o fluxo completo não roda e ele sumia da
    // proposta. Volta em 1 mensagem + 4 arquivos. Ver services/guestbook.js.
    if (sessions[chatId]?._envioMultiplo?.apenasOrcamento) {
      try {
        const { enviarGuestbook } = require("./guestbook.js");
        await enviarGuestbook(chatId, clb, "Totem Retrô");
      } catch (e) {
        console.error("⚠️ GuestBook (Totem Retrô):", e.message);
      }
    }

  } catch (error) {
    console.error(`❌ Erro ao enviar Totem Retrô para ${chatId}:`, error);

    if (!estaPausado(chatId)) {
      await sendText(chatId, "❌ Ocorreu um erro ao enviar o orçamento do Totem Retrô. Tente novamente.");
    }

  } finally {
    // Libera o envio
    if (sessionsRef[chatId]) {
      sessionsRef[chatId].enviandoTotemRetro = false;

      if (!sessionsRef[chatId].servicosEnviados) sessionsRef[chatId].servicosEnviados = [];
      if (!sessionsRef[chatId].servicosEnviados.includes(SERVICO_ID)) {
        sessionsRef[chatId].servicosEnviados.push(SERVICO_ID);
      }
    }
  }
}

module.exports = { enviarTotemRetro };
