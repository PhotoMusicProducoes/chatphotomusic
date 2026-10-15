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
/* As regras de venda (quem a empresa atende, onde sai preço na hora) vêm do
   PhotoMusic Pro, não deste arquivo. Ver o comentário em usaOrcamentoGerado. */
const regrasServico = require("../utils/regrasServico.js");

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

/* ✅ 15/10/2026: A LISTA DE CELEBRAÇÕES SAIU DAQUI.
   Era `const CELEBRACOES_POR_SERVICO = { 6: [3,4,5] }` - uma CÓPIA da mesma
   decisão que o plugin também guardava. Enquanto foram duas cópias, mudar numa
   valia só de um lado: em 13/10 o gerador ofereceu Cobertura Fotográfica numa
   festa de 15 anos, serviço que a empresa não vende, porque ele não conhecia a
   regra que estava AQUI.

   Agora a regra é DADO em `pm_servicos`, o Mario edita na tela Catálogo de
   Serviços, e o bot lê pela rota `/servicos-regras` (cache de 10 minutos, ver
   `utils/regrasServico.js`). Mudança de negócio é na TELA.

   🚨 A TRAVA CONTINUA EXISTINDO, e é o que importa: sem ela o cliente de 15
   anos que pedisse Cobertura receberia no PDF um serviço que a empresa recusa
   vender - o endpoint de preço gera valor para as 9 celebrações. */

/** O serviço já usa o orçamento gerado? Os services consultam para saber se
 *  ainda devem mandar o PDF estático deles.
 *  `celebracao` é opcional: sem ela responde só pela migração, que é o que os
 *  services precisam saber (cada um só chama isso no ramo em que já atende).
 *  🚨 SÍNCRONA de propósito: é chamada de seis pontos do fluxo. Quem guarda as
 *  regras é o cache do `regrasServico`, que se renova em segundo plano. */
function usaOrcamentoGerado(servicoId, celebracao = null) {
  const id = Number(servicoId);
  if (!SERVICOS_GERADOS.includes(id)) return false;

  if (celebracao == null) return true;
  const slug = SLUG_POR_SERVICO[id];
  if (!slug) return true;

  /* "Automático" = o sistema pode mandar preço na hora. Celebração que a
     empresa atende mas com proposta À MÃO cai aqui como `false`, e o service
     manda a mensagem de "orçamento especial" - era o comportamento de antes,
     agora vindo do banco. */
  return regrasServico.automatico(slug, celebracao);
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

/** Tira acento e pontuação, deixando só letras, números e hífen. */
function limparNome(txt) {
  return String(txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Nome do arquivo que o CLIENTE vê no WhatsApp.
 *
 * 🚨 REGRA DO MARIO (19/08/2026): em evento CORPORATIVO quem nomeia a proposta
 * é a EMPRESA, não a pessoa que pediu. Pessoa física só nomeia em evento
 * social. Sem o nome da empresa, sai "Evento-Corporativo".
 * 📌 O nome da PhotoMusic vem na frente: na pasta de downloads do cliente o
 * que diferencia uma proposta da outra é o FORNECEDOR.
 *
 * 🚨 SEM EXTENSÃO: a Z-API acrescenta o ".pdf" ao nome. Com ".pdf" aqui o
 * arquivo chega como ".pdf.pdf".
 */
function nomeArquivo(ids, session) {
  const orc  = (session && session.orcamento) || {};
  const corp = Number(orc.celebracaoId) === 8;

  const empresa = String(orc.empresa || "").trim();
  const cliente = String(orc.nome || "").trim();

  const quem = corp
    ? (empresa || "Evento Corporativo")
    : (cliente || empresa || "Cliente");

  return limparNome("Proposta-PhotoMusic-Producoes-" + quem);
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

    /* 📷 Foto Lembrança é por QUANTIDADE de fotos: o PhotoMusic Pro recusa quando
       o público passa do maior pacote (13/10/2026). É resposta esperada, não
       falha: o cliente recebe a explicação, não o "estou finalizando". */
    if (erro.codigo === "nao_atende") {
      if (estaPausado(chatId)) return false;
      await sendTyping(chatId);
      await sendText(
        chatId,
        `📷 Para o seu evento, *${nomes}* não atende bem: ele é vendido por *quantidade de fotos* e o seu público é maior do que os pacotes comportam.\n\n` +
        `Para esse tamanho de evento, a *Foto Cabine* e os *Totens* funcionam melhor, porque as fotos são *ilimitadas*. Quer que eu monte o orçamento com eles? 😊`
      );
      return false;
    }

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
    nomeArquivo(idsPdf, session),
    sendTyping,
    sendText,
    sendFileByUrl,
    { session, servicoId: idsPdf[0] }
  );

  if (session.orcamento) {
    session.orcamento.linksOrcamento = session.orcamento.linksOrcamento || {};
    idsPdf.forEach(id => { session.orcamento.linksOrcamento[id] = dados.url; });
  }

  /* 📷 Serviço que ficou FORA da proposta porque não atende o público (Foto
     Lembrança com mais convidados que o maior pacote). Sem esta frase o cliente
     que pediu 4 serviços recebe um PDF de 3 e não sabe por quê. (13/10/2026.) */
  if (Array.isArray(dados.nao_atende) && dados.nao_atende.length && !estaPausado(chatId)) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      `📷 Um aviso: *${dados.nao_atende.join(", ")}* ficou de fora da proposta. Ele é vendido por *quantidade de fotos* e não atende bem o seu público. ` +
      `A Foto Cabine e os Totens, com *fotos ilimitadas*, atendem melhor esse tamanho de evento. 😊`
    );
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
