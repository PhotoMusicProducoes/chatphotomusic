// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\utils\acolhimentoCelebracao.js
//
// ACOLHIMENTO POR CELEBRAÇÃO (14/11/2026, Mario + ChatGPT, RJN).
// Antes, toda festa social recebia a MESMA frase ("Deus abençoe toda a preparação...") e o Rapha
// parecia um questionário. Agora cada celebração tem a sua mensagem, curta e em UMA só mensagem
// (o cliente ainda quer o orçamento).
// Regras:
//   - Bodas: pergunta os anos de casamento (opcional, nunca trava) e parabeniza pelo nome da boda
//     SÓ quando a denominação é consagrada (lista abaixo); nas outras, só os anos.
//   - Casamento: parabeniza o CASAL. "Família" só quando o cliente CONTOU que tem filhos
//     (Mario: família é quando os filhos nascem). Nunca pergunta isso.
//   - Empresa/agência (corporativo): tom profissional, sem linguagem religiosa nem familiar.
//   - Idade/anos já ditos pelo cliente são aproveitados, nunca perguntados de novo.

/* Denominações consagradas no Brasil (as mesmas nas listas mais comuns). As que variam de lista
   para lista (ex.: 40 anos) ficaram de fora de propósito: nelas o Rapha fala só dos anos. */
const NOMES_BODAS = {
  1: "Papel", 5: "Madeira", 15: "Cristal", 20: "Porcelana", 25: "Prata",
  30: "Pérola", 50: "Ouro", 60: "Diamante",
};
const ANOS_DA_BODA = Object.fromEntries(
  Object.entries(NOMES_BODAS).map(([anos, nome]) => [nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), Number(anos)])
);

const semAcento = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** "25", "25 anos", "vinte e cinco" não (só número), "bodas de prata" -> 25. null = não deu para saber. */
function anosDeCasamentoDaResposta(texto) {
  const t = semAcento(texto);
  const b = t.match(/\bbodas?\s+de\s+([a-z]+)/);
  if (b && ANOS_DA_BODA[b[1]]) return ANOS_DA_BODA[b[1]];
  const m = t.match(/\b(\d{1,2})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 80 ? n : null;
}

/** O cliente contou que o casal tem filhos ("nossos filhos", "temos uma filha"...). Nunca perguntado. */
function contouQueTemFilhos(texto) {
  const t = semAcento(texto);
  return /\b(nossos?|nossas?)\s+(\w+\s+)?(filhos?|filhas?)\b/.test(t)
      || /\btemos\s+(um|uma|dois|duas|tres|\d+)?\s*(filhos?|filhas?)\b/.test(t)
      || /\bja\s+(somos|temos)\s+(uma\s+)?familia\b/.test(t);
}

function linhaBodas(anos) {
  if (!anos) return "";
  const nome = NOMES_BODAS[anos];
  return `${anos} anos de casamento! ❤️\n\n` + (nome ? `Parabéns pelas *Bodas de ${nome}*! 🥂💍` : "Parabéns por essa linda história! 🥂💍");
}

/**
 * Mensagem de acolhimento da celebração (UMA mensagem).
 * @param {number} celebracaoId 1=15 anos, 2=Casamento, 3=Infantil, 4=Adolescente, 5=Adulto, 6=Bodas, 7=Formatura, 8=Corporativo, 9=Outros
 * @param {{anosCasamento?:number, idade?:number, temFilhos?:boolean, perfil?:string}} info
 */
function mensagemAcolhimento(celebracaoId, info = {}) {
  const id = Number(celebracaoId);
  const idade = Number(info.idade) || 0;
  const corporativo = id === 8 || info.perfil === "empresa" || info.perfil === "agencia";

  if (corporativo) {
    return "Será um prazer contribuir para o sucesso do seu evento! 🤝\n\n" +
      "A PhotoMusic Produções cuida de cada detalhe para oferecer uma ótima experiência aos seus convidados.";
  }
  switch (id) {
    case 1:
      return "Que alegria! ✨👑\n\nOs 15 anos são uma data inesquecível, e a PhotoMusic Produções quer ajudar a deixar esse momento ainda mais especial!\n\n" +
        "Que Deus abençoe essa nova fase com muita alegria e felicidade! ❤️";
    case 2:
      return info.temFilhos
        ? "Que alegria! ❤️💍\n\nParabéns por esse momento tão especial na vida de vocês!\n\n" +
          "Que Deus abençoe grandiosamente essa união e toda a família, concedendo ao casal e aos filhos muito amor, respeito, companheirismo e felicidade! 🙏✨\n\n" +
          "Será uma alegria para a PhotoMusic Produções fazer parte desse dia tão especial!"
        : "Que alegria! ❤️💍\n\nParabéns por esse momento tão especial na vida de vocês!\n\n" +
          "Que Deus abençoe grandiosamente essa união, concedendo ao casal muito amor, respeito, companheirismo e felicidade! 🙏✨\n\n" +
          "Será uma alegria para a PhotoMusic Produções fazer parte desse dia tão especial!";
    case 3:
      return `Que alegria! 🎈${idade ? `\n\n*${idade} ${idade === 1 ? "aninho" : "aninhos"}!* 🥳` : ""}\n\n` +
        "Desejamos uma festa cheia de alegria, brincadeiras e lembranças lindas! A PhotoMusic Produções vai adorar fazer parte desse dia! 📸❤️";
    case 4:
      return `Que demais! 🎉${idade ? `\n\n*${idade} anos!*` : ""}\n\n` +
        "Uma fase nova, cheia de sonhos e descobertas. Que seja uma festa inesquecível, e a PhotoMusic Produções vai adorar fazer parte dela! 📸✨";
    case 5:
      return `Que alegria! 🥂\n\n${idade ? `Parabéns pelos *${idade} anos*!` : "Parabéns pela nova idade!"} ` +
        "Que Deus abençoe esse novo ciclo com muita saúde, paz e felicidade! ❤️\n\nSerá uma alegria para a PhotoMusic Produções fazer parte dessa comemoração! 📸";
    case 6: {
      const topo = info.anosCasamento ? linhaBodas(info.anosCasamento) : "Que alegria! ❤️🥂\n\nParabéns por essa linda história de amor! 💍";
      return `${topo}\n\nEm nome da PhotoMusic Produções, desejamos que Deus continue abençoando essa união com muito amor, saúde e felicidade!\n\n` +
        "Será uma alegria fazer parte dessa celebração! 📸✨";
    }
    case 7:
      return "Parabéns pela conquista! 🎓✨\n\nTanto esforço merece uma comemoração à altura, e a PhotoMusic Produções vai adorar fazer parte dela! 📸";
    default:
      return "Que bom poder fazer parte dessa celebração! 🎉\n\nQue toda a preparação corra muito bem, e conte com a PhotoMusic Produções! 📸";
  }
}

const PERGUNTA_ANOS_BODAS = "Que alegria! ❤️🥂 Quantos anos de casamento vocês estarão celebrando? (*Digite só o número*)";

module.exports = { mensagemAcolhimento, anosDeCasamentoDaResposta, contouQueTemFilhos, NOMES_BODAS, PERGUNTA_ANOS_BODAS };
