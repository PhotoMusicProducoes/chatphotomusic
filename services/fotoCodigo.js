// services/fotoCodigo.js
// ATALHO DA FOTO POR CÓDIGO (Lumen Capture).
//
// O convidado escaneia o QR na tela do operador da cabine e cai aqui com uma
// mensagem pronta, tipo:
//    "Oi! Quero a minha foto da cabine. Código: L5BMWY"
//
// Este atalho roda ANTES da máquina de estados do menu. Sem isso, quem já
// tinha o menu aberto tem a mensagem lida como "opção 5 - Outros assuntos"
// (aconteceu no teste real de 30/07/2026).
//
// Fluxo:
//   1) detecta o código na mensagem;
//   2) chama /capture/resolver no PhotoMusic Pro (telefone = identidade);
//   3) 1ª vez daquele telefone -> pede o aceite antes de mandar o link;
//      já conhecido -> manda o link direto (a 2ª foto não repete o aceite);
//   4) responde com o link da SESSÃO dele + Instagram + avaliação no Google.

const axios = require("axios");
const { sendText } = require("../utils/sendText");
const sendTyping = require("../utils/sendTyping");

const PM_API_BASE = process.env.PM_API_BASE || "https://photomusic.com.br/wp-json/photomusic/v1";
const PM_CAPTURE_KEY = process.env.PM_CAPTURE_KEY || "";

const LINK_INSTAGRAM = "https://www.instagram.com/photomusicproducoes/";
const LINK_AVALIACAO = "https://g.page/r/photomusic/review";

// Guarda quem está no meio do aceite: telefone -> { codigo, quando }
const aguardandoAceite = new Map();
const MINUTOS_VALIDADE = 15;

/**
 * Detecta o código na mensagem.
 * Exige a palavra "código" antes das 6 letras: assim um cliente escrevendo
 * em CAIXA ALTA não dispara o atalho sem querer.
 */
function extrairCodigoFoto(texto) {
  if (!texto) return null;
  // aceita "Código: ABC123", "codigo abc123", "meu codigo é: ABC123"
  const m = String(texto).match(/c[óo]digo\s*(?:[ée]|eh|=)?\s*:?\s*([A-Za-z0-9]{6})\b/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

/** O convidado está respondendo o aceite que pedimos agora há pouco? */
function estaAguardandoAceite(telefone) {
  const p = aguardandoAceite.get(telefone);
  if (!p) return false;
  if (Date.now() - p.quando > MINUTOS_VALIDADE * 60 * 1000) {
    aguardandoAceite.delete(telefone);
    return false;
  }
  return true;
}

/** Chama o PhotoMusic Pro: código + telefone -> link da sessão daquele convidado */
async function resolverCodigo(codigo, telefone, nome) {
  const { data } = await axios.post(
    `${PM_API_BASE}/capture/resolver`,
    { codigo, telefone, nome: nome || "" },
    { headers: { "X-PM-Capture-Key": PM_CAPTURE_KEY }, timeout: 15000 }
  );
  return data;
}

/** Mensagem final com o link da foto + Instagram + avaliação */
async function enviarLinkDaFoto(chatId, url) {
  await sendTyping(chatId);
  await sendText(
    chatId,
    `📸 *Suas fotos estão aqui!*\n${url}\n\n` +
    `É só tocar no link, escolher a foto e baixar. 😍`
  );
  await sendTyping(chatId);
  await sendText(
    chatId,
    `Aproveite pra seguir a gente e ver os bastidores:\n${LINK_INSTAGRAM}\n\n` +
    `E se curtiu o nosso trabalho no evento, sua avaliação ajuda demais ❤️\n${LINK_AVALIACAO}`
  );
}

/**
 * Ponto de entrada do atalho.
 * Devolve TRUE quando tratou a mensagem (o index.js deve parar aí).
 */
async function tratarCodigoFoto(chatId, corpoMensagem, session) {
  const telefone = String(chatId).replace(/\D/g, "");

  // --- 1) o convidado está respondendo o aceite? ---
  if (estaAguardandoAceite(telefone)) {
    const resposta = String(corpoMensagem || "").trim().toLowerCase();
    const aceitou = /\b(aceito|aceita|sim|concordo|ok|pode|autorizo|1)\b/.test(resposta);

    if (!aceitou) {
      await sendTyping(chatId);
      await sendText(
        chatId,
        "Sem problema! 😊 Só consigo liberar as fotos com o seu aceite.\n" +
        "Se mudar de ideia, escaneie o QR de novo com o nosso operador."
      );
      aguardandoAceite.delete(telefone);
      return true;
    }

    const pendente = aguardandoAceite.get(telefone);
    aguardandoAceite.delete(telefone);
    try {
      const nome = session?.nome || "";
      const r = await resolverCodigo(pendente.codigo, telefone, nome);
      if (r && r.ok && r.url) {
        await enviarLinkDaFoto(chatId, r.url);
      } else {
        await sendText(chatId, "Tive um problema para liberar suas fotos. Chame o nosso operador no evento, por favor 🙏");
      }
    } catch (e) {
      console.error("❌ Erro ao resolver código após aceite:", e.message);
      await sendText(chatId, "Tive um problema para liberar suas fotos. Chame o nosso operador no evento, por favor 🙏");
    }
    return true;
  }

  // --- 2) a mensagem tem código de foto? ---
  const codigo = extrairCodigoFoto(corpoMensagem);
  if (!codigo) return false;

  console.log(`📸 Código de foto recebido de ${chatId}: ${codigo}`);

  let r;
  try {
    r = await resolverCodigo(codigo, telefone, session?.nome || "");
  } catch (e) {
    const status = e.response?.status;
    console.error(`❌ /capture/resolver falhou (${status || e.message})`);
    if (status === 404) {
      await sendText(chatId, "Não encontrei esse código 🤔 Confere com o nosso operador no evento?");
    } else if (status === 410) {
      await sendText(chatId, "A galeria desse evento já foi encerrada. Fale com o contratante do evento 😊");
    } else {
      await sendText(chatId, "Tive um problema para buscar suas fotos. Tente de novo em instantes 🙏");
    }
    return true; // tratou: não cai no menu
  }

  if (!r || !r.ok || !r.url) {
    await sendText(chatId, "Não consegui localizar suas fotos. Chame o nosso operador no evento, por favor 🙏");
    return true;
  }

  // --- 3) primeira vez deste telefone: pedir o aceite ---
  if (r.novo) {
    aguardandoAceite.set(telefone, { codigo, quando: Date.now() });
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Achei suas fotos! 🎉\n\n" +
      "Antes de enviar, preciso do seu *aceite*:\n" +
      "_Autorizo o uso da minha imagem nas fotos deste evento, conforme a LGPD " +
      "(Lei 13.709/2018). Sei que posso pedir a exclusão a qualquer momento._\n\n" +
      "Responda *ACEITO* para receber suas fotos 😊"
    );
    return true;
  }

  // --- 4) já aceitou antes: manda direto ---
  await enviarLinkDaFoto(chatId, r.url);
  return true;
}

module.exports = {
  tratarCodigoFoto,
  extrairCodigoFoto,
  estaAguardandoAceite,
};
