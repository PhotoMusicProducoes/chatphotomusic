// jobs/lembreteTarefas.js — Lembrete diário das tarefas em aberto
//
// 🚨 ESTE LEMBRETE NUNCA RODOU. O código dele existia desde sempre, mas morava
// dentro de `jobs/index.js`, que era uma cópia antiga do job de comemorações e
// que NENHUM arquivo carregava (o server.js carrega os jobs um a um, pelo
// nome, e esse nunca esteve na lista). Resgatado em 06/09/2026, a pedido do
// Mario, agora num arquivo próprio que faz uma coisa só.
//
// 📌 Por que não deu para simplesmente carregar o `jobs/index.js`: ele tem, no
// corpo, um setInterval que relê a configuração das comemorações e chama o
// agendador DELE. Carregar aquele arquivo faria nascer um SEGUNDO job de
// comemorações, e todo aniversariante receberia a mensagem duas vezes.
//
// O que sai na mensagem: as tarefas com status "pendente" de todos os eventos
// (tabela pm_tarefas do PhotoMusic Pro), que o plugin cria sozinho quando o
// contrato é assinado. Vai para a linha do operador e, se PM_TAREFAS_GRUPO_ID
// estiver configurado, também para o grupo.
//
// 🔁 REPETE TODO DIA até a tarefa ser concluída, que é o pedido do Mario:
// "enviar todo dia até eu confirmar que foram executadas". Quem conclui é o
// operador, pelo comando *#ok ID* no WhatsApp ou pela tela do WordPress. O
// lembrete NÃO conclui nada (ver o aviso em services/tarefas.js).

const cron = require("node-cron");
const { notificarTarefasAbertas } = require("../services/tarefas.js");

const TIMEZONE = "America/Sao_Paulo";

// 🕙 10h, a mesma hora dos outros envios automáticos (Mario, 05/09/2026).
// Para mudar, é só este número.
const HORA_LEMBRETE = 10;

async function executarLembreteTarefas() {
  try {
    console.log("⏰ [Tarefas] Verificando tarefas abertas para o lembrete diário...");
    const grupoId = process.env.PM_TAREFAS_GRUPO_ID || "";
    await notificarTarefasAbertas(grupoId || null);
  } catch (e) {
    console.error("❌ [Tarefas] Falha no lembrete diário:", e?.message || e);
  }
}

function inicializarLembreteTarefas() {
  cron.schedule(`0 ${HORA_LEMBRETE} * * *`, executarLembreteTarefas, { timezone: TIMEZONE });
  console.log(`⏰ Lembrete diário de tarefas agendado (todo dia às ${HORA_LEMBRETE}h).`);
}

module.exports = {
  inicializarLembreteTarefas,
  executarLembreteTarefas,
  // para teste-lembrete-tarefas.js
  HORA_LEMBRETE
};
