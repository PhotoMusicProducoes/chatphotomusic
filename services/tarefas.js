// services/tarefas.js — Tarefas via API WordPress
// Consulta, notifica e confirma tarefas no ChatBot PhotoMusic Pro

const axios = require("axios");
const { sendText, sendTyping } = require("../utils/index.js");
const { PM_API_BASE, PM_API_KEY } = require("../utils/config.js");

const OPERADOR_TELEFONE_ID = "5521964428172@c.us";

// ======================================================
// HEADERS PADRÃO PARA A API WORDPRESS
// ======================================================
function headersApi() {
  return { "X-PM-API-Key": PM_API_KEY };
}

// ======================================================
// BUSCAR TAREFAS DA API
// ======================================================
async function buscarTarefas(filtros = {}) {
  try {
    const params = new URLSearchParams();
    if (filtros.status)      params.append("status",      filtros.status);
    if (filtros.responsavel) params.append("responsavel", filtros.responsavel);

    const url = `${PM_API_BASE}/tarefas?${params.toString()}`;
    const resp = await axios.get(url, { headers: headersApi(), timeout: 10000 });
    return resp.data;
  } catch (e) {
    console.error("❌ [Tarefas] Erro ao buscar:", e?.message || e);
    return { total: 0, tarefas: [] };
  }
}

// ======================================================
// CONCLUIR TAREFA VIA API
// ======================================================
async function concluirTarefa(id, confirmadoPor = "Operador via WhatsApp") {
  try {
    const url = `${PM_API_BASE}/tarefas/${id}/concluir`;
    const resp = await axios.post(url, { confirmado_por: confirmadoPor }, {
      headers: headersApi(),
      timeout: 10000
    });
    return resp.data;
  } catch (e) {
    const status = e?.response?.status;
    const msg    = e?.response?.data?.error || e?.message || "Erro desconhecido";
    return { success: false, mensagem: msg, status };
  }
}

// ======================================================
// FORMATAR LISTA DE TAREFAS PARA WHATSAPP
// ======================================================
function formatarLista(tarefas) {
  if (!tarefas || tarefas.length === 0) {
    return "✅ Nenhuma tarefa em aberto no momento!";
  }

  const pm      = tarefas.filter(p => p.responsavel === "photomusic");
  const cliente = tarefas.filter(p => p.responsavel === "cliente");

  let msg = `📋 *Tarefas em aberto (${tarefas.length})*\n`;

  if (pm.length > 0) {
    msg += `\n📌 *PhotoMusic Produções (${pm.length}):*\n`;
    for (const p of pm) {
      const data = p.data_prevista
        ? p.data_prevista.split("-").reverse().join("/")
        : "sem prazo";
      const vencida = p.data_prevista && p.data_prevista < new Date().toISOString().slice(0, 10);
      msg += `  #${p.id} — ${p.descricao}\n`;
      msg += `     👤 ${p.cliente || "—"} | 📅 ${data}${vencida ? " ⚠️ VENCIDA" : ""}\n`;
    }
  }

  if (cliente.length > 0) {
    msg += `\n👤 *Aguardando Cliente (${cliente.length}):*\n`;
    for (const p of cliente) {
      const data = p.data_prevista
        ? p.data_prevista.split("-").reverse().join("/")
        : "sem prazo";
      msg += `  #${p.id} — ${p.descricao}\n`;
      msg += `     👤 ${p.cliente || "—"} | 📅 ${data}\n`;
    }
  }

  msg += `\n_Use *#ok ID* para marcar como concluída_`;
  return msg;
}

// ======================================================
// NOTIFICAR TAREFAS ABERTAS (cron diário)
// ======================================================
async function notificarTarefasAbertas(grupoId = null) {
  console.log("📋 [Tarefas] Verificando tarefas abertas para notificar...");

  const dados = await buscarTarefas({ status: "pendente" });
  if (dados.total === 0) {
    console.log("✅ [Tarefas] Nenhuma tarefa em aberto.");
    return;
  }

  const msg = formatarLista(dados.tarefas);

  // Envia para o operador
  await sendTyping(OPERADOR_TELEFONE_ID);
  await sendText(OPERADOR_TELEFONE_ID, msg);
  console.log(`📤 [Tarefas] Notificação enviada ao operador (${dados.total} tarefas)`);

  // Envia para o grupo, se configurado
  if (grupoId) {
    await sendTyping(grupoId);
    await sendText(grupoId, msg);
    console.log(`📤 [Tarefas] Notificação enviada ao grupo: ${grupoId}`);
  }

  /* 🚨 AQUI HAVIA UM LAÇO QUE APAGAVA A LISTA INTEIRA (achado em 06/09/2026).
     Ele chamava POST /tarefas/{id}/concluir para cada tarefa, com o cabeçalho
     "X-Only-Increment: 1", na intenção de só somar 1 no contador de avisos.
     Só que o plugin NÃO conhece esse cabeçalho: o endpoint lê o id, confere se
     está pendente e chama PhotoMusic_Tarefas::concluir(), ponto. Ou seja, todo
     aviso diário marcaria TODAS as tarefas como concluídas e a lista chegaria
     vazia no dia seguinte, sem ninguém ter feito nada.
     Nunca explodiu porque o job que chamava esta função estava morto.
     Tarefa só se conclui pelo comando #ok ID do operador ou pela tela do
     WordPress. É esse o pedido do Mario: avisar TODO DIA até ele confirmar. */
}

// ======================================================
// HANDLER DO COMANDO #tarefas (operador)
// ======================================================
async function handleComandoTarefas(chatId) {
  await sendTyping(chatId);
  const dados = await buscarTarefas({ status: "pendente" });
  const msg   = formatarLista(dados.tarefas);
  await sendText(chatId, msg);
}

// ======================================================
// HANDLER DO COMANDO #ok ID (operador)
// ======================================================
async function handleComandoOk(chatId, id) {
  if (!id || isNaN(id)) {
    await sendText(chatId, "⚠ Use: *#ok ID* — ex: *#ok 12*");
    return;
  }

  await sendTyping(chatId);
  const resultado = await concluirTarefa(parseInt(id, 10), "Operador via WhatsApp");

  if (resultado.success) {
    await sendText(chatId, `✅ ${resultado.mensagem}`);
  } else {
    await sendText(chatId, `❌ Erro: ${resultado.mensagem}`);
  }
}

module.exports = {
  buscarTarefas,
  concluirTarefa,
  formatarLista,
  notificarTarefasAbertas,
  handleComandoTarefas,
  handleComandoOk,
};
