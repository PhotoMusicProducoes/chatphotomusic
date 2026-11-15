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
    case 3: {
      const g = pron(info.genero);
      return `Que alegria! 🎈${idade ? `\n\n*${idade} ${idade === 1 ? "aninho" : "aninhos"}!* 🥳` : ""}` +
        (g ? `\n\nParabéns antecipados para ${g.ele}! ❤️` : "") + "\n\n" +
        "Desejamos uma festa cheia de alegria, brincadeiras e lembranças lindas! A PhotoMusic Produções vai adorar fazer parte desse dia! 📸❤️";
    }
    case 4: {
      const g = pron(info.genero);
      if (!idade && !g) {
        return "Que demais! 🎉\n\n" +
          "Uma fase nova, cheia de sonhos e descobertas. Que seja uma festa inesquecível, e a PhotoMusic Produções vai adorar fazer parte dela! 📸✨";
      }
      return "Que fase especial! 🎉❤️\n\n" +
        `Parabéns antecipados${g ? " para " + g.ele : ""}${idade ? ` pelos ${g && g.plural ? "" : "seus "}*${idade} anos*` : ""}!\n\n` +
        `Que Deus abençoe ${g ? "a vida " + g.dele : "essa nova fase"} com muita saúde, alegria e sonhos realizados!\n\n` +
        "Será uma alegria para a PhotoMusic Produções fazer parte dessa comemoração! 📸✨";
    }
    case 5: {
      /* 🚨 Mario, 14/11/2026: adulto NÃO é perguntado sobre a idade (muita gente, especialmente mulheres, prefere
         não falar). A idade só aparece se o próprio cliente contou. */
      const g = pron(info.genero);
      let parab;
      if (info.quem === "proprio") parab = `Parabéns pelo seu aniversário${idade ? ` e pelos seus *${idade} anos*` : ""}!`;
      else if (info.quem === "outra") parab = `Parabéns antecipados para ${g ? g.ele : "quem vai comemorar"}${idade ? ` pelos *${idade} anos*` : ""}!`;
      else parab = idade ? `Parabéns pelos *${idade} anos*!` : "Parabéns por esse novo ciclo!";
      return `Que alegria! 🥂\n\n${parab} ` +
        "Que Deus abençoe esse novo ciclo com muita saúde, paz e felicidade! ❤️\n\nSerá uma alegria para a PhotoMusic Produções fazer parte dessa comemoração! 📸";
    }
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

/* ---- ANIVERSÁRIOS: pergunta opcional e leitura da resposta (14/11/2026, Mario + ChatGPT) ----
   Infantil e Adolescente: "menino ou menina? quantos anos?". Adulto: SÓ "é seu ou de outra pessoa?" (sem idade).
   Gênero só pelo que o cliente DISSE (menina, filho, neta...), nunca pelo nome. Resposta livre; "pular" segue. */
function pron(genero) {
  if (genero === "f") return { ele: "ela", dele: "dela" };
  if (genero === "m") return { ele: "ele", dele: "dele" };
  // 👯 14/11/2026 (Mario: "já fizemos gêmeas, e gêmeos menino e menina")
  if (genero === "fp") return { ele: "elas", dele: "delas", plural: true };
  if (genero === "mp") return { ele: "eles", dele: "deles", plural: true };
  if (genero === "misto") return { ele: "os dois", dele: "deles", plural: true };
  return null;
}
const PERGUNTA_ANIVERSARIO_CRIANCA = "Que alegria! 🎉❤️ Me conta um pouquinho: é o aniversário de um *menino* ou de uma *menina*? E quantos anos vai completar?\n\n_(Se preferir, é só responder *pular*.)_";
const PERGUNTA_ANIVERSARIO_ADULTO  = "Que alegria! 🥂❤️ O aniversário é *seu* ou de *outra pessoa*?";

function generoDoTexto(t) {
  // mais de uma pessoa (gêmeos, irmãos) vem ANTES do singular
  if (/\b(menino e (uma )?menina|menina e (um )?menino|casal de gemeos|gemeos (um )?menino e (uma )?menina|um de cada)\b/.test(t)) return "misto";
  if (/\b(gemeas|trigemeas|duas meninas|as meninas|minhas filhas|as filhas|as netas|minhas netas)\b/.test(t)) return "fp";
  if (/\b(gemeos|trigemeos|dois meninos|os meninos|meus filhos|os filhos|meus netos|os netos)\b/.test(t)) return "mp";
  const f = /\b(menina|filha|filhinha|neta|sobrinha|afilhada|enteada|garota|mocinha|princesa|ela|esposa|mae|irma|namorada|tia|sogra|amiga|aniversariante dela)\b/.test(t);
  const m = /\b(menino|filho|filhinho|neto|sobrinho|afilhado|enteado|garoto|mocinho|principe|ele|marido|esposo|pai|irmao|namorado|tio|sogro|amigo)\b/.test(t);
  return f && !m ? "f" : m && !f ? "m" : "";
}

/** Lê a resposta livre. Devolve { pular, idade, genero, quem }. */
function lerInfoAniversario(texto, celebracaoId) {
  const t = String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const out = { pular: false, idade: 0, genero: "", quem: "" };
  if (!t || /^(pular|pula|passa|nao sei|prefiro nao|nao quero|nao vou|sem resposta)\b/.test(t)) { out.pular = true; return out; }
  out.genero = generoDoTexto(t);
  const num = t.match(/\b(\d{1,3})\b/);
  if (num && Number(num[1]) <= 120) out.idade = Number(num[1]);
  if (Number(celebracaoId) === 5) {
    if (t === "2" || /\b(outra pessoa|outra|outro|de um|de uma|do meu|da minha|meu (marido|esposo|pai|filho|irmao|namorado|amigo|sogro|tio|neto)|minha (esposa|mae|filha|irma|namorada|amiga|sogra|tia|neta)|dele|dela)\b/.test(t)) out.quem = "outra";
    else if (t === "1" || /\b(meu|minha|eu|seu|sou eu|o meu|e meu|proprio|propria)\b/.test(t)) out.quem = "proprio";
    if (out.quem === "proprio") out.genero = "";   // parabéns é para ele mesmo: sem ele/ela
    if (out.idade && !/\banos?\b/.test(t)) out.idade = 0;   // adulto: a idade NÃO foi perguntada; número solto ("1", "100") não é idade
  }
  return out;
}

const PERGUNTA_ANOS_BODAS = "Que alegria! ❤️🥂 Quantos anos de casamento vocês estarão celebrando? (*Digite só o número*)";

module.exports = { mensagemAcolhimento, anosDeCasamentoDaResposta, contouQueTemFilhos, NOMES_BODAS, PERGUNTA_ANOS_BODAS,
  lerInfoAniversario, generoDoTexto, PERGUNTA_ANIVERSARIO_CRIANCA, PERGUNTA_ANIVERSARIO_ADULTO };
