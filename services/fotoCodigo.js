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
//   3) responde no PADRÃO da casa com o link da PÁGINA DE ACEITE daquela
//      sessão + Instagram + avaliação no Google. O aceite é colhido na
//      página (nome, telefone e termo), nunca por aqui.

const axios = require("axios");
const { sendText } = require("../utils/sendText");
const { sendTyping } = require("../utils/sendTyping");

const PM_API_BASE = process.env.PM_API_BASE || "https://photomusic.com.br/wp-json/photomusic/v1";
const PM_CAPTURE_KEY = process.env.PM_CAPTURE_KEY || "";

const NUMERO_CHATBOT = "21964428172";
const LINK_INSTAGRAM = "https://instagram.com/photomusicproducoes";
const LINK_AVALIACAO = "https://g.page/r/CVcwPOqAtId5EBM/review";

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

/** Chama o PhotoMusic Pro: código + telefone -> link da sessão daquele convidado */
async function resolverCodigo(codigo, telefone, nome) {
  const { data } = await axios.post(
    `${PM_API_BASE}/capture/resolver`,
    { codigo, telefone, nome: nome || "" },
    { headers: { "X-PM-Capture-Key": PM_CAPTURE_KEY }, timeout: 15000 }
  );
  return data;
}

/**
 * Mensagem no PADRÃO da casa (o mesmo da opção 7 do menu):
 * salve o contato → bem-vindos ao <evento> — <data> → link → Instagram → Google.
 * O link é o da PÁGINA DE ACEITE: ninguém vê foto sem passar pelo aceite.
 */
async function enviarLinkDaFoto(chatId, dados) {
  const url = dados.urlAceite || dados.url;
  const titulo = dados.titulo || "seu evento";
  const prep = dados.preposicao || "ao";

  await sendTyping(chatId);
  await sendText(
    chatId,
    `🎉 *ATENÇÃO SALVE ESTE CONTATO ${NUMERO_CHATBOT}*\n\n` +
    `*Bem-vindos ${prep} ${titulo}* 🥳\n\n` +
    `📸🎥 Clique no link abaixo para acessar suas fotos e vídeos👇!\n${url}\n\n` +
    `Siga a nossa página✨ \n` +
    `🚨 *Instagram PhotoMusic* \n${LINK_INSTAGRAM} \n\n` +
    `[*Link para avaliação no Google*] \n${LINK_AVALIACAO}`
  );
}

/**
 * Ponto de entrada do atalho.
 * Devolve TRUE quando tratou a mensagem (o index.js deve parar aí).
 */
async function tratarCodigoFoto(chatId, corpoMensagem, session) {
  const telefone = String(chatId).replace(/\D/g, "");

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

  // --- 3) manda o link ---
  // O aceite NAO e pedido por aqui: o link leva a PAGINA DE ACEITE do site,
  // que colhe nome/telefone e o termo antes de liberar as fotos (mesmo
  // caminho da opcao 7 do menu). O aceite fica registrado no sistema e o
  // convidado so ve as fotos depois de aceitar.
  await enviarLinkDaFoto(chatId, r);
  return true;
}

/** A mensagem contém um código de foto? (usado pelo index p/ não cair no menu) */
function temCodigoFoto(texto) {
  return !!extrairCodigoFoto(texto);
}

module.exports = {
  tratarCodigoFoto,
  extrairCodigoFoto,
  temCodigoFoto,
};
