// services/orcamentoGerado.js
// O ÚNICO lugar que pede o orçamento ao PhotoMusic Pro e manda o PDF ao cliente.
//
// 🚨 DECISÃO DO MARIO (17/08/2026): vários serviços = UM PDF SÓ.
// O endpoint aceita a lista inteira numa chamada e devolve um PDF com a tabela
// comparativa dos serviços lado a lado, a página de combinações e o DESCONTO DE
// R$ 100 por serviço a mais já aplicado. Um PDF por serviço mataria o desconto
// (cada arquivo é calculado sozinho) e repetiria a página de combinações com
// totais diferentes em cada um. Pior caso medido: 8 serviços, 4,61 MB, 6s.
//
// 🚨 2ª RODADA ("Quero mais orçamento"): o PDF novo vem com TUDO, os serviços
// antigos e os novos, e o bot avisa que substitui a proposta anterior. O total
// normalmente CAI, porque aí entra o desconto do combo.
//
// 📌 A MIGRAÇÃO É POR SERVIÇO, uma chave só: SERVICOS_GERADOS embaixo. Serviço
// que está na lista não manda mais o PDF estático dele; quem não está continua
// como sempre. Migrar = acrescentar o id aqui e desligar o PDF estático no
// service correspondente.

const {
  sendText, sendTyping, sendFileByUrl, enviarPdfComLink, gerarOrcamento, sessions
} = require("../utils/index.js");
const { estaPausado } = require("../utils/pauseControl.js");
const { OPERADOR_TELEFONE_ID } = require("../utils/config.js");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

/* Serviços que JÁ usam o orçamento gerado na hora.
   13 = Totem Retrô (1º, aprovado 17/08) · 1 = Foto Cabine · 3 = Plataforma 360. */
const SERVICOS_GERADOS = [13, 1, 3, 2, 4];

/* id do serviço -> slug do catálogo do WordPress.
   🚨 SEMPRE POR SLUG: o endpoint lê número como dígito do menu do bot, então o
   id 13 do Totem Retrô seria lido como 1 e 3 (Cabine + Plataforma). */
const SLUG_POR_SERVICO = {
  1:  "foto-cabine",
  2:  "totem",
  3:  "plataforma-360",
  4:  "foto-paparazzi",
  5:  "foto-lembranca",
  6:  "fotografia",
  7:  "som-dj",
  8:  "iluminacao-pista",
  13: "totem-retro",
};

const NOME_POR_SERVICO = {
  1:  "Foto Cabine",
  2:  "Totem Fotográfico",
  3:  "Plataforma 360º",
  4:  "Foto Paparazzi Digital",
  5:  "Foto Lembrança",
  6:  "Cobertura Fotográfica",
  7:  "Som Completo com DJ",
  8:  "Iluminação para Pista de Dança",
  13: "Totem Retrô",
};

/** O serviço já usa o orçamento gerado? Os services consultam para saber se
 *  ainda devem mandar o PDF estático deles. */
function usaOrcamentoGerado(servicoId) {
  return SERVICOS_GERADOS.includes(Number(servicoId));
}

/** Dos ids pedidos, só os que já foram migrados (na ordem de SERVICOS_GERADOS
 *  não importa; mantém a ordem do pedido do cliente). */
function idsGerados(ids) {
  return (ids || []).map(Number).filter(usaOrcamentoGerado);
}

/** "Foto Cabine, Plataforma 360º e Som Completo com DJ" */
function listarNomes(ids) {
  const nomes = ids.map(id => NOME_POR_SERVICO[id]).filter(Boolean);
  if (nomes.length <= 1) return nomes[0] || "serviço";
  return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}

function nomeArquivo(ids) {
  if (ids.length === 1) {
    return "Orcamento-" + String(NOME_POR_SERVICO[ids[0]] || "Servico")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  return "Orcamento-PhotoMusic";
}

/**
 * Gera UM orçamento com todos os serviços migrados do pedido e manda ao cliente.
 *
 * @param {string}   chatId
 * @param {object}   session
 * @param {number[]} idsPedidos  ids dos serviços desta rodada
 * @param {object}   opcoes      { segundaRodada: bool }
 * @returns {Promise<boolean>} true se o PDF foi enviado
 */
async function enviarOrcamentoGerado(chatId, session, idsPedidos, opcoes = {}) {
  const ids = idsGerados(idsPedidos);
  if (ids.length === 0) return false;          // nada migrado nesta rodada
  if (estaPausado(chatId) || session?.pausado) return false;

  /* 2ª rodada: o PDF sai com TUDO o que ele já pediu, não só o novo. Assim o
     desconto do combo enxerga os serviços das duas rodadas. */
  let idsPdf = ids;
  if (opcoes.segundaRodada) {
    const jaEnviados = idsGerados(session?.orcamento?.servicosEnviados || []);
    idsPdf = Array.from(new Set(jaEnviados.concat(ids)));
  }

  const slugs = idsPdf.map(id => SLUG_POR_SERVICO[id]).filter(Boolean);
  if (slugs.length === 0) return false;

  const nomes = listarNomes(idsPdf);

  // 🚨 GERA ANTES DE ANUNCIAR (Mario pegou no 1º teste do Retrô): antes o bot
  // dizia "Segue o arquivo" e só depois tentava gerar, e quando falhava o
  // cliente lia "Segue o arquivo" seguido de "Estou finalizando".
  let dados;
  try {
    dados = await gerarOrcamento(session, chatId, slugs);
  } catch (erro) {
    console.error(`🚨 [orcamentoGerado] Falhou para ${chatId} [${slugs.join(", ")}]: ${erro.codigo} — ${erro.message}`);

    // O operador precisa saber o motivo; sem isso a falha só vivia no log do Fly.
    try {
      await sendText(
        OPERADOR_TELEFONE_ID,
        `🚨 *Orçamento não saiu*\n` +
        `Cliente: ${String(chatId).replace(/\D+/g, "")}\n` +
        `Serviços: ${slugs.join(", ")}\n` +
        `Motivo: *${erro.codigo}*\n${erro.message}`
      );
    } catch (e) {
      console.error("⚠️ Não consegui avisar o operador:", e.message);
    }

    if (estaPausado(chatId)) return false;
    await sendTyping(chatId);
    await sendText(
      chatId,
      `📊 Estou finalizando o seu orçamento de *${nomes}* e te envio em instantes! 😊`
    );
    return false;
  }

  if (estaPausado(chatId)) return false;

  await sendTyping(chatId);
  await delay(300);
  await sendText(
    chatId,
    opcoes.segundaRodada && idsPdf.length > ids.length
      // Substitui a anterior: com mais serviços o desconto entra e o total cai.
      ? `💰 Segue o orçamento *atualizado*, agora com *${nomes}* juntos 📸✨\n\n` +
        `_Esta proposta substitui a anterior e já vem com o desconto por contratar mais de um serviço._`
      : `💰 Segue o arquivo com o orçamento de *${nomes}* 📸✨`
  );

  if (estaPausado(chatId)) return false;

  /* O link é gravado em orcamento.linksOrcamento[servicoId] pelo
     enviarPdfComLink, e é dele que o "mais detalhes" reenvia o PDF. Com um PDF
     para vários serviços, o MESMO link vale para todos os ids do arquivo (o
     reenvio deduplica por URL para não mandar o mesmo arquivo N vezes). */
  await enviarPdfComLink(
    chatId,
    dados.url,
    nomeArquivo(idsPdf),
    sendTyping,
    sendText,
    sendFileByUrl,
    { session, servicoId: idsPdf[0] }
  );

  if (session.orcamento) {
    session.orcamento.linksOrcamento = session.orcamento.linksOrcamento || {};
    idsPdf.forEach(id => { session.orcamento.linksOrcamento[id] = dados.url; });
  }

  console.log(`✅ [orcamentoGerado] ${dados.id} enviado a ${chatId}: R$ ${dados.total} [${slugs.join(", ")}]`);
  return true;
}

module.exports = {
  enviarOrcamentoGerado,
  usaOrcamentoGerado,
  idsGerados,
  SERVICOS_GERADOS,
  SLUG_POR_SERVICO,
  NOME_POR_SERVICO,
};
