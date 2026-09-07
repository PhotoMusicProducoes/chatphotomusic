// utils/sendText.js — Função utilitária para envio de mensagens de texto via Z-API

const fetch = require("node-fetch");
const { API_URL, INSTANCE_ID, TOKEN, OPERADOR_TELEFONE_ID } = require("./config.js");

// 🔑 Client-token fornecido pela Z-API
const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";

// ======================================================
// 🎭 MODO SOMBRA
// Map: numeroCliente (só dígitos) → numeroOperador (só dígitos)
// Quando ativo, sendText redireciona as msgs do bot para o operador.
// ======================================================
const modoSombraMap = new Map();

function ativarModoSombra(clienteNum, operadorNum) {
  const c = clienteNum.replace(/\D/g, "");
  const o = operadorNum.replace(/\D/g, "");
  modoSombraMap.set(c, o);
  console.log(`🎭 [Modo Sombra] ATIVADO para ${c} → operador ${o}`);
}

function desativarModoSombra(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  modoSombraMap.delete(c);
  console.log(`🎭 [Modo Sombra] DESATIVADO para ${c}`);
}

function estaEmModoSombra(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  return modoSombraMap.has(c);
}

// ======================================================
// 🔇 MODO SILENCIOSO
// Set: numeroCliente (só dígitos)
// Quando ativo, sendText descarta a mensagem completamente.
// Usado no replay de conversa para reconstruir a sessão
// sem reenviar mensagens que o cliente já recebeu.
// ======================================================
const modoSilenciosoSet = new Set();

/* 🚨 PRAZO DE VALIDADE (06/09/2026). O modo silencioso é usado por poucos
   segundos, durante o replay de uma conversa. Se ele ficar ligado por engano
   (o processo morre no meio do replay, uma exceção escapa, uma mensagem real
   do cliente chega enquanto o replay roda), o bot fica MUDO para aquele número
   sem aparecer em lista nenhuma de pausados: ele processa tudo e joga cada
   resposta no lixo. Era exatamente esse o sintoma do caso de 01/09 que a gente
   não conseguiu explicar. Com validade, o defeito se cura sozinho em 2 min. */
const SILENCIOSO_VALIDADE_MS = 2 * 60 * 1000;
const silenciosoDesde = new Map(); // numero -> quando ligou

function ativarModoSilencioso(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  modoSilenciosoSet.add(c);
  silenciosoDesde.set(c, Date.now());
  console.log(`🔇 [Modo Silencioso] ATIVADO para ${c}`);
}

/** Ligado E dentro da validade? Vencido, desliga sozinho e avisa no log. */
function silencioValendo(phone) {
  if (!modoSilenciosoSet.has(phone)) return false;
  const desde = silenciosoDesde.get(phone) || 0;
  if (Date.now() - desde <= SILENCIOSO_VALIDADE_MS) return true;
  modoSilenciosoSet.delete(phone);
  silenciosoDesde.delete(phone);
  console.warn(`⚠️ [Modo Silencioso] VENCEU para ${phone} (ficou ligado por engano). Voltando a falar.`);
  return false;
}

function desativarModoSilencioso(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  modoSilenciosoSet.delete(c);
  silenciosoDesde.delete(c);
  console.log(`🔇 [Modo Silencioso] DESATIVADO para ${c}`);
}

function estaEmModoSilencioso(clienteNum) {
  const c = clienteNum.replace(/\D/g, "");
  return modoSilenciosoSet.has(c);
}

/**
 * Envia uma mensagem de texto.
 * Em Modo Sombra redireciona a msg para o operador (em vez do cliente),
 * com prefixo visual para o operador saber o que o bot enviaria.
 *
 * @returns {Promise<boolean>} true quando a conversa pode seguir em frente.
 *   Modo silencioso e modo sombra devolvem TRUE de propósito: nos dois a
 *   mensagem não vai para o cliente, mas o fluxo TEM de continuar (é o que o
 *   replay faz de útil). False é só o caso de a mensagem ter falhado de
 *   verdade, mesmo depois da segunda tentativa. Quem quiser pode usar isso
 *   para não avançar o passo da conversa às cegas.
 */
async function sendText(chatId, text) {
  try {
    const phone = chatId.endsWith("@c.us") ? chatId.replace("@c.us", "") : chatId;

    // 🔇 Verificar Modo Silencioso (descarta completamente)
    if (silencioValendo(phone)) {
      console.log(`🔇 [Modo Silencioso] Msg suprimida para ${phone}: "${String(text).substring(0, 60)}"`);
      return true;
    }

    // 🎭 Verificar Modo Sombra (redireciona para operador)
    const operadorRedirect = modoSombraMap.get(phone);
    if (operadorRedirect) {
      console.log(`🎭 [Modo Sombra] Msg de bot para ${phone} redirecionada ao operador`);
      // Envia para o OPERADOR com indicação clara
      const destino = operadorRedirect;
      await _enviar(destino, `🤖 *[Bot→cliente]*:\n${text}`);
      return true;
    }

    console.log("➡️ [sendText] Preparando envio para:", chatId);
    console.log("📝 [sendText] Conteúdo:", text);

    /* 🚨 ANTES AQUI SÓ EXISTIA UM catch QUE ESCREVIA NO LOG (06/09/2026).
       Falhou o envio, o bot seguia como se tivesse falado: nenhuma exceção
       subia, o passo da conversa avançava, ninguém era avisado e o cliente
       ficava esperando uma pergunta que nunca chegou. Como o log do Fly só
       guarda uns 2 minutos, o rastro sumia antes de alguém perceber. Era esse
       o buraco por onde o caso de 01/09 escapou.
       Agora: uma nova tentativa e, se ainda falhar, o OPERADOR é avisado. */
    try {
      await _enviar(phone, text);
      return true;
    } catch (erro1) {
      console.warn(`⚠️ [sendText] 1ª tentativa falhou para ${phone}: ${erro1.message}. Tentando de novo...`);
      await new Promise(r => setTimeout(r, 1500));
      try {
        await _enviar(phone, text);
        console.log(`✅ [sendText] Deu certo na 2ª tentativa para ${phone}`);
        return true;
      } catch (erro2) {
        await avisarOperadorFalha(phone, text, erro2);
        return false;
      }
    }

  } catch (error) {
    console.error(`🚨 [sendText] Erro ao enviar mensagem para ${chatId}: ${error.message}`);
    return false;
  }
}

/* Avisa o operador que uma mensagem NÃO chegou ao cliente.
   Cuidados: nunca avisa sobre falha de envio para o próprio operador (senão
   vira laço), e no máximo um aviso a cada 5 minutos, para que uma queda da
   Z-API não vire uma enxurrada no WhatsApp de quem está atendendo. */
const AVISO_FALHA_INTERVALO_MS = 5 * 60 * 1000;
let ultimoAvisoFalha = 0;

async function avisarOperadorFalha(phone, text, erro) {
  console.error(`🚨 [sendText] NÃO ENTREGUE para ${phone}: ${erro.message}`);

  const operador = String(OPERADOR_TELEFONE_ID || "").replace(/\D/g, "");
  if (!operador || phone === operador) return;

  const agora = Date.now();
  if (agora - ultimoAvisoFalha < AVISO_FALHA_INTERVALO_MS) {
    console.warn("⚠️ [sendText] Aviso de falha represado (menos de 5 min do último).");
    return;
  }
  ultimoAvisoFalha = agora;

  const trecho = String(text || "").replace(/\s+/g, " ").slice(0, 120);
  try {
    await _enviar(operador,
      `🚨 *Mensagem não entregue*\n\n` +
      `Não consegui falar com *${phone}* (tentei 2x).\n` +
      `Motivo: ${erro.message}\n\n` +
      `A mensagem era:\n_"${trecho}"_\n\n` +
      `👉 *Assuma esse atendimento*: o cliente está esperando uma resposta que não chegou.`
    );
  } catch (e) {
    console.error(`🚨 [sendText] Nem o aviso ao operador saiu: ${e.message}`);
  }
}

async function _enviar(phone, text) {
  const response = await fetch(
    `${API_URL}/send-text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-token": CLIENT_TOKEN
      },
      body: JSON.stringify({ phone, message: text })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("🚨 [sendText] Erro HTTP:", response.status, data);
    throw new Error(`Erro HTTP: ${response.status} - ${JSON.stringify(data)}`);
  }

  console.log(`✅ [sendText] Mensagem enviada para ${phone}`);
}

module.exports = {
  sendText,
  // para teste-envio-nunca-mudo.js
  silencioValendo, SILENCIOSO_VALIDADE_MS,
  ativarModoSombra, desativarModoSombra, estaEmModoSombra,
  ativarModoSilencioso, desativarModoSilencioso, estaEmModoSilencioso
};
