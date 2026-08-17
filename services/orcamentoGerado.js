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

/* Serviços que JÁ usam o orçamento gerado na hora, na ordem em que migraram:
   13 = Totem Retrô (1º, aprovado 17/08) · 1 = Foto Cabine · 3 = Plataforma 360 ·
   2 = Totem Fotográfico · 4 = Foto Paparazzi · 5 = Foto Lembrança (18/08) ·
   6 = Cobertura Fotográfica (18/08, 🚨 com restrição de celebração abaixo) ·
   7 = Som com DJ · 8 = Iluminação (18/08).
   ✅ MIGRAÇÃO COMPLETA: os 9 serviços saem no orçamento gerado. Nenhum PDF
   estático é mais enviado, então o parcelamento do bot já pode mudar. */
const SERVICOS_GERADOS = [13, 1, 3, 2, 4, 5, 6, 7, 8];

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

/* 🚨 SERVIÇO QUE NÃO VALE PARA TODA CELEBRAÇÃO.
   Só entra aqui quem tem restrição; quem não está na lista serve para as 9.

   6 = Cobertura Fotográfica: a PhotoMusic **não atende** 15 anos (1) nem
   casamento (2), e o `fotografia.js` recusa esses dois com uma mensagem
   própria. Nas demais só existia PDF pronto para infantil (3), adolescente (4)
   e adulto (5); bodas, formatura, corporativo e outros (6,7,8,9) continuam
   recebendo "estamos preparando um orçamento especial", como sempre foi.
   ⏳ Estender 6,7,8,9 para automático é decisão do Mario: o endpoint já
   devolve preço para todas (R$ 1.797 medido em 18/08, igual em todas), mas
   corporativo costuma pedir proposta a dedo.

   🚨 SEM ESTA TRAVA o cliente de 15 anos que pedisse Cobertura receberia no
   PDF um serviço que a empresa recusa vender: o endpoint gera preço para as 9
   celebrações e não conhece essa regra de negócio. */
const CELEBRACOES_POR_SERVICO = {
  6: [3, 4, 5],
};

/** O serviço já usa o orçamento gerado? Os services consultam para saber se
 *  ainda devem mandar o PDF estático deles.
 *  `celebracao` é opcional: sem ela responde só pela migração, que é o que os
 *  services precisam saber (cada um só chama isso no ramo em que já atende). */
function usaOrcamentoGerado(servicoId, celebracao = null) {
  const id = Number(servicoId);
  if (!SERVICOS_GERADOS.includes(id)) return false;

  const permitidas = CELEBRACOES_POR_SERVICO[id];
  if (permitidas && celebracao != null) return permitidas.includes(Number(celebracao));

  return true;
}

/** Dos ids pedidos, só os que já foram migrados E que valem para a celebração
 *  do evento (a ordem do pedido do cliente é preservada). */
function idsGerados(ids, celebracao = null) {
  return (ids || []).map(Number).filter(id => usaOrcamentoGerado(id, celebracao));
}

/**
 * 🚨 ILUMINAÇÃO (8) JÁ VEM INCLUSA NO SOM COM DJ (7): com os dois no pedido, o
 * PDF cobraria duas vezes a mesma luz.
 *
 * O `index.js` já tira o 8 quando o cliente pede 7 e 8 juntos, MAS só na
 * primeira rodada (`!session.primeiraRodadaFinalizada`). Com o PDF único isso
 * deixou de bastar: quem pede Som na 1ª rodada e Iluminação na 2ª faz o
 * `segundaRodada` juntar as duas listas, e aí os dois entram no MESMO arquivo.
 * A regra passa a valer também aqui, que é o último ponto antes do preço.
 */
function tirarIluminacaoSeTemSom(ids) {
  return ids.includes(7) ? ids.filter(id => id !== 8) : ids;
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
  /* A celebração entra no filtro por causa dos serviços que não valem para
     todo tipo de evento (ver CELEBRACOES_POR_SERVICO). */
  const celebracao = session?.orcamento?.celebracaoId ?? null;

  const ids = idsGerados(idsPedidos, celebracao);
  if (ids.length === 0) return false;          // nada migrado nesta rodada
  if (estaPausado(chatId) || session?.pausado) return false;

  /* 2ª rodada: o PDF sai com TUDO o que ele já pediu, não só o novo. Assim o
     desconto do combo enxerga os serviços das duas rodadas. */
  let idsPdf = ids;
  if (opcoes.segundaRodada) {
    const jaEnviados = idsGerados(session?.orcamento?.servicosEnviados || [], celebracao);
    idsPdf = Array.from(new Set(jaEnviados.concat(ids)));
  }

  // Luz que já vem no Som não entra de novo. Ver a função para o porquê.
  idsPdf = tirarIluminacaoSeTemSom(idsPdf);
  if (idsPdf.length === 0) return false;

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
  tirarIluminacaoSeTemSom,   // exportado para dar para testar a regra sozinha
  SERVICOS_GERADOS,
  SLUG_POR_SERVICO,
  NOME_POR_SERVICO,
};
