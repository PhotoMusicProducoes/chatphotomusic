// services/eventos.js
// Funções para fluxo de download de fotos de eventos

const { sendText, sendTyping } = require("../utils/index.js");

// ======================================================
// BUSCA OS EVENTOS NO ARQUIVO REMOTO
// ======================================================
async function buscarEventos() {
  try {
    const response = await fetch(
      "https://photomusic.com.br/wp-content/uploads/2025/05/eventos.txt"
    );

    const dados = await response.text();

    const eventos = dados
      .trim()
      .split("\n")
      .map((linha) => {
        const [numero, nome, titulo, ...links] = linha.split("|");
        return { numero, nome, titulo, links };
      });

    return eventos;
  } catch (error) {
    console.error("Erro ao buscar o arquivo remoto:", error);
    return [];
  }
}

// ======================================================
// MONTA A MENSAGEM DO EVENTO ESCOLHIDO
// ======================================================
async function apresentarEvento(numeroEvento) {
  const eventos = await buscarEventos();
  const evento = eventos.find((e) => e.numero === numeroEvento);

  if (!evento) {
    return "Evento não encontrado. Verifique o número digitado!";
  }

  let resposta = `🎉 *${evento.titulo}*\n\n`;

  for (let i = 0; i < evento.links.length; i += 2) {
    if (evento.links[i + 1]) {
      resposta += `${evento.links[i]}\n\n${evento.links[i + 1]}\n\n`;
    } else {
      resposta += `${evento.links[i]}\n\n`;
    }
  }

  resposta += `Siga a nossa página✨ 
🚨 *Instagram PhotoMusic* 
https://instagram.com/photomusicproducoes 

[*Link para avaliação no Google*] 
https://g.page/r/CVcwPOqAtId5EBM/review 

Muitíssimo obrigado🥳`;

  return resposta;
}

// ======================================================
// FLUXO PRINCIPAL PARA O MENU "6 - BAIXAR MINHA FOTO"
// ======================================================
async function fluxoEventos(chatId, session) {
  const eventos = await buscarEventos();

  // Caso exista apenas 1 evento → envia direto
  if (eventos.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(eventos[0].numero));

    session.step = "aguardando_opcao";
    return;
  }

  // Caso existam vários eventos → lista para o usuário
  let mensagem = "Qual evento você está participando? Digite apenas o número:\n\n";

  eventos.forEach((e) => {
    mensagem += `*${e.numero}* - ${e.nome}\n`;
  });

  await sendTyping(chatId);
  await sendText(chatId, mensagem);

  // Avança o fluxo
  session.step = "aguardando_numero_evento";
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
