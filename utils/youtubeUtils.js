// utils/youtubeUtils.js — Funções para enviar links do YouTube

const { sendText } = require("./sendText.js");

// ======================================================
// EXTRAIR ID DO YOUTUBE
// ======================================================
function extrairIdYoutube(url) {
  // Suporta: youtube.com/shorts/ID, youtu.be/ID, youtube.com/watch?v=ID
  const regexShorts = /(?:youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const regexWatch = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/;
  
  let match = url.match(regexShorts);
  if (match) return match[1];
  
  match = url.match(regexWatch);
  if (match) return match[1];
  
  return null;
}

// ======================================================
// ENVIAR LINK DO YOUTUBE (SIMPLES E EFICIENTE)
// ======================================================
async function enviarYoutube(chatId, youtubeUrl) {
  try {
    console.log(`📹 [YouTube] Enviando link: ${youtubeUrl}`);
    
    // O Z-API vai gerar o preview automaticamente
    await sendText(chatId, youtubeUrl);
    
    return true;
  } catch (erro) {
    console.error(`❌ [YouTube] Erro ao enviar link:`, erro.message);
    return false;
  }
}

// ======================================================
// ENVIAR YOUTUBE COM TEXTO + LINK
// ======================================================
async function enviarYoutubeCompleto(
  chatId, 
  youtubeUrl, 
  textoBefore = "", 
  textoAfter = ""
) {
  try {
    // Texto antes do link
    if (textoBefore) {
      await sendText(chatId, textoBefore);
      await new Promise(r => setTimeout(r, 300));
    }

    // Link do YouTube (Z-API gera preview automaticamente)
    await sendText(chatId, youtubeUrl);
    await new Promise(r => setTimeout(r, 600));

    // Texto depois do link
    if (textoAfter) {
      await sendText(chatId, textoAfter);
      await new Promise(r => setTimeout(r, 300));
    }
    
    return true;
  } catch (erro) {
    console.error(`❌ [YouTube Completo] Erro:`, erro.message);
    return false;
  }
}

// ======================================================
// ENVIAR MÚLTIPLOS VIDEOS DO YOUTUBE
// ======================================================
async function enviarMultiplosYoutubes(
  chatId,
  videos = [] // Array de { url, textoBefore, textoAfter }
) {
  try {
    for (const video of videos) {
      await enviarYoutubeCompleto(
        chatId,
        video.url,
        video.textoBefore || "",
        video.textoAfter || ""
      );
      await new Promise(r => setTimeout(r, 1000));
    }
    return true;
  } catch (erro) {
    console.error(`❌ [Múltiplos YouTubes] Erro:`, erro.message);
    return false;
  }
}

// ======================================================
// EXPORTAÇÃO
// ======================================================
module.exports = {
  extrairIdYoutube,
  enviarYoutube,
  enviarYoutubeCompleto,
  enviarMultiplosYoutubes
};
