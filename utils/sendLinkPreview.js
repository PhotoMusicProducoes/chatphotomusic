// utils/sendLinkPreview.js — versão compatível com sua instância Z-API
// Simula digitação antes de enviar o link para permitir que o WhatsApp gere o preview

const fetch = require("node-fetch");
const { API_URL } = require("./config.js");

// 🔑 Token da Z-API
const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

async function sendLinkPreview(chatId, url) {
  try {
    const phone = chatId.endsWith("@c.us")
      ? chatId.replace("@c.us", "")
      : chatId;

    console.log("➡️ [sendLinkPreview] Preparando envio do link:", url);

    // ============================================================
    // 1️⃣ SIMULA DIGITAÇÃO POR 3 SEGUNDOS
    // ============================================================
    console.log("⌨️ [sendLinkPreview] Simulando digitação...");

    await fetch(`${API_URL}/send-typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify({
        phone: phone,
        value: true,
        time: 3000 // WhatsApp fica digitando por 3s
      })
    });

    // Aguarda o tempo da digitação
    await new Promise(resolve => setTimeout(resolve, 6000));

    // ============================================================
    // 2️⃣ AGORA SIM — ENVIA O LINK
    // ============================================================
    console.log("🔗 [sendLinkPreview] Enviando link após digitação...");

    const response = await fetch(`${API_URL}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify({
        phone: phone,
        message: url
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("🚨 [sendLinkPreview] Erro HTTP:", response.status, data);
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    console.log("✅ [sendLinkPreview] Link enviado com sucesso!");
    console.log("📦 [sendLinkPreview] Resposta da API:", data);

    // Pequeno delay para espaçar
    await new Promise(resolve => setTimeout(resolve, 3000));

    return data;

  } catch (error) {
    console.error("🚨 [sendLinkPreview] Erro ao enviar link:", error.message);
  }
}

module.exports = { sendLinkPreview };
