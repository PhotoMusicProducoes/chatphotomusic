// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\utils\pedidoDeHumano.js
// "Falar com atendente / humano / pessoa" em QUALQUER ponto da conversa (18/11/2026, Mario).
//
// Caso real 18/11 17:34: a cliente pediu "Falsr com humano" e "Falar com atendente" durante a pergunta
// "o que vai celebrar?" e recebeu 3x "Opção inválida". Pedir uma pessoa NUNCA e resposta invalida: o bot avisa
// a equipe, diz que alguem vai falar e, como orcamento de SERVICO precisa de dados (nao e preco de produto de loja),
// pede em UMA mensagem so o que ainda NAO foi informado (nome, celebracao, convidados, data, horario, bairro/cidade, como encontrou).

function normalizar(texto) {
  return String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// distancia de edicao (tolera "falsr", "humanu", "atendete")
function dist(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const parecido = (tok, alvos) => tok.length >= 4 && alvos.some(a => dist(tok, a) <= 1);

const VERBOS = ["falar", "falo", "fala", "conversar", "converso", "chamar", "chama", "passar", "passa", "transferir", "transfere", "atender", "ligar", "responder"];
// palavras que sozinhas (com verbo ou nao) ja pedem uma pessoa
const ALVO_FORTE = ["humano", "humana", "atendente", "atendentes"];
// precisam de verbo junto ("falar com PESSOA"); "pessoas" (50 pessoas) NAO entra
const ALVO_FRACO = ["pessoa", "alguem", "gente", "responsavel", "vendedor", "vendedora", "consultor", "consultora", "mario", "adriana", "dono", "dona", "equipe"];

function pedeAtendente(texto) {
  const t = normalizar(texto);
  if (!t || t.length > 90) return false;
  const toks = t.split(" ");
  const temVerbo = toks.some(k => parecido(k, VERBOS) || VERBOS.includes(k));
  const forte = toks.some(k => ALVO_FORTE.includes(k) || parecido(k, ALVO_FORTE));
  if (forte) {
    // "humano" / "atendente" sozinho ou com verbo; frase que fala DE atendente (ex.: "o atendente foi otimo") nao entra
    if (toks.length <= 3 || temVerbo || /\b(quero|preciso|prefiro|queria|gostaria|pode|poderia|chama|chamar|me passa|ser)\b/.test(t)) return true;
    return false;
  }
  if (/\b(atendimento humano|ser humano|pessoa de verdade|pessoa real)\b/.test(t)) return true;
  const fraco = toks.some(k => ALVO_FRACO.includes(k) || (k.length >= 5 && k !== "pessoas" && ["alguem", "pessoa", "equipe"].some(a => dist(k, a) <= 1) && k !== "pessoas"));
  return temVerbo && fraco;
}

const _tem = v => v !== undefined && v !== null && String(v).trim() !== "";

/** O que ainda falta para montar o orcamento (so o que a pessoa NAO informou). */
function faltantesParaOrcamento(session) {
  const o = (session && session.orcamento) || {};
  const dl = (session && session.dadosLivres) || {};
  const nome = (session && session.nome) || o.nome;
  const falta = [];
  if (!_tem(nome)) falta.push("🥰 Qual o seu nome?");
  if (!_tem(o.celebracao)) falta.push("🥳 O que vai celebrar?");
  if (!_tem(o.convidados) && !_tem(dl.convidados)) falta.push("👥 Quantos convidados?");
  if (!_tem(o.data) && !_tem(dl.data)) falta.push("📆 Qual a data do evento?");
  if (!_tem(o.horaInicio) || !_tem(o.horaFim)) falta.push("⏰ Qual horário de início e término?");
  if (!_tem(o.bairro) && !_tem(o.cidade) && !_tem(dl.bairro) && !_tem(dl.cidade)) falta.push("🏙️ Qual bairro/cidade?");
  if (!_tem(o.ondeEncontrou)) falta.push("🫵 Como nos encontrou?");
  return falta;
}

/** Texto para o cliente. `pedirDados` = false quando ele ja recebeu orcamento (nao refaz perguntas). */
function textoPedidoDeHumano(session, pedirDados) {
  const nome = String((session && (session.nome || (session.orcamento && session.orcamento.nome))) || "").split(" ")[0];
  let txt = `Claro${nome ? ", *" + nome + "*" : ""}! ❤️ Já avisei a nossa equipe, e alguém vai falar com você por aqui em instantes. 😊`;
  const falta = pedirDados ? faltantesParaOrcamento(session) : [];
  if (falta.length) {
    txt += "\n\n🔢  *Para agilizar seu atendimento, por gentileza responda ⬇️⬇️:*\n\n" + falta.join("\n");
  }
  return txt;
}

module.exports = { pedeAtendente, faltantesParaOrcamento, textoPedidoDeHumano };
