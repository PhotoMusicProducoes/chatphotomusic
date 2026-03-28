// services/eventos.js
// Funções para fluxo de download de fotos de eventos

const fetch = require("node-fetch");
const { sendText, sendTyping } = require("../utils/index.js");

// ======================================================
// BUSCA OS EVENTOS NO ARQUIVO REMOTO
// ======================================================
async function buscarEventos() {
  try {
    const response = await fetch(
      "https://photomusic.com.br/wp-content/uploads/2025/05/eventos.txt"
    );

    if (!response.ok) {
      console.error("Erro ao acessar arquivo remoto:", response.status);
      return [];
    }

    const dados = await response.text();

    if (!dados || !dados.trim()) {
      console.error("Arquivo remoto vazio ou inválido.");
      return [];
    }

    const linhas = dados.trim().split("\n");

    const eventos = linhas
      .map((linha) => {
        const partes = linha.split("|");

        if (partes.length < 3) {
          console.error("Linha inválida no arquivo:", linha);
          return null;
        }

        const [numero, nome, titulo, ...links] = partes;

        return { numero, nome, titulo, links };
      })
      .filter(Boolean);

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

  if (evento.links.length === 0) {
    resposta += "Nenhum link disponível para este evento.\n\n";
  }

  for (let i = 0; i < evento.links.length; i += 2) {
    const link1 = evento.links[i];
    const link2 = evento.links[i + 1];

    if (link1) resposta += `${link1}\n\n`;
    if (link2) resposta += `${link2}\n\n`;
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

  if (eventos.length === 0) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Nenhum evento disponível no momento. Tente novamente mais tarde!"
    );
    return;
  }

  if (eventos.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(eventos[0].numero));

    session.step = "aguardando_opcao";
    return;
  }

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
