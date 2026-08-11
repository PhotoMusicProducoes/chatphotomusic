// services/guestbook.js
// GuestBook no orçamento ENXUTO.
//
// Por que existe: o GuestBook sempre foi apresentado dentro do fluxo COMPLETO
// (enviarFluxoPadrao). Quando o orçamento passou a sair enxuto (só preço + PDF),
// o fluxo completo deixou de rodar e o GuestBook simplesmente sumiu das
// propostas de Foto Cabine e Totem — justamente onde ele mais vende.
// Aqui ele volta em UMA mensagem curta + 4 arquivos, sem inchar o atendimento.
//
// Só faz sentido em celebração com homenageado: 15 anos, aniversários,
// casamento e bodas. Corporativo, formatura e "outros" não recebem.

const { sendText, sendTyping, sendFileByUrl } = require("../utils/index.js");
const { urlBase, urlBase2 } = require("../utils/config.js");

// Arquivos definidos pelo Mario (06/08/2026)
const ARQUIVOS = [
  urlBase2 + "guestbook12.mp4",
  urlBase  + "guestbook13.jpg",
  urlBase  + "guestbook6.jpg",
  urlBase  + "guestbook4.jpg",
];

// Celebrações que recebem (ids do menu do bot)
const CELEBRACOES_OK = [1, 2, 3, 4, 5, 6];

/** Para quem os convidados escrevem, conforme a celebração. */
function paraQuem(clb) {
  switch (Number(clb)) {
    case 1: return "para a *debutante*";
    case 2: return "para os *noivos*";
    case 6: return "para o *casal*";
    default: return "para o(a) *aniversariante*";
  }
}

/**
 * Envia a apresentação do GuestBook depois do orçamento de Foto Cabine/Totem.
 * @param {string} chatId
 * @param {number} clb         id da celebração
 * @param {string} servicoNome "Foto Cabine" | "Totem Fotográfico"
 */
async function enviarGuestbook(chatId, clb, servicoNome) {
  if (!CELEBRACOES_OK.includes(Number(clb))) return;

  await sendTyping(chatId);
  await sendText(chatId,
    `🎁 *GuestBook* — com o *${servicoNome}* você pode incluir o nosso GuestBook: ` +
    `além da foto, cada convidado deixa uma mensagem escrita à mão ${paraQuem(clb)}. ` +
    `No fim da festa vocês levam um álbum com as fotos e os recados de todo mundo. ❤️`
  );

  for (const url of ARQUIVOS) {
    try {
      await sendFileByUrl(chatId, url);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`⚠️ GuestBook: falha ao enviar ${url}:`, e.message);
    }
  }
}

module.exports = { enviarGuestbook, CELEBRACOES_OK };
