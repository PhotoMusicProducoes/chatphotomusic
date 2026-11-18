// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\utils\registroCampanha.js
// Aviso OBSERVACIONAL ao PhotoMusic Pro (registro de resultados das campanhas, fatia 2, 16/11/2026).
// NASCE DESLIGADO: so funciona com CAMPANHA_REGISTRO_ATIVO=1 no ambiente. "Dispare e esqueca":
//  - NUNCA e aguardado por quem chama, NUNCA lanca erro, NUNCA atrasa nem muda a resposta ao cliente;
//  - so por HTTPS, com a chave ja usada nas outras rotas; prazo de 3 s;
//  - o telefone vai SO no corpo (nunca em URL nem em log) e o site o descarta apos achar o ID interno;
//  - sem ID de mensagem nao envia (sem como garantir que nao duplica);
//  - se o site falhar varias vezes seguidas, para de tentar por alguns minutos (nao empilha chamadas).
const axios = require("axios");

const TIPOS = ["resposta_recebida", "botao_acionado", "contratacao_solicitada", "recusa_contato", "encaminhamento_humano", "resposta_humana"];
const PAUSA_MS = 5 * 60 * 1000, MAX_FALHAS = 5;
let falhas = 0, pausadoAte = 0, enviados = 0, descartados = 0;

function ligado() { return String(process.env.CAMPANHA_REGISTRO_ATIVO || "0") === "1"; }

/** PURA: a partir do que o bot JA concluiu sobre a mensagem, decide quais tipos avisar. */
function classificar({ querContratar = false, pediuParar = false, botaoId = "", humano = false } = {}) {
  if (humano) return ["resposta_humana"];
  const out = ["resposta_recebida"];
  if (botaoId && /^[a-z0-9_:\-]{1,40}$/.test(String(botaoId))) out.push("botao_acionado");
  if (querContratar) out.push("contratacao_solicitada");
  if (pediuParar) out.push("recusa_contato");
  return out;
}

/** PURA: o corpo do aviso (so campos permitidos; nunca o texto da mensagem). */
function montarCorpo(tipo, telefone, ref, detalhe, ambiente) {
  const corpo = { tipo, ref: String(ref), telefone: String(telefone || "").replace(/\D+/g, "") };
  if (detalhe && /^[a-z0-9_:\-]{1,40}$/.test(String(detalhe))) corpo.detalhe = String(detalhe);
  if (ambiente === "teste") corpo.ambiente = "teste";
  return corpo;
}

/**
 * Avisa o site. Devolve SEMPRE uma promessa que nunca rejeita (para teste); o bot NAO deve dar await.
 * cfg = { base, chave } (config do bot). 'post' so existe para os testes.
 */
function avisar({ tipo, telefone, ref, detalhe = "", cfg, post = null, agora = Date.now }) {
  try {
    if (!ligado()) return Promise.resolve("desligado");
    if (!TIPOS.includes(tipo)) return Promise.resolve("tipo_fora_da_lista");
    if (!ref || !telefone || !cfg || !cfg.base || !cfg.chave) { descartados++; return Promise.resolve("sem_dados"); }
    if (!/^https:\/\//i.test(String(cfg.base))) { descartados++; return Promise.resolve("sem_https"); }
    if (agora() < pausadoAte) { descartados++; return Promise.resolve("pausado"); }
    const corpo = montarCorpo(tipo, telefone, ref, detalhe, String(process.env.CAMPANHA_REGISTRO_AMBIENTE || "") === "teste" ? "teste" : "");
    const fazer = post || ((url, c, o) => axios.post(url, c, o));
    return Promise.resolve()
      .then(() => fazer(`${cfg.base}/campanha-evento`, corpo, { headers: { "X-PM-Api-Key": cfg.chave }, timeout: 3000 }))
      .then(() => { falhas = 0; enviados++; return "enviado"; })
      .catch(e => {
        falhas++; descartados++;
        if (falhas >= MAX_FALHAS) { pausadoAte = agora() + PAUSA_MS; falhas = 0; }
        console.warn(`⚠️ registro de campanha: falha ao avisar (${tipo}): ${e && e.code ? e.code : "erro"}`);   // sem telefone, sem URL
        return "falhou";
      });
  } catch (e) { return Promise.resolve("erro_interno"); }
}

function _estado() { return { falhas, pausadoAte, enviados, descartados }; }
function _zerar() { falhas = 0; pausadoAte = 0; enviados = 0; descartados = 0; }

module.exports = { avisar, classificar, montarCorpo, ligado, TIPOS, _estado, _zerar };
