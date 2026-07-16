// utils/sendImageBase64.js
// Envia uma imagem em base64 (data URL) via Z-API /send-image. Usado para o QR
// do Pix, que é gerado no próprio bot (lib qrcode) e não tem URL pública.
//
// A Z-API aceita o campo `image` como "data:image/png;base64,..." — o mesmo
// formato que qrcode.toDataURL() produz. Respeita modo sombra/silencioso.

const fetch = require("node-fetch");
const { API_URL } = require("./config.js");
const { sendText, estaEmModoSombra, estaEmModoSilencioso } = require("./sendText.js");

const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

/**
 * @param {string} chatId
 * @param {string} dataUrl  "data:image/png;base64,...."
 * @param {string} [caption]
 */
async function sendImageBase64(chatId, dataUrl, caption = "") {
  const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;

  // Imagem não faz sentido no replay (silencioso); no modo sombra manda um
  // aviso de texto ao operador em vez da imagem.
  if (estaEmModoSilencioso(phone)) return;
  if (estaEmModoSombra(phone)) {
    await sendText(chatId, `🤖 [Bot→cliente]: (QR Code${caption ? " - " + caption : ""})`);
    return;
  }

  try {
    const response = await fetch(`${API_URL}/send-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify({ phone, image: dataUrl, caption })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${JSON.stringify(data)}`);
    }
    console.log(`✅ [sendImageBase64] QR enviado para ${phone}`);

  } catch (error) {
    // Se a imagem falhar, o cliente NÃO pode ficar sem o Pix: o copia-e-cola
    // já foi enviado antes em texto. Só registramos e avisamos.
    console.error(`🚨 [sendImageBase64] Falhou para ${phone}: ${error.message}`);
    await sendText(chatId, "(Não consegui enviar a imagem do QR Code, mas o código *Pix Copia e Cola* acima funciona normalmente. 🙏)");
  }
}

module.exports = { sendImageBase64 };
