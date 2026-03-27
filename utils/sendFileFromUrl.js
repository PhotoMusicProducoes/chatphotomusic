// utils/sendFileFromUrl.js

const fetch = require("node-fetch");
const { API_URL } = require("./config.js");

const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

async function sendFileFromUrl(chatId, url, fileName, caption = "") {
  try {
    const body = {
      phone: chatId.replace("@c.us", ""),
      url: url,
      fileName: fileName,
      caption: caption
    };

    console.log("📄 Enviando arquivo com nome:", fileName);

    const response = await fetch(
      `${API_URL}/send-file-from-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-token": CLIENT_TOKEN
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(`Erro na API: ${response.status} - ${JSON.stringify(data)}`);
    }

    console.log(`✅ Arquivo enviado com sucesso: ${fileName}`);
    return data;

  } catch (error) {
    console.error("❌ Erro ao enviar arquivo com nome:", error);
    throw error;
  }
}

module.exports = { sendFileFromUrl };
