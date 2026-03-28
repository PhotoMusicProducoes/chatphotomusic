// services/eventos.js
// Fluxo de download/visualização de fotos — lê eventos do banco de dados WordPress

const { sendText, sendTyping } = require("../utils/index.js");
const { PM_SITE_URL, PM_API_KEY } = require("../utils/config.js");

// ======================================================
// ÍCONES POR TIPO DE SERVIÇO
// ======================================================
const TIPO_ICONE = {
  foto_cabine : "📸",
  totem       : "🏛️",
  "360"       : "🎡",
  paparazzi   : "🎭",
  lembranca   : "🖼️",
  video       : "🎥",
  gif         : "🎞️",
  outro       : "📎",
};

// ======================================================
// BUSCA OS EVENTOS DE HOJE NO BANCO DE DADOS WORDPRESS
// ======================================================
async function buscarEventos() {
  try {
    const url = `${PM_SITE_URL}/wp-json/photomusic/v1/eventos-hoje`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-PM-API-Key": PM_API_KEY,
        "Accept"       : "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `[Eventos] Erro na API WordPress: HTTP ${response.status} → ${url}`
      );
      return [];
    }

    const dados = await response.json();

    if (!Array.isArray(dados)) {
      console.error("[Eventos] Resposta da API não é um array:", dados);
      return [];
    }

    console.log(`[Eventos] ${dados.length} evento(s) encontrado(s) hoje.`);
    return dados;

  } catch (error) {
    console.error("[Eventos] Erro ao buscar eventos:", error.message);
    return [];
  }
}

// ======================================================
// MONTA A MENSAGEM DO EVENTO ESCOLHIDO
// ======================================================
async function apresentarEvento(numeroEvento) {

  const eventos = await buscarEventos();

  // Aceita busca por número (string "1", "2"...) ou por id numérico
  const evento = eventos.find(
    (e) => e.numero === String(numeroEvento) || e.id === Number(numeroEvento)
  );

  if (!evento) {
    return "Evento não encontrado. Verifique o número digitado!";
  }

  // Cabeçalho
  let resposta = `🎉 *${evento.nome}*\n\n`;

  // ======================================================
  // VERIFICA SE TEM VÍDEO (360)
  // ======================================================
  let temVideo = false;

  if (evento.servicos && evento.servicos.length > 0) {
    temVideo = evento.servicos.some(s => s.tipo === "360" || s.tipo === "video");
  }

  // ======================================================
  // TEXTO PRINCIPAL
  // ======================================================
  if (temVideo) {
    resposta += `Para acessar suas *fotos e vídeos* com segurança, clique abaixo:\n\n`;
  } else {
    resposta += `Para acessar suas *fotos* com segurança, clique abaixo:\n\n`;
  }

  // ======================================================
  // LINK DE ACEITE (ÚNICO)
  // ======================================================
  resposta += `👉 ${evento.link_aceite}\n\n`;

  // ======================================================
  // INSTRUÇÕES (ATUALIZADAS PARA O NOVO FLUXO)
  // ======================================================
  resposta += `*Como acessar suas fotos:*\n`;
  resposta += `*1º* Clique no link acima;\n`;
  resposta += `*2º* Preencha seus dados e aceite o termo;\n`;
  resposta += `*3º* Acesse a galeria do evento;\n`;
  resposta += `*4º* Procure sua foto;\n`;
  resposta += `*5º* Clique na foto para visualizar ou baixar.\n\n`;

  // ======================================================
  // OBSERVAÇÕES
  // ======================================================
  resposta += `⚠️ Este link é pessoal e válido apenas no seu dispositivo.\n\n`;

  resposta += `*OBS:* No *Android* a foto é salva direto na galeria. `;
  resposta += `No *iPhone*, escolha "Salvar imagem" para salvar na galeria `;
  resposta += `ou "Salvar arquivo" para salvar em Arquivos.\n\n`;
  // Rodapé
  resposta += `Siga a nossa página✨\n`;
  resposta += `🚨 *Instagram PhotoMusic*\n`;
  resposta += `https://instagram.com/photomusicproducoes\n\n`;
  resposta += `[*Link para avaliação no Google*]\n`;
  resposta += `https://g.page/r/CVcwPOqAtId5EBM/review\n\n`;
  resposta += `Muitíssimo obrigado 🥳`;

  return resposta;
}

// ======================================================
// FLUXO PRINCIPAL PARA O MENU "6 - BAIXAR MINHA FOTO"
// ======================================================
async function fluxoEventos(chatId, session) {

  const eventos = await buscarEventos();

  // Sem eventos hoje
  if (eventos.length === 0) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      "😕 Não encontrei eventos cadastrados para hoje.\n\n" +
      "Se você está em um evento, entre em contato diretamente: *21964428172*"
    );
    session.step = "aguardando_opcao";
    return;
  }

  // Apenas 1 evento → envia direto
  if (eventos.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(eventos[0].numero));
    session.step = "aguardando_opcao";
    return;
  }

  // Vários eventos → lista para o usuário escolher
  let mensagem = "Qual evento você está participando? Digite apenas o número:\n\n";

  eventos.forEach((e) => {
    mensagem += `*${e.numero}* — ${e.nome}\n`;
  });

  await sendTyping(chatId);
  await sendText(chatId, mensagem);

  session.step        = "aguardando_numero_evento";
  session.eventosLista = eventos;
}

// ======================================================
// EXPORTA AS FUNÇÕES
// ======================================================
module.exports = {
  buscarEventos,
  apresentarEvento,
  fluxoEventos,
};
