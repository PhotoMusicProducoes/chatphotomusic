// jobs/followupLeads.js — Fase 4 do funil de marketing
// Follow-up automático dos leads de orçamento que não fecharam.
// Fase A (a partir do orçamento):
//   24h  → mensagem de relacionamento (sem desconto)
//   72h  → condição especial: R$ 50,00 de desconto no fechamento (válida 48h)
//   7d   → condição: R$ 100,00 de desconto no fechamento (válida 48h)
// Fase B (após os 7 dias, ancorada na data do evento, mantendo a promo R$ 100):
//   promo_mensal  → lembrete mensal de que a promo de R$ 100 continua ativa
//   promo_30dias  → ~30 dias do evento, reforça a promo de R$ 100
//   promo_15dias  → ~15 dias do evento, reta final / última chamada R$ 100
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
  const linhaMulti = lead.multiServicos
    ? "\nE lembrando: contratando *2 ou mais serviços*, você ainda garante *R$ 100,00 de desconto* a partir do segundo serviço! 🤩\n"
    : "\n";

  switch (tipo) {
    case "24h":
      // 24h — relacionamento, sem desconto
      return (
        `Olá, *${nome}*! 😊 Aqui é da *PhotoMusic Produções*.\n\n` +
        `Preparamos o orçamento de *${servicos}* para *${celebracao}*${dataTxt} e queria saber: ` +
        `ficou alguma dúvida? Posso ajudar em algo?\n\n` +
        `Estou por aqui! É só responder esta mensagem. 🙏`
      );

    case "72h":
      // 72h — R$ 50,00, condição pessoal, válida 48h
      return (
        `Olá, *${nome}*! Tudo bem? 😊\n\n` +
        `Conversei com a equipe aqui e *consegui uma condição especial* para *${celebracao}*${dataTxt}:\n\n` +
        `🎁 *R$ 50,00 de desconto no fechamento* do contrato!\n` +
        `⏳ Essa condição é válida por *48 horas*.\n` +
        linhaMulti +
        `Vamos garantir essa condição para o seu evento? É só me responder por aqui! 🙌`
      );

    case "promo_mensal":
      // Lembrete mensal — evento ainda distante, promo R$ 100 segue de pé
      return (
        `Olá, *${nome}*! 😊 Passando para lembrar do seu *${celebracao}*${dataTxt}.\n\n` +
        `A nossa *condição especial de R$ 100,00 de desconto* no fechamento continua *de pé* para você! 🎁\n` +
        linhaMulti +
        `Quando quiser garantir a sua data, é só me chamar por aqui. 🙌`
      );

    case "promo_30dias":
      // ~30 dias do evento — reforça a promo R$ 100 + urgência de agenda
      return (
        `Olá, *${nome}*! 😊 Falta *cerca de 1 mês* para *${celebracao}*${dataTxt} e eu não quero que você perca a sua data!\n\n` +
        `A condição de *R$ 100,00 de desconto* no fechamento ainda está disponível para você. 🎁\n` +
        `⏳ Conforme a data se aproxima, a nossa agenda fica concorrida.\n` +
        linhaMulti +
        `Vamos deixar tudo certinho? Me responde por aqui! 🙌`
      );

    case "promo_15dias":
      // ~15 dias do evento — reta final, última chamada R$ 100
      return (
        `Olá, *${nome}*! 😊 Estamos a *cerca de 15 dias* de *${celebracao}*${dataTxt}!\n\n` +
        `Essa é a *reta final* para garantir a sua data com *R$ 100,00 de desconto* no fechamento. 🎁\n` +
        `⏳ É a *última oportunidade* dessa condição.\n` +
        linhaMulti +
        `Posso reservar a sua data agora? Me chama aqui! 🙌✨`
      );

    case "7dias":
    default:
      // 7 dias — R$ 100,00, válida 48h
      return (
        `Olá, *${nome}*! 😊\n\n` +
        `Não quero que você fique sem garantir a sua data${dataTxt ? ` ${dataTxt.trim()}` : ""}! ` +
        `Liberei a *melhor condição que consigo* para *${celebracao}*:\n\n` +
        `🎁 *R$ 100,00 de desconto no fechamento* do contrato!\n` +
        `⏳ Válida por *48 horas*.\n` +
        linhaMulti +
        `Posso reservar a sua data? Me responde por aqui que deixamos tudo certo! 🙌✨`
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
          "24h": "24h", "72h": "72h (R$50)", "7dias": "7d (R$100)",
          "promo_mensal": "mensal (R$100)", "promo_30dias": "30d (R$100)", "promo_15dias": "15d (R$100)"
        };
        console.log(`   ✅ Follow-up ${rotulos[tipo] || tipo} enviado para ${lead.nome} (${lead.telefone})`);
        enviados++;

        await new Promise(r => setTimeout(r, 800));
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
// SCHEDULER — a cada 30 min, das 9h às 19h (Brasília)
// O horário comercial evita mensagem de madrugada; o que
// vencer fora da janela é enviado no primeiro ciclo do dia.
// ======================================================
function inicializarFollowupLeads() {
  cron.schedule("*/30 9-19 * * *", () => {
    executarFollowupLeads();
  }, { timezone: TIMEZONE });

  console.log("📨 Follow-up de leads agendado (a cada 30 min, 9h–19h).");
}

module.exports = { inicializarFollowupLeads, executarFollowupLeads };
