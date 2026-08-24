// utils/sendFileByUrl.js

const fetch = require("node-fetch");
const { API_URL } = require("./config.js");
const { sendText } = require("./sendText.js");

const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

async function sendFileByUrl(chatId, url, type = null, customFileName = null) {
  try {
    const fileExtension = url.split('.').pop().toLowerCase();
    let endpoint = "";
    let body = {};

    // ============================
    // IMAGEM
    // ============================
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
      endpoint = "/send-image";
      body = {
        phone: chatId.replace("@c.us", ""),
        image: url
      };
    }

    // ============================
    // VÍDEO
    // ============================
    else if (["mp4", "avi", "mov"].includes(fileExtension)) {
      endpoint = "/send-video";
      body = {
        phone: chatId.replace("@c.us", ""),
        video: url
      };
    }

    // ============================
    // ÁUDIO
    // ============================
    else if (["mp3", "ogg", "wav"].includes(fileExtension)) {
      endpoint = "/send-audio";
      body = {
        phone: chatId.replace("@c.us", ""),
        audio: url
      };
    }

    // ============================
    // DOCUMENTOS (PDF, DOC, XLS, PPT, TXT)
    // ============================
    else if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(fileExtension)) {
      endpoint = `/send-document/${fileExtension}`;  // ✅ COM EXTENSÃO

      /* 🚨 A Z-API ACRESCENTA A EXTENSÃO ao `fileName`, então ele vai SEM.
         O nome que passamos já vem limpo, mas o fallback pega o último pedaço
         da URL, que termina em ".pdf", e o cliente recebia ".pdf.pdf" (caso
         CIS Brasil, 19/08/2026, do lado do WordPress). */
      const nomeBruto = customFileName || url.split('/').pop();
      const fileName  = String(nomeBruto).replace(
        new RegExp("\\." + fileExtension + "$", "i"), ""
      ) || nomeBruto;

      body = {
        phone: chatId.replace("@c.us", ""),
        document: url,
        fileName
      };
    }

    // ============================
    // TIPO DESCONHECIDO
    // ============================
    else {
      console.error("❌ Tipo de arquivo não suportado:", fileExtension);
      await sendText(chatId, "❌ Tipo de arquivo não suportado.");
      return;
    }

    // ============================
    // LOGS DETALHADOS (IGUAL AO ARQUIVO ANTIGO)
    // ============================
    console.log("--------------------------------------------------");
    console.log(`📤 Enviando arquivo para ${chatId}`);
    console.log(`🔍 Endpoint: ${API_URL}${endpoint}`);
    console.log(`🔍 URL do arquivo: ${url}`);
    console.log(`🔍 Nome personalizado: ${customFileName || "(não informado)"}`);
    console.log(`🔍 Body enviado:`, JSON.stringify(body, null, 2));
    console.log("--------------------------------------------------");

    // ============================
    // ENVIO PARA A Z-API (AUTENTICAÇÃO CORRETA)
    // ============================
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // ============================
    // LOGS DA RESPOSTA
    // ============================
    console.log(`📦 Status HTTP: ${response.status}`);
    console.log(`📦 Resposta completa:`, JSON.stringify(data, null, 2));

    if (!response.ok || data.error) {
      throw new Error(`Erro na API: ${response.status} - ${JSON.stringify(data)}`);
    }

    console.log(`✅ Arquivo enviado com sucesso para ${chatId}`);
    console.log("--------------------------------------------------");

    return data;

  } catch (error) {
    console.error("🚨 Erro completo ao enviar arquivo:", error);
    console.log("--------------------------------------------------");

    await sendText(
      chatId,
      `⚠ Não foi possível enviar o arquivo automaticamente.\nAcesse manualmente:\n${url}`
    );
  }
}

module.exports = { sendFileByUrl };
