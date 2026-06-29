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
// ESPAÇAMENTO MÍNIMO (GAP_MIN ~20h): nunca manda dois lembretes colados. Se o
// de 2h "vence" de madrugada e só sai às 7h, o de 24h NÃO sai poucas horas
// depois — espera ~1 dia (na prática o de 24h vira ~48h); o de 72h segue normal.
//
// CORTE POR DATA DO EVENTO (se o cliente já informou a data): a última msg sai
// até ~2 dias antes do evento. A <=3 dias, a última chamada é antecipada; a <=2
// dias, para de incomodar o cliente e avisa o operador; evento já passado encerra.
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
const DIA    = 24 * 60 * 60 * 1000;
const H2     = 2  * 60 * 60 * 1000;
const H24    = 24 * 60 * 60 * 1000;
const H72    = 72 * 60 * 60 * 1000;
const H_OP   = 96 * 60 * 60 * 1000; // 72h + 24h de tolerância → avisa operador
const H_MAX  = 7  * DIA; // > 7 dias parado = ignora (sessão velha)

// Espaçamento mínimo ENTRE lembretes enviados ao mesmo cliente. Sem isso, se
// o lembrete de 2h "vence" de madrugada e só sai às 7h, o de 24h (medido desde
// a última msg do cliente) vence poucas horas depois e os dois saem colados —
// parece chato. Com este intervalo, o 2º só sai ~1 dia após o 1º (na prática,
// o de 2h vira "manhã seguinte" e o de 24h vira ~48h). O de 72h segue no 72h.
const GAP_MIN = 20 * 60 * 60 * 1000; // ~20h entre um lembrete e o próximo

// Corte por proximidade do evento: a ÚLTIMA mensagem deve sair até 2 dias antes
// do evento — depois disso o cliente (e a gente) precisa de tempo para organizar.
// Se faltam <= 3 dias e ainda não enviamos a última chamada, antecipamos ela;
// dentro de 2 dias do evento, paramos com o cliente e avisamos o operador.
const CORTE_DIAS_ANTES   = 2; // não enviar lembrete ao cliente nos 2 dias finais
const ANTECIPA_DIAS_ANTES = 3; // a <=3 dias do evento, dispara a última chamada já

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
  "orcamento_onde_encontrou", "orcamento_detalhes", "orcamento_detalhes_texto",
  // Etapas opcionais finais (e-mail/nascimento): o orçamento só é ENTREGUE depois
  // delas, então quem para aqui também abandona o orçamento (caso Rayane 2026-06-26).
  "coletar_email_opcional", "coletar_nascimento_opcional",
  // Reta final: revisar os dados (confirmar) e ESCOLHER OS SERVIÇOS. O orçamento
  // só sai DEPOIS de escolher o serviço, então quem para aqui também abandonou
  // sem receber nada (caso real 28/06). OBS: orcamento_escolher_servico é
  // reaproveitado no "deseja mais serviços?" — nesse caso o cliente JÁ recebeu um
  // orçamento; a guarda em executar...() ignora esse reuso (não é abandono).
  "orcamento_confirmar", "orcamento_escolher_servico"
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
  "orcamento_detalhes_texto": "Pode me contar os detalhes do seu evento.",
  "coletar_email_opcional": "Falta pouco para finalizar seu orçamento! Me passa um *e-mail* para enviar o orçamento em PDF, ou responda *pular*.",
  "coletar_nascimento_opcional": "Falta pouco para finalizar seu orçamento! Sua data de nascimento (ex: 01/02/1985), ou responda *pular*.",
  "orcamento_confirmar": "Faltou só revisar os dados e confirmar pra eu enviar o orçamento. Está tudo certo?\n*1* - Sim, quero o orçamento\n*2* - Corrigir algo",
  "orcamento_escolher_servico": "Falta só escolher os serviços que deseja orçamento (para mais de um, separe por vírgula, ex: *1,3,5*):\n\n" +
    "*1* - Foto Cabine\n*2* - Totem Fotográfico\n*3* - Plataforma 360º\n*4* - Foto Paparazzi Digital\n" +
    "*5* - Foto Lembrança\n*6* - Cobertura Fotográfica\n*7* - Som Completo com DJ\n*8* - Iluminação para Pista de Dança"
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
  "orcamento_detalhes_texto": "detalhes do evento",
  "coletar_email_opcional": "e-mail (opcional, falta finalizar)",
  "coletar_nascimento_opcional": "nascimento (opcional, falta finalizar)",
  "orcamento_confirmar": "confirmar os dados", "orcamento_escolher_servico": "escolher os serviços"
};

function horaSaoPaulo() {
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", hour12: false });
  return parseInt(fmt.format(new Date()), 10);
}

function dentroDaJanela() {
  const h = horaSaoPaulo();
  return h >= 7 && h < 20; // permitido 7h–19h59; bloqueado 20h–6h59
}

// Lê a data do evento da sessão ("DD/MM/AAAA" em orcamento.data) → Date 00:00,
// ou null se não informada/!inválida. (orcamento.data é sempre o 1º dia, mesmo
// em eventos de vários dias.)
function dataEvento(s) {
  const str = s.orcamento && s.orcamento.data;
  if (!str) return null;
  const m = String(str).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function perguntaPendente(s) {
  // A pergunta CANÔNICA do passo atual tem prioridade: o campo guardado
  // (ultimaPerguntaNaoRespondida) podia ficar DESATUALIZADO e reenviar uma pergunta
  // que o cliente já respondeu (caso Rayane: parou no e-mail, lembrete mandava o salão).
  return PERGUNTA_POR_PASSO[s.step]
    || (s.ultimaPerguntaNaoRespondida && String(s.ultimaPerguntaNaoRespondida).trim())
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

function montarMensagemOperador(chatId, s, dEvento) {
  const nome       = (s.orcamento && s.orcamento.nome) || "(sem nome)";
  const celebracao = (s.orcamento && s.orcamento.celebracao) || "(não informado)";
  const passo      = DESCRICAO_PASSO[s.step] || s.step;

  let linhaData = "", motivo;
  if (dEvento) {
    const dataStr = (s.orcamento && s.orcamento.data) || "";
    const hojeZero = new Date(); hojeZero.setHours(0, 0, 0, 0);
    const faltam = Math.round((dEvento.getTime() - hojeZero.getTime()) / DIA);
    linhaData = `Data do evento: ${dataStr}${faltam >= 0 ? ` (faltam ${faltam} dia(s))` : ""}\n`;
    motivo = `O evento está se aproximando e o cliente não finalizou o orçamento. ` +
             `Vale um contato manual enquanto ainda dá tempo de organizar. 🙏`;
  } else {
    motivo = `O cliente não respondeu aos 3 lembretes automáticos do orçamento. ` +
             `Vale um contato manual. 🙏`;
  }

  return (
    `🙋 *Lead de orçamento parado*\n` +
    `${chatId}\n` +
    `Nome: ${nome}\n` +
    `Evento: ${celebracao}\n` +
    linhaData +
    `Parou em: ${passo}\n\n` +
    motivo
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
  let idxEnvio = 0; // p/ o intervalo anti-bloqueio entre envios do mesmo ciclo

  for (const chatId of Object.keys(sessions)) {
    const s = sessions[chatId];
    try {
      if (!s || !PASSOS_QUESTIONARIO.has(s.step)) continue;
      if (!s.ultimaInteracao) continue;

      // O passo "escolher serviço" é reaproveitado no "deseja mais serviços?":
      // se o cliente JÁ recebeu algum orçamento, não é abandono — não incomoda.
      if (s.step === "orcamento_escolher_servico"
          && s.orcamento && Array.isArray(s.orcamento.servicosEnviados)
          && s.orcamento.servicosEnviados.length > 0) continue;

      const inativo = agora - s.ultimaInteracao;
      if (inativo < H2) continue;       // ainda cedo
      if (inativo > H_MAX) continue;    // velha demais — ignora

      // Se o cliente avançou de pergunta desde o último lembrete, reinicia o ciclo
      if (s.lembreteOrcStep !== s.step) {
        s.lembreteOrcStep = s.step;
        s.lembreteOrcEstagio = 0;
        s.lembreteOrcUltimoEnvio = 0;
      }
      const estagio      = s.lembreteOrcEstagio || 0;
      const ultimoEnvio  = s.lembreteOrcUltimoEnvio || 0;
      const dEvento      = dataEvento(s);

      // Evento já passou → encerra silenciosamente (não incomoda ninguém)
      if (dEvento) {
        const hojeZero = new Date(); hojeZero.setHours(0, 0, 0, 0);
        if (dEvento < hojeZero) { s.lembreteOrcEstagio = 4; continue; }
      }

      // Decide a AÇÃO deste ciclo: 'operador' | 'cliente' | null (nada agora)
      let acao = null, devido = 0;
      const naFaixaCorte = dEvento && (agora >= dEvento.getTime() - CORTE_DIAS_ANTES * DIA);

      if (naFaixaCorte) {
        // Faltam <= 2 dias p/ o evento: não incomoda mais o cliente; chama o
        // operador (1x) p/ um contato manual enquanto ainda dá tempo de organizar.
        if (estagio < 4) acao = 'operador';
      } else {
        // Limiares normais de inatividade (medidos desde a última msg do cliente)
        if (inativo >= H2)   devido = 1;
        if (inativo >= H24)  devido = 2;
        if (inativo >= H72)  devido = 3;
        if (inativo >= H_OP) devido = 4; // avisar operador

        // Se faltam <= 3 dias p/ o evento, antecipa a ÚLTIMA chamada (não dá
        // pra esperar o 72h chegar): garante que a última msg saia antes do corte.
        let forcaUltima = false;
        if (dEvento && agora >= dEvento.getTime() - ANTECIPA_DIAS_ANTES * DIA && estagio < 3) {
          devido = 3; forcaUltima = true;
        }

        if (devido > estagio) {
          if (devido === 4) {
            acao = 'operador';
          } else if (forcaUltima || !ultimoEnvio || (agora - ultimoEnvio) >= GAP_MIN) {
            // Respeita o espaçamento mínimo entre lembretes (exceto última chamada
            // forçada) e a pausa especial do cliente.
            if (!estaPausadoEspecial(chatId)) acao = 'cliente';
          }
        }
      }

      if (!acao) continue; // nada a enviar para este neste ciclo

      if (acao === 'operador') {
        // Aviso ao operador — vai independentemente da pausa especial do cliente
        await sendText(OPERADOR_TELEFONE_ID, montarMensagemOperador(chatId, s, dEvento));
        s.lembreteOrcEstagio = 4;
        s.lembreteOrcamentoEnviado = true;
        avisosOperador++;
        console.log(`   🙋 Operador avisado sobre lead parado: ${chatId}`);
      } else {
        await sendText(chatId, montarMensagem(devido, s));
        s.lembreteOrcEstagio = devido;
        s.lembreteOrcUltimoEnvio = agora;
        s.lembreteOrcamentoEnviado = true;
        enviados++;
        console.log(`   ✅ Lembrete ${devido} enviado para ${chatId} (parou em ${s.step})`);
      }

      // Intervalo anti-bloqueio da Meta: o 1º envio do ciclo sai em ~3s e,
      // a partir do 2º, varia aleatoriamente entre 5 e 15s — assim a Meta
      // entende como envio humano e não restringe o número.
      idxEnvio++;
      const espera = idxEnvio <= 1 ? 3000 : 5000 + Math.floor(Math.random() * 10001);
      await new Promise(r => setTimeout(r, espera));
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
