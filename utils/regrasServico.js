// utils/regrasServico.js
//
// AS REGRAS DE VENDA DO SERVIÇO, lidas do PhotoMusic Pro.
//
// 🚨 POR QUE ESTE ARQUIVO EXISTE (15/10/2026): a regra de qual serviço a
// empresa vende para qual celebração vivia escrita DENTRO do bot
// (`services/orcamentoGerado.js`, CELEBRACOES_POR_SERVICO) e também dentro do
// plugin. Duas cópias da mesma decisão de negócio: mudar numa valia só de um
// lado, e quem descobria era o CLIENTE, recebendo preço de um serviço que a
// empresa não vende para a festa dele. Em 13/10 foi exatamente o que o Mario
// viu - o gerador ofereceu Cobertura Fotográfica numa festa de 15 anos.
//
// Agora a regra é DADO, em `pm_servicos`, editável pelo Mario na tela Catálogo
// de Serviços. Este arquivo é a janela do bot para esse dado.
//
// 📌 COMO FUNCIONA, e por que não é `await` no meio do atendimento:
// `usaOrcamentoGerado()` é SÍNCRONA e é chamada de seis lugares no fluxo. Em
// vez de transformar tudo em assíncrono, aqui as regras ficam em CACHE e o
// cache se renova sozinho em segundo plano. Quem pergunta responde na hora,
// com o que foi lido na última atualização.
//
// 🚨 O QUE ACONTECE SE O SITE ESTIVER FORA DO AR: o bot responde pela
// SEMENTE abaixo, que é cópia fiel do que valia em 15/10/2026, e registra no
// console. Atendimento não para por causa de uma consulta; mas também não
// inventa: na dúvida, vale a regra conhecida.

const axios = require("axios");
const { PM_API_BASE, PM_API_KEY } = require("./config.js");

/* 🚨 SEMENTE - rede de segurança, NÃO é a regra.
   Cópia do que o banco tinha em 15/10/2026. Só é usada enquanto o bot nunca
   conseguiu ler as regras (site fora do ar no minuto da subida, por exemplo).
   Mudança de negócio vai na TELA, nunca aqui. */
const SEMENTE = {
  fotografia: { celebracoes: [3, 4, 5, 6, 7, 8, 9], automatico: [3, 4, 5] },
};

const MINUTOS_CACHE = 10;

let cache = null;          // { servicos: {...}, fonte: "banco" }
let lidoEm = 0;            // timestamp da última leitura boa
let buscando = false;      // evita duas chamadas simultâneas
let avisouFalha = false;   // não poluir o log a cada tentativa

/** Lê as regras do plugin e guarda no cache. Nunca lança. */
async function atualizar() {
  if (buscando) return cache;
  buscando = true;
  try {
    const { data } = await axios.get(`${PM_API_BASE}/servicos-regras`, {
      headers: { "X-PM-Api-Key": PM_API_KEY },
      timeout: 8000,
    });
    if (data && data.ok && data.servicos && typeof data.servicos === "object") {
      cache = { servicos: data.servicos, fonte: data.fonte || "banco" };
      lidoEm = Date.now();
      avisouFalha = false;
      console.log(`📘 [regrasServico] ${Object.keys(data.servicos).length} serviços lidos (fonte: ${cache.fonte}).`);
    } else {
      throw new Error("resposta sem `servicos`");
    }
  } catch (erro) {
    if (!avisouFalha) {
      avisouFalha = true;
      console.error(`🚨 [regrasServico] Não consegui ler as regras do PhotoMusic Pro: ${erro.message}.` +
                    (cache ? " Seguindo com o cache anterior." : " Seguindo pela SEMENTE do código."));
    }
  } finally {
    buscando = false;
  }
  return cache;
}

/** Chamado uma vez na subida do bot: lê agora e renova de tempo em tempo. */
function iniciar() {
  atualizar();
  const t = setInterval(atualizar, MINUTOS_CACHE * 60 * 1000);
  if (t.unref) t.unref();   // não segura o processo vivo por causa do timer
  return t;
}

/** As regras de um serviço, pelo slug. Cache -> semente -> vazio. */
function regrasDe(slug) {
  const s = String(slug || "");
  if (s === "") return null;

  /* Cache velho? dispara a renovação e responde com o que tem: o atendimento
     não espera. */
  if (cache && Date.now() - lidoEm > MINUTOS_CACHE * 60 * 1000) atualizar();

  if (cache && cache.servicos[s]) return cache.servicos[s];
  if (SEMENTE[s]) return SEMENTE[s];
  return null;   // serviço sem regra = sem restrição
}

/** Lista vazia quer dizer TODAS (mesma convenção do banco e da tela). */
function valeNaLista(lista, celebracao) {
  if (!Array.isArray(lista) || lista.length === 0) return true;
  if (celebracao == null || Number(celebracao) === 0) return true;   // sem celebração não barra
  return lista.includes(Number(celebracao));
}

/** A empresa VENDE este serviço nesta celebração? */
function atende(slug, celebracao) {
  const r = regrasDe(slug);
  if (!r) return true;
  return valeNaLista(r.celebracoes, celebracao);
}

/** Sai preço na hora? (atende, mas fora de `automatico` = proposta à mão) */
function automatico(slug, celebracao) {
  const r = regrasDe(slug);
  if (!r) return true;
  if (!valeNaLista(r.celebracoes, celebracao)) return false;
  return valeNaLista(r.automatico, celebracao);
}

/** Atende, mas a proposta é preparada à mão nesta celebração? */
function aMao(slug, celebracao) {
  return atende(slug, celebracao) && !automatico(slug, celebracao);
}

/** É adicional (não se vende sozinho)? */
function ehAddon(slug) {
  const r = regrasDe(slug);
  return !!(r && r.addon);
}

/** Para o `#regras` do operador e para os bancos de medição. */
function estado() {
  return {
    temCache: !!cache,
    fonte: cache ? cache.fonte : "semente",
    servicos: cache ? Object.keys(cache.servicos).length : 0,
    lidoEm: lidoEm ? new Date(lidoEm).toISOString() : null,
  };
}

/** Só para teste: injeta regras sem rede. */
function _definirCache(servicos, fonte = "teste") {
  cache = { servicos: servicos || {}, fonte };
  lidoEm = Date.now();
}

module.exports = {
  iniciar, atualizar, regrasDe, atende, automatico, aMao, ehAddon, estado,
  _definirCache, SEMENTE, MINUTOS_CACHE,
};
