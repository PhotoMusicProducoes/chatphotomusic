// jobs/envioAgendado.js
// Executa os envios que o operador AGENDOU com "#enviarfaltantes HH:MM".
//
// Caso que originou (06/08/2026): a cliente pediu orçamento de todos os
// serviços, parte já tinha sido enviada, mas eram 23h40 — mandar o resto de
// madrugada não faz sentido. O operador agenda para a manhã seguinte e o bot
// envia SÓ o que falta, sem repetir o que o cliente já recebeu.
//
// A marcação fica na própria sessão (session.envioFaltantesAs = "08:00"),
// que já é persistida em disco, então sobrevive a restart/deploy.

const cron = require("node-cron");
const { sessions } = require("../utils/sessions");

const TIMEZONE = "America/Sao_Paulo";
const TODOS = [1, 2, 3, 4, 5, 6, 7, 8];

/** "HH:MM" de agora no fuso de Brasília. */
function horaAgora() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

async function executarEnvioAgendado() {
  const agora = horaAgora();

  for (const chatId of Object.keys(sessions)) {
    const s = sessions[chatId];
    if (!s || !s.envioFaltantesAs) continue;

    // Só dispara quando a hora chega (ou passa, se o bot estava fora do ar)
    if (agora < s.envioFaltantesAs) continue;

    // Agendamento velho (mais de 2 dias) não vale mais
    if (s.envioFaltantesCriadoEm && (Date.now() - s.envioFaltantesCriadoEm) > 2 * 24 * 60 * 60 * 1000) {
      delete s.envioFaltantesAs;
      delete s.envioFaltantesCriadoEm;
      continue;
    }

    const enviados  = s.orcamento?.servicosEnviados || [];
    const faltantes = TODOS.filter(x => !enviados.includes(x));

    // Consome o agendamento ANTES de enviar: se algo falhar no meio, não
    // reenvia tudo de novo no ciclo seguinte.
    delete s.envioFaltantesAs;
    delete s.envioFaltantesCriadoEm;

    if (!faltantes.length) continue;

    try {
      const { enviarOrcamentosAutomaticos } = require("../index.js");
      await enviarOrcamentosAutomaticos(chatId, s, faltantes);
      console.log(`   ⏰ Envio agendado concluído para ${chatId} (${faltantes.length} serviço(s)).`);
    } catch (e) {
      console.error(`   ❌ Envio agendado falhou para ${chatId}:`, e.message);
    }
  }
}

// A cada 5 minutos, das 7h às 20h (mesma janela dos outros envios ao cliente)
function inicializarEnvioAgendado() {
  cron.schedule("*/5 7-20 * * *", () => {
    executarEnvioAgendado();
  }, { timezone: TIMEZONE });

  console.log("⏰ Envio agendado de orçamentos ativo (a cada 5 min, 7h–20h).");
}

module.exports = { inicializarEnvioAgendado, executarEnvioAgendado };
