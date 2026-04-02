// services/eucaristia.js — Fotografia 1ª Eucaristia
// Envio manual pelo operador via #fotoeucaristia paroquia,capela,data

const { sendText, sendTyping, sendFileByUrl } = require("../utils/index.js");

// ======================================================
// DADOS DAS PARÓQUIAS E CAPELAS
// ======================================================
const paroquiasEucaristia = {
  1: {
    nome: "Paróquia São José",
    capelas: {
      1: "Matriz São José",
      2: "Capela Santa Teresinha do Menino Jesus",
      3: "Capela Nossa Senhora de Bonsucesso",
      4: "Capela Nossa Senhora da Penha",
      5: "Capela Santo Antônio"
    },
    prazo: "05/05/2026"
  },
  2: {
    nome: "Paróquia São Sebastião",
    capelas: {
      1: "Matriz São Sebastião",
      2: "Capela da Fonte",
      3: "Capela Maravista"
    },
    prazo: "05/04/2026"
  }
};

const EUCARISTIA_PDF_URL =
  "https://photomusic.com.br/wp-content/uploads/2026/02/orcamentoPrimeiraEucaristiaPhotoMusicProducoes2026.pdf";

const EUCARISTIA_FORM_URL = "https://photomusic.com.br/formulario-eucaristia/";

const EUCARISTIA_PIX_URL = "https://photomusic.com.br/formulario-eucaristia/?pm_eucaristia=direto&fp=pix";

const EUCARISTIA_CARTAO_URL = "https://photomusic.com.br/formulario-eucaristia/?pm_eucaristia=direto&fp=cartao";

// ======================================================
// ENVIO MANUAL PELO OPERADOR
// Uso: #fotoeucaristia paroquia,capela,data
//   paroquia : 1 = São José | 2 = São Sebastião
//   capela   : número da lista da paróquia escolhida
//   data     : dd/mm/yyyy (data da 1ª Eucaristia)
// ======================================================
async function enviarEucaristiaManual(chatId, paroquiaId, capelaId, dataEucaristia) {
  const paroquia = paroquiasEucaristia[paroquiaId];
  if (!paroquia) {
    throw new Error(`Paróquia ${paroquiaId} inválida. Use 1 (São José) ou 2 (São Sebastião).`);
  }

  const capelaNome = paroquia.capelas[capelaId];
  if (!capelaNome) {
    const listaCapelas = Object.entries(paroquia.capelas)
      .map(([k, v]) => `${k} = ${v}`)
      .join(", ");
    throw new Error(`Capela ${capelaId} inválida para ${paroquia.nome}. Opções: ${listaCapelas}`);
  }

  await sendTyping(chatId);
  await sendText(
    chatId,
    "Parabéns pelo(a) catequisando(a) está se preparando para receber Jesus Cristo na Santíssima Eucaristia. 😍\n\n" +
    "Segue abaixo as informações sobre o serviço de *Cobertura Fotográfica* para a *1ª Eucaristia*:"
  );

  await sendTyping(chatId);
  await sendText(
    chatId,
    `📍 *Paróquia:* ${paroquia.nome}\n` +
    `⛪ *Capela:* ${capelaNome}\n` +
    `📅 *Data da 1ª Eucaristia:* ${dataEucaristia}`
  );

  await sendTyping(chatId);
  await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Cobertura Fotográfica* 📸✨");

  try {
    await sendTyping(chatId);
    await sendFileByUrl(chatId, EUCARISTIA_PDF_URL, "DOCUMENT", "");
  } catch (e) {
    console.log("⚠️ Falha ao enviar PDF como arquivo, enviando apenas link:", e?.message || e);
  }

  await sendTyping(chatId);
  await sendText(
    chatId,
    "🔗 Caso tenha dificuldade para baixar o PDF, aqui está o link direto:\n" +
    EUCARISTIA_PDF_URL
  );

  await sendTyping(chatId);
  await sendText(
    chatId,
    "Segue o link do formulário do Google com os dados para preencher contrato do Serviço de Cobertura Fotográfica:\n" +
    EUCARISTIA_FORM_URL
  );

  await sendTyping(chatId);
  await sendText(
    chatId,
    "💚 Segue o link para pagamento via *PIX* para o Serviço de Cobertura Fotográfica:\n" +
    EUCARISTIA_PIX_URL
  );

  await sendTyping(chatId);
  await sendText(
    chatId,
    "💳 Segue o link para pagamento via *Cartão de Crédito* para o Serviço de Cobertura Fotográfica:\n" +
    EUCARISTIA_CARTAO_URL
  );

  await sendTyping(chatId);
  await sendText(chatId, "Por favor, pedimos para informe quando o formulário estiver preenchido.");

  await sendTyping(chatId);
  await sendText(chatId, "Enviaremos o contrato assinado com a forma de pagamento escolhida.");

  await sendTyping(chatId);
  await sendText(
    chatId,
    `⚠️ Informamos que o pagamento do serviço deverá estar quitado até o dia *${paroquia.prazo}*.`
  );

  await sendTyping(chatId);
  await sendText(chatId, "Perfeito! Qualquer dúvida estou por aqui 😊");

  await sendTyping(chatId);
  await sendText(chatId, "Deus abençoe você e sua família, grandiosamente!!!");
}

module.exports = {
  enviarEucaristiaManual,
  paroquiasEucaristia,
  EUCARISTIA_PDF_URL,
  EUCARISTIA_FORM_URL,
  EUCARISTIA_PIX_URL,
  EUCARISTIA_CARTAO_URL
};
