// utils/carinho.js
//
// QUEM AGRADECE NÃO ESTÁ PEDINDO ORÇAMENTO.
//
// 🚨 CASO REAL, 15/10/2026 (Mario mandou os prints): a Patrícia recebeu o
// "feliz aniversário", reagiu com um ❤️ na mensagem e respondeu citando ela
// com "💖💖💖💖". O bot:
//   1. abriu o MENU DE BOAS-VINDAS (reação não tem texto, então o corpo chegou
//      vazio e ele tratou como conversa nova);
//   2. respondeu "⚠ Opção inválida! Escolha uma opção válida";
//   3. duas horas depois cobrou "🎁 Vamos montar o seu orçamento?".
// Mario: *"não era para acontecer"* e *"quando for essas msg de comemoração,
// mesmo que a pessoa envie uma msg, será na maioria das vezes agradecimento,
// não é para enviar orçamento"*.
//
// Este arquivo guarda as duas coisas que o bot precisava saber e não sabia:
//   • o texto é só carinho? ("❤️❤️", "obrigada!", "amei")
//   • este número acabou de receber uma mensagem NOSSA de comemoração?
//
// 📌 A segunda é a que mais importa. Uma pessoa que responde a um "feliz
// aniversário" quase nunca está abrindo um atendimento - e tratar isso como
// lead frio é cobrar orçamento de quem só agradeceu.

const fs = require("fs");
const path = require("path");

/* Mesma pasta e mesmo jeito dos outros estados do bot (pausados.json etc.):
   sobrevive a reinício. Em deploy o disco é novo - a janela é curta e a
   comemoração sai de manhã, então o risco real é pequeno; se o arquivo sumir,
   ainda sobra a leitura do texto (`ehSoCarinho`) e a citação da mensagem. */
const ARQUIVO = path.join(__dirname, "..", "comemorativas-enviadas.json");

/* Quanto tempo depois da comemoração a resposta ainda é "agradecimento".
   3 dias: tem gente que só abre o WhatsApp no fim de semana. */
const HORAS_JANELA = 72;

let enviadas = {};   // telefone -> timestamp do envio

try {
  if (fs.existsSync(ARQUIVO)) enviadas = JSON.parse(fs.readFileSync(ARQUIVO, "utf8")) || {};
} catch (e) {
  console.error("⚠️ Erro ao ler comemorativas-enviadas.json:", e.message);
  enviadas = {};
}

function salvar() {
  try {
    fs.writeFileSync(ARQUIVO, JSON.stringify(enviadas), "utf8");
  } catch (e) {
    console.error("⚠️ Erro ao salvar comemorativas-enviadas.json:", e.message);
  }
}

/** Só os dígitos: o mesmo número chega como "21999998888" e "21999998888@c.us". */
function soDigitos(telefone) {
  return String(telefone || "").replace(/\D+/g, "");
}

/** O job de comemorações chama isto depois de enviar. */
function marcarComemorativa(telefone) {
  const n = soDigitos(telefone);
  if (!n) return;
  enviadas[n] = Date.now();
  limpar();
  salvar();
}

/** Este número recebeu uma mensagem nossa de comemoração há pouco? */
function recebeuComemorativa(telefone) {
  const n = soDigitos(telefone);
  if (!n || !enviadas[n]) return false;
  return (Date.now() - enviadas[n]) <= HORAS_JANELA * 3600 * 1000;
}

/** Tira o que já passou da janela (o arquivo não cresce para sempre). */
function limpar() {
  const limite = Date.now() - HORAS_JANELA * 3600 * 1000;
  for (const n of Object.keys(enviadas)) {
    if (enviadas[n] < limite) delete enviadas[n];
  }
}

/**
 * A mensagem é só carinho?
 *
 * 📌 O limite de tamanho é de propósito: "obrigado pelas fotos, queria um
 * orçamento para a festa da minha filha" é PEDIDO, não agradecimento.
 */
const TEM_LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;
const INICIO_AGRADECIMENTO =
  /^(muito\s+)?obrigad[oa]\b|^amei\b|^adorei\b|^que\s+lind|^perfeito\b|^lindo\b|^gratid|^deus\s+(te\s+)?aben|^abençoad/iu;

function ehSoCarinho(txt) {
  const t = String(txt || "").trim();
  if (!t) return false;
  // Só emoji e pontuação: nenhuma letra, nenhum número. É o caso do "💖💖💖💖".
  if (t.length <= 40 && !TEM_LETRA_OU_NUMERO.test(t)) return true;
  if (t.length > 60) return false;
  /* 🚨 O BANCO PEGOU ISTO (15/10/2026): "obrigado, queria um orçamento para a
     festa da minha filha" tem 57 letras e começa com "obrigado" - ia ser
     tratado como só carinho, e o bot responderia "que carinho, obrigado" a
     quem acabou de PEDIR ORÇAMENTO. O começo da frase não manda; o pedido
     dentro dela manda. */
  if (pedeAlgo(t)) return false;
  return INICIO_AGRADECIMENTO.test(t);
}

/**
 * A pessoa está PEDINDO alguma coisa? Então não é só agradecimento, e o
 * atendimento segue o caminho normal.
 *
 * 🚨 Esta é a trava do outro lado: sem ela, quem respondesse à comemoração
 * dizendo "obrigada! quanto custa a cabine?" ficaria sem resposta - o erro
 * oposto, e pior, porque perde venda de quem pediu.
 */
const PEDE_ALGO =
  /or[çc]ament|pre[çc]o|valor|quanto\s+custa|contrat|disponib|data|agend|reserv|foto|v[íi]deo|cabine|totem|360|dj|som|evento|festa|casament|anivers[áa]rio\s+d[oa]|suporte|ajuda|d[úu]vida|\?/iu;

/* Declarada depois de `ehSoCarinho`, que a usa: `function` sobe (hoisting).
   Fica aqui porque o par PEDE_ALGO/pedeAlgo se lê junto. */
function pedeAlgo(txt) {
  return PEDE_ALGO.test(String(txt || ""));
}

/**
 * Vale tratar esta mensagem como agradecimento?
 * @param {string} texto    o que ela escreveu
 * @param {string} telefone chatId ou número
 */
function ehAgradecimento(texto, telefone) {
  const t = String(texto || "").trim();
  if (pedeAlgo(t)) return false;          // pediu algo: segue o fluxo normal
  if (ehSoCarinho(t)) return true;        // "💖💖💖", "obrigada!"
  /* Recebeu comemoração há pouco e não pediu nada: é resposta ao carinho.
     Vale inclusive para texto mais longo ("que linda mensagem, vocês são
     muito atenciosos, Deus abençoe vocês"). */
  return recebeuComemorativa(telefone) && t.length <= 300;
}

/** O que o bot responde. Sem funil: agradece e fica à disposição. */
function respostaAoCarinho() {
  return "Que carinho, obrigado! ❤️\n\n" +
    "Foi uma alegria ter feito parte desse momento. " +
    "Se precisar de qualquer coisa, é só me chamar por aqui 😊";
}

module.exports = {
  marcarComemorativa, recebeuComemorativa, ehSoCarinho, pedeAlgo,
  ehAgradecimento, respostaAoCarinho, soDigitos, HORAS_JANELA,
  _enviadas: () => enviadas,
};
