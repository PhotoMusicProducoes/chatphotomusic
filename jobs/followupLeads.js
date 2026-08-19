// jobs/followupLeads.js — Fase 4 do funil de marketing
// Follow-up automático dos leads de orçamento que não fecharam.
// Fase A (a partir do orçamento) — experiência do cartão (sem desconto em R$):
//   24h  → relacionamento + emoção + parcele em 4x sem juros
//   48h  → emotiva p/ quebrar a objeção + 5x sem juros
//   72h  → condição especial: 6x sem juros no cartão
//   7d   → melhor condição: 6x sem juros no cartão
// Fase B (após os 7 dias, ancorada na data do evento):
//   promo_mensal  → lembrete mensal + 6x sem juros
//   promo_30dias  → ~30 dias do evento, urgência de agenda + 6x sem juros
//   promo_15dias  → ~15 dias do evento, reta final + 6x sem juros
// O plugin (PhotoMusic_Leads::proximo_followup) é a fonte da verdade do
// que está devido e manda o campo `tipo` em cada lead. Os leads vêm de
// pm_leads (Fase 3). O plugin auto-detecta conversões e respeita o
// "Fechou"/"Perdido" da lista — esses não entram na lista.

const axios = require("axios");
const cron = require("node-cron");
const { sendText } = require("../utils/index.js");
const { sessions } = require("../utils/sessions");
const { PM_API_BASE, PM_API_KEY } = require("../utils/config.js");

const TIMEZONE = "America/Sao_Paulo";

/**
 * Acha a chave da sessão (chatId) pelo telefone do lead, comparando os
 * últimos 8 dígitos (tolera variações de 55/9 no prefixo).
 */
function acharSessaoPorTelefone(telefone) {
  const alvo = String(telefone || "").replace(/\D/g, "").slice(-8);
  if (alvo.length < 8) return null;
  for (const chave of Object.keys(sessions)) {
    if (chave.replace(/\D/g, "").slice(-8) === alvo) return chave;
  }
  return null;
}

/**
 * Camada A: ao enviar o follow-up, encerra o fluxo de orçamento que
 * ficou travado na sessão do cliente — assim a resposta dele não cai
 * num passo antigo (ex: digitar "1" e o bot achar que quer mais serviço).
 * O bot fica quieto e avisa o operador quando o cliente responder.
 */
function encerrarFluxoLead(telefone) {
  const chave = acharSessaoPorTelefone(telefone);
  if (chave && sessions[chave] && sessions[chave].step !== "pausado_followup") {
    sessions[chave].stepAnterior = sessions[chave].step; // p/ o operador retomar com "continuar"
    sessions[chave].step = "pausado_followup";
    sessions[chave].avisouOperadorFollowup = false;
    // persistência é automática (utils/sessions salva a cada 5s)
  }
}

// ======================================================
// MENSAGENS POR ESTÁGIO
// ======================================================
// Deriva o tipo do follow-up. Usa `lead.tipo` (plugin novo); se vier só o
// número (`lead.estagio`, plugin antigo), mapeia para os 3 tipos da Fase A.

/* ======================================================================
   ESCADA DE PRECOS DO FOLLOW-UP (Mario, 17/08/2026)
   ======================================================================
   A escada ANTIGA era de PARCELAS (24h=4x, 48h=5x, 72h=6x) e passou a jogar
   CONTRA a casa: com o orcamento GERADO, o PDF que o cliente ja recebeu diz
   *10x sem juros*, entao oferecer "condicao especial: 6x" era oferecer PIOR
   do que a proposta original.

   A alavanca agora e o PRECO: o follow-up abre no pacote MAIOR e vai DESCENDO
   a escada a cada etapa, sempre com 10x no cartao e o PIX disponivel pela data.

   Os valores NAO sao inventados aqui: vem prontos em `lead.precos`, calculados
   no WordPress pelo MESMO motor que gera o PDF. Recalcular por fora criaria
   uma segunda verdade, e um dia o lembrete discordaria da proposta que o
   cliente tem na mao.
   ====================================================================== */

var NL = "\n";

function brl(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

/* Qual degrau cada etapa mostra. 0 = pacote mais caro. As etapas finais
   repetem o ultimo degrau: abaixo do menor pacote nao ha para onde descer, e
   inventar desconto criaria preco fora do sistema. */
var DEGRAU_POR_ETAPA = {
  "24h": 0, "48h": 1, "72h": 2, "7dias": 2,
  "promo_mensal": 2, "promo_30dias": 2, "promo_15dias": 2
};

function degrauDaEtapa(precos, tipo) {
  var d = DEGRAU_POR_ETAPA[tipo];
  if (d === undefined) d = 0;
  return Math.min(d, precos.colunas.length - 1);
}

/* Bloco de preco da etapa. Devolve "" quando o lead nao tem preco calculado,
   e a mensagem sai sem valor, exatamente como era antes. */
function blocoPreco(lead, tipo) {
  var p = lead.precos;
  if (!p || !Array.isArray(p.colunas) || p.colunas.length === 0) return "";

  var col = p.colunas[degrauDaEtapa(p, tipo)];   // ja vem da mais cara p/ a mais barata
  if (!col || !(col.total > 0)) return "";

  var nParc = p.cartao_parcelas || 10;
  // So nomeia o pacote quando ha mais de um: com um so, o titulo nao informa nada.
  var titulo = (p.colunas.length > 1 && col.titulo)
    ? " Pacote *" + col.titulo + "*"
    : " Seu orçamento";

  var txt = "💰" + titulo + ": *" + brl(col.total) + "*" + NL +
            "💳 ou *" + nParc + "x de " + brl(col.total / nParc) + "* sem juros no cartão";

  // PIX parcelado so existe com 3 meses ou mais ate a festa (npix = 0 abaixo disso)
  if (p.npix >= (p.pix_min || 3)) {
    txt += NL + "💠 ou *PIX em até " + p.npix + "x* até a data do seu evento";
  }
  return txt + NL + NL;   // linha em branco: separa o preco do texto seguinte
}

/* ===== CARDÁPIO DO TIER (pedido do Mario, 18/08/2026) =====
   Cada etapa mostra o cardápio INTEIRO de um pacote: cada serviço sozinho,
   as combinações entre eles e a versão com GuestBook, sempre nas DUAS
   durações. Ver a diferença pequena entre 4h e 5h é o que faz o cliente
   subir de duração.
   Vem pronto do WordPress em `lead.precos.tiers`, um por pacote, na ordem
   Premium -> Tirinha -> Gold. Aqui só se escolhe o degrau e se formata. */
var EMOJI_LINHA = { servico: "📸", combo: "✨", combo_guestbook: "📖" };
var MAX_COMBOS = 3;   // cliente que pede 9 serviços geraria dezenas de linhas

function blocoCardapio(lead, tipo) {
  var p = lead.precos;
  if (!p || !Array.isArray(p.tiers) || p.tiers.length === 0) return "";

  var tier = p.tiers[Math.min(DEGRAU_POR_ETAPA[tipo] === undefined ? 0 : DEGRAU_POR_ETAPA[tipo], p.tiers.length - 1)];
  if (!tier || !Array.isArray(tier.linhas) || tier.linhas.length === 0) return "";

  var nParc = p.cartao_parcelas || 10;
  var hCheia = p.horas || 0;
  var hMenos = p.horas_menos || 0;

  /* Preço de uma duração: "5h: *10x de R$ 269,70*"
     🚨 SÓ A PARCELA, e o negrito é dela (Mario, 19/08/2026): o valor cheio já
     está no PDF do orçamento que o cliente tem na mão, e no follow-up ele
     roubava o destaque justamente do número que cabe no bolso. */
  function linhaValor(h, v) {
    var prefixo = h > 0 ? h + "h: " : "";
    return "   " + prefixo + "*" + nParc + "x de " + brl(v / nParc) + "*";
  }

  // Serviços primeiro, combinações depois (e as combinações vêm do motor já
  // ordenadas por quantidade de serviços, então as mais completas abrem).
  var servicos = tier.linhas.filter(function (l) { return l.tipo === "servico"; });
  var combos   = tier.linhas.filter(function (l) { return l.tipo !== "servico"; }).slice(0, MAX_COMBOS);

  var txt = "💎 *Pacote " + tier.titulo + "*" + NL;

  servicos.concat(combos).forEach(function (l) {
    txt += NL + (EMOJI_LINHA[l.tipo] || "✨") + " *" + l.nome + "*" + NL;
    // Duração menor primeiro: a leitura sobe do mais barato para o mais caro.
    if (l.valor_menos !== null && l.valor_menos !== undefined && hMenos > 0) {
      txt += linhaValor(hMenos, l.valor_menos) + NL;
    }
    txt += linhaValor(hCheia, l.valor) + NL;
  });

  if (p.npix >= (p.pix_min || 3)) {
    txt += NL + "💠 No PIX dá para dividir em até *" + p.npix + "x* até a data do seu evento" + NL;
  }
  /* Linha em branco no fim: com 1 serviço só o `linhaMulti` vem vazio e o
     texto de fechamento colava na última parcela. */
  return txt + NL;
}

/* Aviso de que desceu um degrau, so quando desceu de verdade. */
function frasePrecoMenor(lead, tipo) {
  var p = lead.precos;
  if (!p || !Array.isArray(p.colunas) || p.colunas.length < 2) return "";
  return degrauDaEtapa(p, tipo) > 0
    ? "Separei uma opção com *valor mais leve* pra caber melhor no seu bolso. 🙌" + NL
    : "";
}

/* Titulo da mensagem = 1a linha, e o que aparece no PREVIEW da lista de
   conversas do WhatsApp (ideia da Adriana, 07/07). Com preco, a PARCELA no
   preview vale mais que "condicao especial": o cliente ve quanto cabe no
   bolso antes de abrir. Sem preco calculado, cai no titulo antigo. */
function tituloPreco(lead, tipo, fallback) {
  var p = lead.precos;
  if (!p || !Array.isArray(p.colunas) || p.colunas.length === 0) return fallback;
  var col = p.colunas[degrauDaEtapa(p, tipo)];
  if (!col || !(col.total > 0)) return fallback;
  var n = p.cartao_parcelas || 10;
  return "*💳 Tudo em " + n + "x sem juros no cartão!*";
}

function tipoDoLead(lead) {
  if (lead.tipo) return lead.tipo;
  return { 1: "24h", 2: "72h", 3: "7dias" }[lead.estagio] || "24h";
}

function montarMensagemFollowup(lead) {
  const nome       = (lead.nome || "").split(" ")[0] || "Cliente";
  const celebracao = lead.celebracao || "o seu evento";
  const dataTxt    = lead.dataEvento ? ` no dia *${lead.dataEvento}*` : "";
  const servicos   = lead.servicos || "nossos serviços";
  const tipo       = tipoDoLead(lead);

  // Lembrete do desconto de 2+ serviços (acumula com o do follow-up)
  /* O desconto de R$ 100 por servico a mais JA ESTA no valor calculado (o
     motor aplica o combo antes de devolver o total). Prometer "ainda
     garante" seria prometer o mesmo desconto duas vezes, e o cliente
     cobraria isso na hora de fechar. Agora a frase so INFORMA. */
  const linhaMulti = lead.multiServicos
    ? "Esse valor já vem com o *desconto de R$ 100,00* por contratar mais de um serviço. 🤩\n"
    : "";

  switch (tipo) {
    case "24h":
      // 24h — relacionamento + emoção + 4x sem juros
      // Título/gancho na 1ª linha: aparece no preview da lista de conversas
      // do WhatsApp e motiva o cliente a abrir a mensagem. Sugestão da
      // Adriana, 2026-07-07.
      return (
        `${tituloPreco(lead, tipo, "*💳 Condição especial pra você!*")}\n\n` +
        `Oi, *${nome}*! ❤️ Aqui é da *PhotoMusic Produções*.\n\n` +
        `Preparei com muito carinho o orçamento de *${servicos}* para o seu *${celebracao}*${dataTxt}. ` +
        `Mais do que fotos e equipamentos, o que a gente entrega é emoção, aquele momento que fica guardado pra sempre. ❤️\n\n` +
        `${frasePrecoMenor(lead, tipo)}${blocoCardapio(lead, tipo)}` +
        `Ficou alguma dúvida? Tem algo que eu possa te explicar melhor pra te ajudar a decidir? ` +
        `Estou bem aqui, é só me responder. 🙏`
      );

    case "48h":
      // 48h — emotiva, abre a objeção + 5x sem juros. Pedido da Adriana 2026-06-29.
      return (
        `${tituloPreco(lead, tipo, "*💳 Condição especial pra você!*")}\n\n` +
        `Oi, *${nome}*! ❤️ Aqui é da *PhotoMusic Produções*.\n\n` +
        `Sabe o que mais me marca no nosso trabalho? Não são as câmeras nem os equipamentos. ` +
        `É ver a emoção no rosto das pessoas, o abraço apertado, a risada que fica guardada pra sempre. ` +
        `O que a gente faz de verdade é cuidar das suas memórias com todo o carinho. ❤️\n\n` +
        `Quando você falou com a gente sobre o seu *${celebracao}*${dataTxt}, deu pra sentir o quanto esse dia é especial pra você. ` +
        `E eu não queria que nada pequeno ficasse no caminho da gente viver isso junto.\n\n` +
        `${frasePrecoMenor(lead, tipo)}${blocoCardapio(lead, tipo)}` +
        `Se tiver alguma coisa te segurando, seja o valor, a data, ou qualquer outro detalhe, me conta de coração aberto. ` +
        `Sem pressa e sem pressão. Vou fazer o possível pra achar um jeito que caiba pra você. 🙏\n\n` +
        `Posso te ajudar com isso?`
      );

    case "72h":
      // 72h — condição especial: 6x sem juros, com emoção + abrir objeção
      return (
        `${tituloPreco(lead, tipo, "*💳 Condição especial!*")}\n\n` +
        `Oi, *${nome}*! ❤️ Tudo bem?\n\n` +
        `Fiquei pensando no seu *${celebracao}*${dataTxt} e fui conversar com a equipe pra tentar facilitar pra você. ` +
        `Consegui uma *condição especial, feita com carinho*:\n\n` +
        `${blocoCardapio(lead, tipo)}` +
        linhaMulti +
        `Mas, mais importante que isso: se tiver alguma coisa te deixando em dúvida, me conta. ` +
        `A gente quer muito fazer parte desse dia tão especial com você. Vamos juntos? 🙌❤️`
      );

    case "promo_mensal":
      // Lembrete mensal — evento distante. Carinho + sondar objeção + 6x sem juros
      return (
        `${tituloPreco(lead, tipo, "*💳 Sua condição continua valendo!*")}\n\n` +
        `Olá, *${nome}*! 😊 Passando com carinho para lembrar do seu *${celebracao}*${dataTxt}.\n\n` +
        `Aqui na PhotoMusic a gente é uma família que cuida de outras famílias, e ia adorar fazer parte desse seu dia. ❤️\n\n` +
        `Ficou alguma coisa te deixando na dúvida pra decidir? Me conta, sem compromisso, que a gente vê o melhor jeito juntos. 🙏\n` +
        `${frasePrecoMenor(lead, tipo)}${blocoCardapio(lead, tipo)}` +
        linhaMulti +
        `Quando quiser garantir a sua data, é só me chamar por aqui. 🙌`
      );

    case "promo_30dias":
      // ~30 dias do evento — carinho + sondar objeção + urgência de agenda + 6x
      return (
        `${tituloPreco(lead, tipo, "*⏳ Sua data está chegando!*")}\n\n` +
        `Olá, *${nome}*! ❤️ Falta *cerca de 1 mês* para *${celebracao}*${dataTxt}, e eu não quero que você perca a sua data!\n\n` +
        `Esse dia é muito especial, e a gente ia cuidar das suas memórias com todo o carinho, como se fosse da nossa própria família. 🥹\n\n` +
        `Tem algo te segurando pra fechar, o valor, a data, algum detalhe? Me fala de coração aberto, sem pressão, que eu te ajudo a achar um caminho. 🙏\n` +
        `${frasePrecoMenor(lead, tipo)}${blocoCardapio(lead, tipo)}` +
        `⏳ Conforme a data se aproxima, a nossa agenda fica concorrida.\n` +
        linhaMulti +
        `Vamos deixar tudo certinho? Me responde por aqui! 🙌`
      );

    case "promo_15dias":
      // ~15 dias do evento — reta final, carinho + sondar objeção + 6x
      return (
        `${tituloPreco(lead, tipo, "*⏳ Última chance!*")}\n\n` +
        `Olá, *${nome}*! ❤️ Estamos a *cerca de 15 dias* de *${celebracao}*${dataTxt}!\n\n` +
        `Eu ia ficar muito feliz da PhotoMusic fazer parte de um momento tão importante pra você e pra sua família. 🥹\n\n` +
        `Se ainda tiver alguma coisa te impedindo de fechar, me conta com sinceridade, sem pressão, que a gente tenta achar um jeito. 🙏\n` +
        `Essa é a *reta final* pra garantir a sua data! 🙌\n${blocoCardapio(lead, tipo)}` +
        linhaMulti +
        `Posso reservar a sua data? Me chama aqui! 🙌✨`
      );

    case "7dias":
    default:
      // 7 dias — melhor condição: 6x sem juros, com emoção + abrir objeção
      return (
        `${tituloPreco(lead, tipo, "*💳 Sua melhor condição!*")}\n\n` +
        `Oi, *${nome}*! ❤️\n\n` +
        `Não quero mesmo que você fique sem viver o seu *${celebracao}*${dataTxt} do jeito que sonhou. ` +
        `Então, pra facilitar de vez, a *melhor condição que consigo*:\n\n` +
        `${blocoCardapio(lead, tipo)}` +
        linhaMulti +
        `E se ainda tiver algo te segurando, seja o valor ou qualquer outro motivo, me fala com sinceridade. ` +
        `O que mais quero é encontrar um caminho pra cuidar das suas memórias com todo o carinho que a gente tem. ` +
        `Posso reservar a sua data? 🙌❤️`
      );
  }
}

// ======================================================
// EXECUÇÃO — busca leads devidos, envia e registra
// ======================================================
async function executarFollowupLeads() {
  console.log("\n📨 ========== FOLLOW-UP DE LEADS ==========");
  try {
    const resp = await axios.get(`${PM_API_BASE}/leads-followup`, {
      headers: { "X-PM-Api-Key": PM_API_KEY },
      timeout: 15000
    });

    const leads = resp.data?.leads || [];
    console.log(`📋 ${leads.length} lead(s) com follow-up devido.`);

    let enviados = 0, erros = 0;
    let idxEnvio = 0; // p/ o intervalo anti-bloqueio entre envios do mesmo ciclo

    for (const lead of leads) {
      try {
        // As mensagens do Sistema PhotoMusic Pro (follow-up) SEMPRE chegam ao
        // cliente — pausa especial / pausa do operador só calam o fluxo
        // conversacional do bot, não as mensagens proativas do sistema.
        const tipo = tipoDoLead(lead);
        const msg  = montarMensagemFollowup(lead);
        await sendText(lead.telefone, msg);
        await registrarFollowup(lead.id, tipo, lead.estagio);

        // Camada A: encerra o fluxo travado para a resposta não colidir
        encerrarFluxoLead(lead.telefone);

        const rotulos = {
          "24h": "24h (maior)", "48h": "48h (medio)", "72h": "72h (menor)", "7dias": "7d (menor)",
          "promo_mensal": "mensal (menor)", "promo_30dias": "30d (menor)", "promo_15dias": "15d (menor)"
        };
        console.log(`   ✅ Follow-up ${rotulos[tipo] || tipo} enviado para ${lead.nome} (${lead.telefone})`);
        enviados++;

        // Intervalo anti-bloqueio da Meta: o 1º envio do ciclo sai em ~3s e,
        // a partir do 2º, varia aleatoriamente entre 5 e 15s — parece humano.
        idxEnvio++;
        const espera = idxEnvio <= 1 ? 3000 : 5000 + Math.floor(Math.random() * 10001);
        await new Promise(r => setTimeout(r, espera));
      } catch (e) {
        console.error(`   ❌ Erro no lead #${lead.id}: ${e.message}`);
        erros++;
      }
    }

    if (leads.length) {
      console.log(`📊 Follow-up: ${enviados} enviado(s), ${erros} erro(s).`);
    }
  } catch (e) {
    console.error(`❌ Erro ao buscar leads para follow-up: ${e.message}`);
  }
  console.log("📨 ========== FIM DO FOLLOW-UP ==========\n");
}

async function registrarFollowup(id, tipo, estagio) {
  // Envia `tipo` (plugin novo) e mantém `estagio` por compatibilidade.
  await axios.post(
    `${PM_API_BASE}/leads-followup-registrar`,
    { id, tipo, estagio },
    { headers: { "X-PM-Api-Key": PM_API_KEY }, timeout: 10000 }
  );
}

// ======================================================
// SCHEDULER — a cada 30 min, das 7h às 20h (Brasília)
// Janela de envio da PhotoMusic: o cliente pode pedir orçamento 24h
// por dia, mas o follow-up NÃO sai de madrugada. O que vencer fora da
// janela (à noite/madrugada) é enviado no primeiro ciclo das 7h.
// ======================================================
function inicializarFollowupLeads() {
  cron.schedule("*/30 7-20 * * *", () => {
    executarFollowupLeads();
  }, { timezone: TIMEZONE });

  console.log("📨 Follow-up de leads agendado (a cada 30 min, 7h–20h).");
}

module.exports = { inicializarFollowupLeads, executarFollowupLeads };
