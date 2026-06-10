// services/eventos.js
// Funções para fluxo de download de fotos de eventos
// Versão 2.1 — lê da API WordPress (PhotoMusic Pro), N links por serviço

const fetch = require("node-fetch");
const { sendText, sendTyping } = require("../utils/index.js");
const { PM_API_BASE, PM_API_KEY } = require("../utils/config.js");

// Número do ChatBot — aparece no cabeçalho da mensagem para o cliente salvar
const NUMERO_CHATBOT = "21964428172";

// ======================================================
// ÍCONE E TEXTO POR TIPO DE SERVIÇO
// Detecta pelo nome do serviço cadastrado no WordPress
// ======================================================
function formatarLinhaServico(nomeServico, url) {
  const nome = (nomeServico || "").toLowerCase();

  if (nome.includes("360")) {
    return `🎥 Baixe o Vídeo da *${nomeServico}*👇!\n${url}`;
  }
  if (nome.includes("paparazzi") || nome.includes("paparazzi digital")) {
    return `📸 Baixe a *${nomeServico}*👇!\n${url}`;
  }
  if (nome.includes("cabine") || nome.includes("foto cabine")) {
    return `📸 Baixe a *${nomeServico}*👇!\n${url}`;
  }
  if (nome.includes("vídeo") || nome.includes("video")) {
    return `🎥 Baixe o *${nomeServico}*👇!\n${url}`;
  }
  if (nome.includes("gif")) {
    return `🎞️ Baixe o *${nomeServico}*👇!\n${url}`;
  }
  if (nome.includes("fotografia") || nome.includes("foto")) {
    return `📸 Baixe as *${nomeServico}*👇!\n${url}`;
  }

  // Genérico
  return `📁 Acesse *${nomeServico}*👇!\n${url}`;
}

// ======================================================
// BUSCA OS EVENTOS ATIVOS NO WORDPRESS
// Endpoint: GET /wp-json/photomusic/v1/eventos-chatbot
// Retorna apenas eventos com chatbot_ativo = 1
// ======================================================
async function buscarEventos() {
  try {
    const url = `${PM_API_BASE}/eventos-chatbot`;

    console.log(`🔍 [eventos] Buscando: ${url}`);
    console.log(`🔑 [eventos] PM_API_KEY: ${PM_API_KEY ? PM_API_KEY.slice(0,6) + "..." : "❌ VAZIA"}`);

    const response = await fetch(url, {
      headers: {
        "X-PM-API-Key": PM_API_KEY,
        "Accept": "application/json",
      },
    });

    console.log(`📡 [eventos] Resposta HTTP: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const corpo = await response.text().catch(() => "");
      console.error(`❌ [eventos] Erro HTTP ${response.status}. Body: ${corpo.slice(0, 500)}`);
      if (response.status === 401) {
        console.error(`🔑 [eventos] API Key inválida! Verifique PM_API_KEY no .env e a chave em PhotoMusic → Configurações → WhatsApp`);
      }
      return [];
    }

    const texto = await response.text();
    console.log(`📦 [eventos] Body raw: ${texto.slice(0, 300)}`);

    let dados;
    try {
      dados = JSON.parse(texto);
    } catch(e) {
      console.error(`❌ [eventos] Resposta não é JSON válido: ${texto.slice(0, 200)}`);
      return [];
    }

    if (!Array.isArray(dados) || dados.length === 0) {
      console.log("ℹ️ [eventos] API retornou array vazio — nenhum evento com chatbot_ativo=1 encontrado.");
      return [];
    }

    console.log(`✅ [eventos] ${dados.length} evento(s) encontrado(s):`, dados.map(e => `#${e.id} ${e.nome}`));

    return dados.map((e) => ({
      numero:     e.numero,       // "1", "2", "3"...
      nome:       e.nome,         // nome do evento
      titulo:     e.titulo,       // nome + data formatada
      preposicao: e.preposicao || 'ao', // preposição da mensagem de boas-vindas
      links:      e.links || [],  // array de { nome, link }
      id:         e.id,
      token:      e.token_evento, // token único do evento (coluna token_evento)
    }));

  } catch (error) {
    console.error("❌ [eventos] Erro ao conectar com a API WordPress:", error.message);
    return [];
  }
}

// ======================================================
// MONTA A MENSAGEM DO EVENTO ESCOLHIDO
// Formato baseado no template real da PhotoMusic
// ======================================================
// URL base da página de aceite
const ACEITE_BASE_URL = "https://photomusic.com.br/aceite-de-fotos-e-videos/";

async function apresentarEvento(numeroEvento, telefone = "") {
  const eventos = await buscarEventos();
  const evento = eventos.find((e) => e.numero === String(numeroEvento));

  if (!evento) {
    return "Evento não encontrado. Verifique o número digitado!";
  }

  // Cabeçalho
  const prep = evento.preposicao || 'ao';
  let resposta =
    `🎉 *ATENÇÃO SALVE ESTE CONTATO ${NUMERO_CHATBOT}*\n\n` +
    `*Bem-vindos ${prep} ${evento.titulo}* 🥳\n\n`;

  // Monta link da página de aceite com token do evento e telefone pré-preenchidos
  // Novo formato: ?t=TOKEN_EVENTO&tel=TELEFONE
  const telLimpo = (telefone || "").replace(/\D/g, "");
  const urlAceite = evento.token
    ? `${ACEITE_BASE_URL}?t=${evento.token}&tel=${telLimpo}`
    : (evento.link_aceite || "");

  if (urlAceite) {
    resposta += `📸🎥 Clique no link abaixo para acessar suas fotos e vídeos👇!\n${urlAceite}\n\n`;
  } else if (evento.links && evento.links.length > 0) {
    // Fallback: evento sem id/codigo — envia links diretos
    for (const link of evento.links) {
      resposta += formatarLinhaServico(link.nome, link.link) + "\n\n";
    }
  } else {
    resposta += "Nenhum link disponível para este evento no momento.\n\n";
  }

  // Social + avaliação
  resposta +=
    `Siga a nossa página✨ \n` +
    `🚨 *Instagram PhotoMusic* \n` +
    `https://instagram.com/photomusicproducoes \n\n` +
    `[*Link para avaliação no Google*] \n` +
    `https://g.page/r/CVcwPOqAtId5EBM/review \n\n`;

  // Passo a passo para baixar
  resposta +=
    `*Passo a Passo para baixar a foto 🖼️ ou vídeo 🎞️:*\n\n` +
    `*1º* Salve o Contato ${NUMERO_CHATBOT};\n` +
    `*2º* Clique no link para baixar sua foto ou vídeo;\n` +
    `*3º* Leia os termos, digite seu nome, e-mail e clique no botão;\n` +
    `*4º* Procure sua foto ou seu vídeo;\n` +
    `*5º* Clique na seta ⬇️ acima do vídeo ou da foto 🖼️ para baixar cada um, separadamente.\n\n` +
    `*OBS:* Ao clicar na seta ⬇️ acima da foto 🖼️ ou do GIF Animado 🎞️, ` +
    `no *Sistema Android* a foto 🖼️ e o GIF 🎞️ serão salvos direto na galeria, ` +
    `já no *Iphone*, para salvar a foto clique em salvar imagem (a foto 🖼️ será salva na galeria) ` +
    `ou em salvar arquivo (a foto 🖼️ será salva em Arquivo), ` +
    `para salvar o GIF Animado 🎞️ clique em salvar vídeo.\n\n` +
    `Muitíssimo obrigado🥳`;

  return resposta;
}

// ======================================================
// FLUXO PRINCIPAL PARA O MENU "6 - BAIXAR MINHA FOTO"
// ======================================================
async function fluxoEventos(chatId, session) {
  const eventos = await buscarEventos();

  if (eventos.length === 0) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Nenhum evento disponível no momento. Tente novamente mais tarde!"
    );
    return;
  }

  // 1 único evento ativo → vai direto sem pedir número
  if (eventos.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(eventos[0].numero, chatId));
    session.step = "aguardando_opcao";
    return;
  }

  // Mais de 1 evento → monta menu de escolha
  let mensagem = "Qual evento você está participando? Digite apenas o número:\n\n";

  eventos.forEach((e) => {
    mensagem += `*${e.numero}* - ${e.nome}\n`;
  });

  await sendTyping(chatId);
  await sendText(chatId, mensagem);

  session.step = "aguardando_numero_evento";
  session.eventosLista = eventos;
}

module.exports = {
  buscarEventos,
  apresentarEvento,
  fluxoEventos,
};
