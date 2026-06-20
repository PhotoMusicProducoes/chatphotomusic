// jobs/lembreteOrcamento.js — Lembrete de orçamento ABANDONADO no meio
// ---------------------------------------------------------------------
// Quando o cliente começa a pedir um orçamento e PARA no meio das
// perguntas (ex.: parou no "horário de término"), ele nunca finaliza e a
// gente perde o contato. Este job varre as sessões, encontra quem travou
// num passo de coleta do orçamento e manda lembretes para motivar a voltar.
//
// Cadência (medida desde a ÚLTIMA mensagem do cliente):
//   2h  → 1º lembrete (mesmo dia, interesse quente)
//   24h → 2º lembrete
//   72h → 3º lembrete (última chamada)
//   96h → avisa o OPERADOR para um contato manual (e encerra os lembretes)
//
// Regras: NUNCA envia entre 20h e 7h (Brasília); respeita a pausa especial;
// cada estágio sai só uma vez; se o cliente avança de pergunta, o ciclo de
// lembretes reinicia naquele novo passo; sessões com mais de 7 dias de
// inatividade são ignoradas (velhas demais).

const cron = require("node-cron");
const { sendText, estaPausadoEspecial } = require("../utils/index.js");
const { sessions } = require("../utils/sessions");

const TIMEZONE = "America/Sao_Paulo";

// Operador que recebe o aviso de lead parado (mesmo número usado no index.js)
const OPERADOR_TELEFONE_ID = "5521964428172@c.us";

// Limiares (ms)
const H2     = 2  * 60 * 60 * 1000;
const H24    = 24 * 60 * 60 * 1000;
const H72    = 72 * 60 * 60 * 1000;
const H_OP   = 96 * 60 * 60 * 1000; // 72h + 24h de tolerância → avisa operador
const H_MAX  = 7  * 24 * 60 * 60 * 1000; // > 7 dias parado = ignora (sessão velha)

// Passos de COLETA do orçamento (antes da entrega dos valores). Quem está
// aqui e ficou em silêncio é um abandono recuperável.
const PASSOS_QUESTIONARIO = new Set([
  "orcamento_nome", "orcamento_nome_confirmar",
  "orcamento_celebracao", "orcamento_celebracao_outros",
  "orcamento_convidados", "orcamento_dias",
  "orcamento_horarios_iguais", "orcamento_datas_multiplas",
  "orcamento_dia_data", "orcamento_dia_hora_inicio", "orcamento_dia_hora_fim",
  "orcamento_data", "orcamento_hora_inicio", "orcamento_hora_fim",
  "orcamento_bairro", "orcamento_cidade", "orcamento_salao",
  "orcamento_onde_encontrou", "orcamento_detalhes", "orcamento_detalhes_texto"
]);

// Pergunta amigável por passo (usada se a sessão não guardou o texto exato)
const PERGUNTA_POR_PASSO = {
  "orcamento_nome": "Qual o seu nome?",
  "orcamento_nome_confirmar": "Só confirmando: o seu nome está correto? (1 - Sim / 2 - Não)",
  "orcamento_celebracao": "O que você vai celebrar?",
  "orcamento_celebracao_outros": "O que você vai celebrar?",
  "orcamento_convidados": "Quantos convidados?",
  "orcamento_dias": "Quantos dias de evento?",
  "orcamento_horarios_iguais": "Os horários são iguais em todos os dias? (1 - Sim / 2 - Não)",
  "orcamento_datas_multiplas": "Quais são as datas do evento?",
  "orcamento_dia_data": "Qual a data desse dia do evento?",
  "orcamento_dia_hora_inicio": "Qual o horário de início?",
  "orcamento_dia_hora_fim": "Qual o horário de término?",
  "orcamento_data": "Qual a data do evento? (Ex: 01/02/2026)",
  "orcamento_hora_inicio": "Qual o horário de início? (Ex: 18:00 ou 18h)",
  "orcamento_hora_fim": "Qual o horário de término? (Ex: 23:00 ou 23h)",
  "orcamento_bairro": "Em qual bairro será o evento?",
  "orcamento_cidade": "Em qual cidade será o evento?",
  "orcamento_salao": "Qual o nome do salão/local? (ou digite *pular*)",
  "orcamento_onde_encontrou": "Só uma curiosidade: como você nos conheceu?",
  "orcamento_detalhes": "Quer adicionar algum detalhe sobre o evento? (1 - Sim / 2 - Não)",
  "orcamento_detalhes_texto": "Pode me contar os detalhes do seu evento."
};

// Descrição curta do passo para o aviso do operador
const DESCRICAO_PASSO = {
  "orcamento_nome": "nome", "orcamento_nome_confirmar": "confirmar nome",
  "orcamento_celebracao": "tipo de celebração", "orcamento_celebracao_outros": "tipo de celebração",
  "orcamento_convidados": "nº de convidados", "orcamento_dias": "nº de dias",
  "orcamento_horarios_iguais": "horários iguais?", "orcamento_datas_multiplas": "datas",
  "orcamento_dia_data": "data do dia", "orcamento_dia_hora_inicio": "horário de início",
  "orcamento_dia_hora_fim": "horário de término",
  "orcamento_data": "data do evento", "orcamento_hora_inicio": "horário de início",
  "orcamento_hora_fim": "horário de término",
  "orcamento_bairro": "bairro", "orcamento_cidade": "cidade", "orcamento_salao": "salão/local",
  "orcamento_onde_encontrou": "como nos conheceu", "orcamento_detalhes": "detalhes do evento",
  "orcamento_detalhes_texto": "detalhes do evento"
};

function horaSaoPaulo() {
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", hour12: false });
  return parseInt(fmt.format(new Date()), 10);
}

function dentroDaJanela() {
  const h = horaSaoPaulo();
  return h >= 7 && h < 20; // permitido 7h–19h59; bloqueado 20h–6h59
}

function perguntaPendente(s) {
  return (s.ultimaPerguntaNaoRespondida && String(s.ultimaPerguntaNaoRespondida).trim())
    || PERGUNTA_POR_PASSO[s.step]
    || null;
}

function montarMensagem(devido, s) {
  const nome       = ((s.orcamento && s.orcamento.nome) || "").split(" ")[0] || "";
  const ola        = nome ? `Oi, *${nome}*!` : "Oi!";
  const celebracao = (s.orcamento && s.orcamento.celebracao) || "o seu evento";
  const pergunta   = perguntaPendente(s);
  const linhaPerg  = pergunta
    ? `\n\n👉 ${pergunta}`
    : `\n\nÉ só me mandar um *oi* que a gente continua de onde parou! 🙌`;

  switch (devido) {
    case 1: // 2h
      return (
        `${ola} 😊 Vi que começamos o seu orçamento para *${celebracao}* e paramos pertinho do fim.\n\n` +
        `Falta só responder mais uma coisinha pra eu montar um *orçamento personalizado* pro seu evento ` +
        `(e não um valor genérico 😉). É bem rapidinho!` +
        linhaPerg
      );
    case 2: // 24h
      return (
        `${ola} 😊 Passando pra lembrar do seu orçamento de *${celebracao}*.\n\n` +
        `Faltou só um detalhe pra finalizar e eu já te envio os valores certinhos. Posso continuar?` +
        linhaPerg
      );
    case 3: // 72h — última chamada
    default:
      return (
        `${ola} 😊 Não quero que você fique sem o seu orçamento de *${celebracao}*.\n\n` +
        `É só me responder essa última pergunta que eu finalizo e te mando tudo. Vamos lá? 🙌` +
        linhaPerg
      );
  }
}

function montarMensagemOperador(chatId, s) {
  const nome       = (s.orcamento && s.orcamento.nome) || "(sem nome)";
  const celebracao = (s.orcamento && s.orcamento.celebracao) || "(não informado)";
  const passo      = DESCRICAO_PASSO[s.step] || s.step;
  return (
    `🙋 *Lead de orçamento parado*\n` +
    `${chatId}\n` +
    `Nome: ${nome}\n` +
    `Evento: ${celebracao}\n` +
    `Parou em: ${passo}\n\n` +
    `O cliente não respondeu aos 3 lembretes automáticos do orçamento. ` +
    `Vale um contato manual. 🙏`
  );
}

// ======================================================
// EXECUÇÃO
// ======================================================
async function executarLembreteOrcamento() {
  if (!dentroDaJanela()) return; // proteção extra à janela 7h–20h

  console.log("\n⏰ ===== LEMBRETE DE ORÇAMENTO ABANDONADO =====");
  const agora = Date.now();
  let enviados = 0, avisosOperador = 0, erros = 0;

  for (const chatId of Object.keys(sessions)) {
    const s = sessions[chatId];
    try {
      if (!s || !PASSOS_QUESTIONARIO.has(s.step)) continue;
      if (!s.ultimaInteracao) continue;

      const inativo = agora - s.ultimaInteracao;
      if (inativo < H2) continue;       // ainda cedo
      if (inativo > H_MAX) continue;    // velha demais — ignora

      // Se o cliente avançou de pergunta desde o último lembrete, reinicia o ciclo
      if (s.lembreteOrcStep !== s.step) {
        s.lembreteOrcStep = s.step;
        s.lembreteOrcEstagio = 0;
      }
      const estagio = s.lembreteOrcEstagio || 0;

      let devido = 0;
      if (inativo >= H2)   devido = 1;
      if (inativo >= H24)  devido = 2;
      if (inativo >= H72)  devido = 3;
      if (inativo >= H_OP) devido = 4; // avisar operador
      if (devido <= estagio) continue; // nada novo para este

      if (devido === 4) {
        // Aviso ao operador — vai independentemente da pausa especial do cliente
        await sendText(OPERADOR_TELEFONE_ID, montarMensagemOperador(chatId, s));
        s.lembreteOrcEstagio = 4;
        s.lembreteOrcamentoEnviado = true;
        avisosOperador++;
        console.log(`   🙋 Operador avisado sobre lead parado: ${chatId}`);
      } else {
        // Lembrete ao cliente — respeita a pausa especial (não envia; tenta depois)
        if (estaPausadoEspecial(chatId)) continue;
        await sendText(chatId, montarMensagem(devido, s));
        s.lembreteOrcEstagio = devido;
        s.lembreteOrcamentoEnviado = true;
        enviados++;
        console.log(`   ✅ Lembrete ${devido} enviado para ${chatId} (parou em ${s.step})`);
      }

      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      erros++;
      console.error(`   ❌ Erro no lembrete de ${chatId}: ${e.message}`);
    }
  }

  if (enviados || avisosOperador || erros) {
    console.log(`📊 Lembrete orçamento: ${enviados} enviado(s), ${avisosOperador} aviso(s) operador, ${erros} erro(s).`);
  }
  console.log("⏰ ===== FIM DO LEMBRETE DE ORÇAMENTO =====\n");
}

// ======================================================
// SCHEDULER — a cada 30 min, das 7h às 20h (Brasília)
// (mesma janela do follow-up de leads; a guarda dentroDaJanela() garante
//  que nada saia 20h–7h mesmo nos minutos finais do ciclo das 20h.)
// ======================================================
function inicializarLembreteOrcamento() {
  cron.schedule("*/30 7-20 * * *", () => {
    executarLembreteOrcamento();
  }, { timezone: TIMEZONE });

  console.log("⏰ Lembrete de orçamento abandonado agendado (a cada 30 min, 7h–20h).");
}

module.exports = { inicializarLembreteOrcamento, executarLembreteOrcamento };
