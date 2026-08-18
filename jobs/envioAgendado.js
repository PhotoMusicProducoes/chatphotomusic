// jobs/envioAgendado.js
// Executa os envios que o operador AGENDOU com "#enviarfaltantes HH:MM".
//
// Caso que originou (06/08/2026): a cliente pediu orçamento de todos os
// serviços, parte já tinha sido enviada, mas eram 23h40 — mandar o resto de
// madrugada não faz sentido. O operador agenda para a manhã seguinte e o bot
// envia SÓ o que falta, sem repetir o que o cliente já recebeu.
//
// A marcação fica na própria sessão (session.envioFaltantesEm = timestamp ms),
// que já é persistida em disco, então sobrevive a restart/deploy.

const cron = require("node-cron");
const { sessions } = require("../utils/sessions");
const { sendText } = require("../utils/index.js");

const TIMEZONE = "America/Sao_Paulo";
const OPERADOR_TELEFONE_ID = "5521964428172@c.us"; // fallback se não houver destino salvo
/* A lista vem do index.js (require preguiçoso, igual ao do envio abaixo):
   é a MESMA que o menu usa, então serviço novo entra aqui sozinho. Escrita
   à mão, ela deixava o Totem Retrô de fora do "enviar o que falta". */
function todosOsServicos() {
  try {
    return [...require("../index.js").TODOS_SERVICOS];
  } catch (e) {
    console.error("⚠️ não consegui ler TODOS_SERVICOS:", e.message);
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }
}

async function executarEnvioAgendado() {
  for (const chatId of Object.keys(sessions)) {
    const s = sessions[chatId];
    if (!s || !s.envioFaltantesEm) continue;

    // Só dispara quando a hora chega (ou passa, se o bot esteve fora do ar)
    if (Date.now() < s.envioFaltantesEm) continue;

    // Agendamento velho (mais de 2 dias após a hora marcada) não vale mais
    if ((Date.now() - s.envioFaltantesEm) > 2 * 24 * 60 * 60 * 1000) {
      delete s.envioFaltantesEm;
      delete s.envioFaltantesHora;
      delete s.envioFaltantesCriadoEm;
      continue;
    }

    const enviados  = s.orcamento?.servicosEnviados || [];
    const faltantes = todosOsServicos().filter(x => !enviados.includes(x));

    // Consome o agendamento ANTES de enviar: se algo falhar no meio, não
    // reenvia tudo de novo no ciclo seguinte.
    const destino = s.envioFaltantesDestino || OPERADOR_TELEFONE_ID;
    const horaMarcada = s.envioFaltantesHora || "";
    delete s.envioFaltantesEm;
    delete s.envioFaltantesHora;
    delete s.envioFaltantesCriadoEm;
    delete s.envioFaltantesDestino;

    if (!faltantes.length) continue;

    try {
      const { enviarOrcamentosAutomaticos } = require("../index.js");
      await enviarOrcamentosAutomaticos(chatId, s, faltantes);
      console.log(`   ⏰ Envio agendado concluído para ${chatId} (${faltantes.length} serviço(s)).`);
      await sendText(destino,
        `✅ *Envio agendado concluído*

Os *${faltantes.length} serviço(s)* que faltavam foram enviados para *${chatId}*`
        + (horaMarcada ? ` (agendado para *${horaMarcada}*).` : ".")
      );
    } catch (e) {
      console.error(`   ❌ Envio agendado falhou para ${chatId}:`, e.message);
      try {
        await sendText(destino,
          `❌ *Falha no envio agendado* para *${chatId}*: ${e.message}

Use *#enviarfaltantes* para tentar de novo.`
        );
      } catch (_) { /* aviso é best-effort */ }
    }
  }
}

// A cada 5 minutos, 24h: quem escolhe a hora é o OPERADOR (ele agenda
// só o que quer). A janela 7h-20h vale para os envios AUTOMÁTICOS, não
// para uma ação explícita dele — em 11/08 um agendamento p/ 00:30 nunca
// disparou por causa da janela.
function inicializarEnvioAgendado() {
  cron.schedule("*/5 * * * *", () => {
    executarEnvioAgendado();
  }, { timezone: TIMEZONE });

  console.log("⏰ Envio agendado de orçamentos ativo (a cada 5 min, 24h).");
}

module.exports = { inicializarEnvioAgendado, executarEnvioAgendado };
