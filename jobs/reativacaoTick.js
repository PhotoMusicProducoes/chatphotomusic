// jobs/reativacaoTick.js
// 📤 ENVIO PROGRAMADO DA REATIVAÇÃO DE EMPRESAS (Mario, 16/11/2026)
//
// O Mario programa o envio no PhotoMusic Pro (aba "Envio programado" da tela
// Empresas (reativação)) e fecha a tela. Quem manda de fato é o WORDPRESS:
// uma mensagem por vez, intervalo aleatório de 1 a 4 min, só das 8h às 20h,
// com a fila e as marcas de enviado no banco dele.
//
// 🚨 O problema: o WP-Cron da TurboCloud só "acorda" quando alguém abre o
// site. Este job é o relógio: bate em /reativacao/tick a cada minuto e o
// WordPress decide se está na hora de mandar a próxima. Nada é decidido aqui
// (a máquina do Fly reinicia sozinha; controle em memória não serviria).
//
// Sem envio ativo, o WordPress responde ativas=0 e a gente passa a conferir
// só a cada 5 min (para pegar uma campanha nova sem martelar o site à toa).

const axios = require("axios");
const cron = require("node-cron");
const { PM_API_BASE, PM_API_KEY } = require("../utils/config.js");

const TIMEZONE = "America/Sao_Paulo";
const OCIOSO_MS = 5 * 60 * 1000; // sem envio ativo: confere a cada 5 min

let rodando = false;     // um tick por vez (gerar o PDF + Z-API pode levar uns segundos)
let ultimaConsulta = 0;
let ativo = true;        // começa conferindo (a máquina pode ter reiniciado no meio de um envio)

async function executarReativacaoTick() {
  // 27/11: WhatsApp desconectado = a rotina PAUSA sem marcar nada como enviado (roda no proximo ciclo)
  if (require("../utils/conexaoZapi.js").pausarSeDesconectado("reativacao")) return;
  if (rodando || !PM_API_KEY) return;
  const agora = Date.now();
  if (!ativo && agora - ultimaConsulta < OCIOSO_MS) return;
  rodando = true;
  ultimaConsulta = agora;
  try {
    const { data } = await axios.post(`${PM_API_BASE}/reativacao/tick`, {}, {
      headers: { "X-PM-Api-Key": PM_API_KEY },
      timeout: 120000,
    });
    ativo = !!(data && data.ativas);
    if (data && data.enviou) console.log("📤 [reativacao] mensagem de reativação enviada pelo PhotoMusic Pro.");
  } catch (e) {
    // 404 = PhotoMusic Pro ainda sem o arquivo novo (FTP): só espera
    const st = e.response && e.response.status;
    if (st !== 404) console.error(`❌ [reativacao] tick falhou: ${st || ""} ${e.message}`);
    ativo = false;
  } finally {
    rodando = false;
  }
}

function inicializarReativacaoTick() {
  cron.schedule("* * * * *", () => { executarReativacaoTick(); }, { timezone: TIMEZONE });
  console.log("📤 Envio programado da reativação: conferindo o PhotoMusic Pro a cada minuto.");
}

module.exports = { inicializarReativacaoTick, executarReativacaoTick };
