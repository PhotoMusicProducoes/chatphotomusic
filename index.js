// index.js — Raiz do projeto Chatbot PhotoMusic (Z-API)
// VERSÃO CORRIGIDA — 22/02/2026

// ======================================================
// IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
// ======================================================
const { fluxoEventos, apresentarEvento } = require("./services/eventos.js");
// ⛪ A bancada da paróquia foi APOSENTADA em 24/07/2026: o sistema virou app
// próprio da Rapha Lumen (`paroquia-pro`, gru). Os arquivos services/paroquia*.js
// e a rota /psj continuam aqui só como histórico e não são mais usados.
const { INSTANCE_ID, TOKEN, API_URL, PM_API_BASE, PM_API_KEY } = require("./utils/config.js");
const axios = require("axios");

const {
  sendText,
  sendOptionList,
  sendButtonList,
  sendTyping,
  sendFileByUrl,
  enviarPdfComLink,
  estaPausadoEspecial,
  pausarEspecial,
  retomarEspecial,
  listarPausadosEspeciais,
  inicializarPausaEspecial,
  ativarModoSombra, desativarModoSombra, estaEmModoSombra,
  ativarModoSilencioso, desativarModoSilencioso
} = require("./utils/index.js");
const { estaPausado, pausarCliente, retomarCliente, obterPausados } = require("./utils/pauseControl.js");

const { sessions } = require("./utils/sessions");
const { resetSession } = require("./utils/resetSession");

const {
  enviarFotoCabine,
  enviarTotemFotografico,
  enviarTotemRetro,
  enviarPlataforma360,
  enviarFotoPaparazzi,
  enviarFotoLembranca,
  enviarFotografia,
  enviarSomDJ,
  enviarIluminacao,
  enviarAvaliacaoEmpresa,
  enviarOrcamentoGerado,
  usaOrcamentoGerado,
  enviarEucaristiaManual,
  paroquiasEucaristia,
  EUCARISTIA_PDF_URL,
  EUCARISTIA_FORM_URL,
  EUCARISTIA_PIX_URL,
  EUCARISTIA_CARTAO_URL,
  handleComandoTarefas,
  handleComandoOk,
} = require("./services/index.js");

const {
  capitalizarPalavras,
  normalizarHorario,
  normalizarIntervaloHorario,
  calcularDuracaoEvento
} = require("./services/fluxoOrcamento");

// Atalho da foto por código (QR da cabine Lumen Capture)
const { tratarCodigoFoto, temCodigoFoto } = require("./services/fotoCodigo");

// Ao reiniciar, resetar apenas flags de estado transitório que não fazem
// sentido após um restart (ex: enviandoOrcamentos travado em true).
Object.keys(sessions).forEach(chatId => {
  if (sessions[chatId]?.enviandoOrcamentos) {
    sessions[chatId].enviandoOrcamentos = false;
  }
});
console.log(`✅ Servidor iniciado. ${Object.keys(sessions).length} sessão(ões) restaurada(s) do disco.`);

// ======================================================
// CONTROLE DE MENSAGENS DUPLICADAS
// ======================================================
const mensagensProcessadas = new Set();

// ======================================================
// NORMALIZAÇÃO DE NÚMEROS
// ======================================================
// DDD assumido quando vem SÓ o número local (sem DDD). Só afeta 8/9 dígitos.
const DDD_PADRAO = "21";

// Formatos brasileiros aceitos pelo WhatsApp (FIXO vale para TODOS os estados):
//   Celular completo : 55 + DDD(2) + 9 + 8 dígitos = 13
//   FIXO completo    : 55 + DDD(2) +     8 dígitos = 12
//   Celular sem DDI  :      DDD(2) + 9 + 8 dígitos = 11  (3º dígito = '9')
//   FIXO sem DDI     :      DDD(2) +     8 dígitos = 10  (qualquer DDD)
//   Celular local    :               9 + 8 dígitos = 9
//   FIXO local       :                   8 dígitos = 8   (NÃO leva o 9)
// IMPORTANTE: manter esta função IDÊNTICA à de utils/pausaEspecialControl.js —
// a pausa do operador compara string exata, então qualquer divergência entre as
// duas faz o número pausado nunca bater com o que chega do WhatsApp.
function normalizarNumero(numero) {
  if (!numero) return null;

  numero = String(numero); // garante string mesmo se vier número/objeto
  numero = numero.replace("@c.us", "");
  numero = numero.replace(/\D+/g, ""); // remove +, espaços, hífen, parênteses etc.
  numero = numero.replace(/^0+/, "");
  if (!numero) return null;

  // Já vem com DDI 55: 13 = celular, 12 = FIXO. Ambos válidos como estão.
  if (numero.startsWith("55") && (numero.length === 12 || numero.length === 13))
    return numero;

  if (numero.length === 13 && !numero.startsWith("55"))
    return "55" + numero;

  // 11 dígitos: celular brasileiro tem o 3º dígito (índice 2) = '9'
  // (DDD 2 dígitos + dígito 9 + 8 dígitos do número)
  // Se o 3º dígito NÃO for '9', provavelmente é número internacional sem prefixo +
  // Exemplo EUA: +1 (561) 710-1530 → 15617101530 → 3º dígito = '6' → não adiciona 55
  if (numero.length === 11) {
    if (numero[2] === '9') return "55" + numero; // celular BR confirmado
    return numero; // internacional — retorna como veio, sem adicionar 55
  }

  // 10 dígitos = DDD + FIXO de 8 dígitos, de QUALQUER estado (11 SP, 21 RJ, 31 MG...)
  if (numero.length === 10)
    return "55" + numero;

  // Só o número local, sem DDD → assume o DDD padrão.
  if (numero.length === 9 && numero.startsWith("9"))
    return "55" + DDD_PADRAO + numero;   // celular local

  // FIXO local: 8 dígitos. NÃO acrescentar o "9" (isso criava um celular
  // inexistente, ex.: 4851-8562 virava 5521948518562 e a pausa nunca batia).
  if (numero.length === 8) {
    console.log(`ℹ️ Número com 8 dígitos (fixo local) sem DDD — assumindo DDD ${DDD_PADRAO}: ${numero}. Prefira informar com DDD.`);
    return "55" + DDD_PADRAO + numero;
  }

  return numero;
}

// ======================================================
// ANTI-LOOP — evita ping-pong infinito com OUTRO chatbot
// Caso real (20/07/2026): o bot da PhotoMusic ficou trocando mensagens
// automáticas com o chatbot da Águas do Rio. Duas regras independentes:
//   1) a MESMA mensagem repetida N vezes  → é robô repetindo o menu;
//   2) volume alto num intervalo curto    → é robô mesmo variando o texto.
// Ao disparar: pausa o número (pausa de operador, reversível com "retomar")
// e avisa o operador UMA vez. Falso positivo é recuperável em 1 comando.
// ======================================================
// ⚠️ NÃO usar contagem de VOLUME aqui. A primeira versão pausava quem mandasse
// 10 msgs em 3 min e isso derrubou CLIENTE REAL: o fluxo de orçamento faz ~12
// perguntas seguidas, e um cliente atento responde tudo em poucos minutos —
// o bot emudecia no meio do atendimento (caso Francine, 20/07/2026).
// Só a repetição da MESMA mensagem identifica robô com segurança.
const LOOP_JANELA_MS  = 3 * 60 * 1000; // janela de observação: 3 minutos
const LOOP_MAX_IGUAIS = 5;             // mesma mensagem repetida seguidas
const antiLoop = new Map();            // chatId -> { inicio, total, ultima, iguais }

function registrarMensagemAntiLoop(chatId, texto) {
  const agora = Date.now();
  const txt = String(texto || "").trim().toLowerCase();
  let e = antiLoop.get(chatId);
  if (!e || agora - e.inicio > LOOP_JANELA_MS) {
    e = { inicio: agora, total: 0, ultima: null, iguais: 0 };
  }
  e.total++;
  if (txt && txt === e.ultima) e.iguais++;
  else { e.iguais = 1; e.ultima = txt; }
  antiLoop.set(chatId, e);

  if (txt && e.iguais >= LOOP_MAX_IGUAIS) {
    return { bloquear: true, motivo: `mesma mensagem ${e.iguais}x seguidas` };
  }
  return { bloquear: false };
}

// Limpa entradas velhas para o Map não crescer indefinidamente
setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of antiLoop) {
    if (agora - v.inicio > LOOP_JANELA_MS) antiLoop.delete(k);
  }
}, 10 * 60 * 1000);

// ======================================================
// CAPTURA DE CLIENTE — COMEMORAÇÕES
// ======================================================

/**
 * Normaliza uma string de data de nascimento digitada pelo cliente
 * (formatos aceitos pelo bot: DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD.MM.YYYY, etc.)
 * e retorna { dia, mes, ano } com tipos numéricos prontos para o banco.
 *
 * Ano com 2 dígitos:
 *   - > ano atual (2 dígitos) → século XX  (ex: "90" → 1990)
 *   - ≤ ano atual (2 dígitos) → século XXI (ex: "05" → 2005)
 *
 * Retorna null se a data for inválida ou não puder ser parseada.
 */
function normalizarDataNascimento(str) {
  if (!str) return null;

  const texto = String(str).trim();
  const partes = texto.split(/[\/\-\.]/);
  if (partes.length < 2) return null;

  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  if (!dia || !mes || dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  let ano = null;
  if (partes[2]) {
    const anoRaw = parseInt(partes[2], 10);
    if (!isNaN(anoRaw)) {
      if (partes[2].length <= 2) {
        // 2 dígitos → determina século pelo ano atual
        const anoAtual2d = new Date().getFullYear() % 100; // ex: 26
        ano = anoRaw > anoAtual2d ? 1900 + anoRaw : 2000 + anoRaw;
      } else {
        ano = anoRaw;
      }
      // Sanidade: ano de nascimento fora do intervalo razoável → descarta
      const anoCorrente = new Date().getFullYear();
      if (ano < 1900 || ano > anoCorrente) ano = null;
    }
  }

  return { dia, mes, ano };
}

/**
 * Registra o cliente (coletado no fluxo de orçamento) em pm_leads via REST
 * do PhotoMusic Pro, com TODOS os dados do orçamento (Fase 3 do funil):
 * celebração, data, convidados, horários, local, serviços, links dos PDFs,
 * deslocamento, onde encontrou e detalhes — usados no marketing e follow-up.
 * Se tiver data de nascimento válida, sincroniza com pm_comemoracao_contatos.
 * Fire-and-forget: não bloqueia o fluxo do bot.
 */
async function capturarClienteOrcamento(chatId, session) {
  try {
    const orc = session.orcamento;
    // Captura sempre que houver um orçamento em andamento (telefone é a chave)
    if (!orc || (!orc.nome && !orc.celebracaoId)) return;

    const tel = normalizarNumero(chatId);
    if (!tel) return;

    // Analisa a data de nascimento somente se foi informada
    let dia = null, mes = null, ano = null;
    if (orc.dataNascimento) {
      const data = normalizarDataNascimento(orc.dataNascimento);
      if (!data) {
        console.warn(`⚠️ capturarClienteOrcamento: data inválida "${orc.dataNascimento}"`);
      } else {
        dia = data.dia;
        mes = data.mes;
        ano = data.ano; // null se não foi possível determinar
      }
    }

    const servicosMapLead = {
      1: "Foto Cabine",
      2: "Totem Fotográfico",
      3: "Plataforma 360",
      4: "Foto Paparazzi Digital",
      5: "Foto Lembrança",
      6: "Cobertura Fotográfica",
      7: "Som Completo com DJ",
      8: "Iluminação para Pista de Dança",
      13: "Totem Retrô"
    };
    const servicosIds   = orc.servicosEnviados || [];
    const servicosNomes = servicosIds.map(id => servicosMapLead[id]).filter(Boolean);

    const payload = {
      telefone:       tel,
      nome:           orc.nome       || "",
      // Corporativo: vai para a coluna `empresa` de pm_leads e de pm_orcamentos,
      // e é ela que nomeia o arquivo da proposta.
      empresa:        orc.empresa    || "",
      email:          orc.email      || "",
      dia,
      mes,
      ano,
      dataEvento:     orc.data       || "",
      tipoCelebracao: orc.celebracao || "",
      convidados:     orc.convidados || null,
      horas:          orc.horas      || null,
      horaInicio:     orc.horaInicio || "",
      horaFim:        orc.horaFim    || "",
      dias:           orc.dias       || 1,
      bairro:         orc.bairro     || "",
      cidade:         orc.cidade     || "",
      salao:          orc.salao      || "",
      localEvento:    orc.local      || "",
      ondeEncontrou:  orc.ondeEncontrou || "",
      detalhes:       orc.detalhes   || "",
      deslocamentoValor:  orc.deslocamento ? Number(orc.deslocamento.valor) : null,
      deslocamentoGratis: orc.deslocamento ? !!orc.deslocamento.gratis : false,
      servicos:       servicosNomes,
      servicosIds:    servicosIds,
      linksOrcamento: orc.linksOrcamento || {},
    };

    const resp = await axios.post(
      `${PM_API_BASE}/lead-capturar`,
      payload,
      { headers: { "X-PM-Api-Key": PM_API_KEY }, timeout: 6000 }
    );

    const status = resp.data?.status;
    if (status === "salvo" || status === "atualizado") {
      const comemFlag = resp.data?.comem === "sincronizado" ? " 🎂" : "";
      console.log(`📋 Lead ${status} para ${tel} (id: ${resp.data.id})${comemFlag}`);
    }
  } catch (e) {
    console.warn(`⚠️ capturarClienteOrcamento: ${e.message}`);
  }
}

/**
 * Etapa 2 — Auto-pausa do fluxo após erros repetidos (depois do resumo).
 * O bot envia UMA mensagem de transição, pausa o fluxo (fica mudo daqui
 * em diante) e chama o operador. As mensagens do Sistema PhotoMusic Pro
 * (follow-up, comemorações, etc) continuam chegando normalmente.
 */
async function autoPausarFluxo(chatId, session, motivo) {
  session.stepAnterior = session.step; // guarda onde travou (p/ o operador retomar)
  session.step = "pausado_fluxo";
  await sendTyping(chatId);
  await sendText(
    chatId,
    "Vou chamar nossa equipe para te ajudar com isso 😊\n" +
    "Em instantes alguém fala com você por aqui."
  );
  try {
    await sendText(
      OPERADOR_TELEFONE_ID,
      `🙋 *Atendimento necessário*\n` +
      `${chatId}\n` +
      `O cliente não conseguiu seguir no fluxo (${motivo}).\n` +
      `O bot pausou — *assuma o atendimento* por aqui.`
    );
  } catch (e) { console.warn(`⚠️ aviso operador auto-pausa: ${e.message}`); }
}

// ======================================================
// CONFIRMAÇÃO FINAL DO ORÇAMENTO (revisão antes de gerar)
// Reduz erro de digitação: o cliente confere e corrige os
// campos que quiser (estilo "escolher serviços") antes do
// orçamento sair. Garante resumo correto p/ e-mail e PhotoMusic Pro.
// ======================================================
// Celebrações — fonte única (2026-07-15). Antes a lista estava escrita à mão
// em 2 lugares (fluxo normal e menu de correção), com rótulos diferentes.
const CELEBRACOES = [
  { id: 1, label: "Aniversário de 15 anos"    },
  { id: 2, label: "Casamento"                 },
  { id: 3, label: "Aniversário Infantil"      },
  { id: 4, label: "Aniversário Adolescente"   },
  { id: 5, label: "Aniversário Adulto"        },
  { id: 6, label: "Bodas"                     },
  { id: 7, label: "Formatura"                 },
  { id: 8, label: "Evento Corporativo"        },
  { id: 9, label: "Outros"                    }
];

// ✂️ 2026-07-15: de 12 para 10 campos, para caber numa LISTA clicável do
// WhatsApp (limite 10) e o cliente parar de digitar número aqui — era este o
// menu do bug dos 2 dígitos (10/11/12 liam dígito solto, ver o fix do
// extrairNumerosCampos).
// Saíram "Onde nos encontrou" (pergunta nossa, de marketing — o cliente não
// precisa corrigir) e "Data de nascimento" (é p/ mensagem de aniversário, não
// muda o orçamento). Nenhum dos dois afeta preço ou entrega.
const CAMPOS_CORRIGIVEIS = [
  { id: 1,  label: "Celebração",         tipo: "celebracao" },
  { id: 2,  label: "Convidados",         tipo: "numero"     },
  { id: 3,  label: "Data do evento",     tipo: "data"       },
  { id: 4,  label: "Horário de início",  tipo: "hora_ini"   },
  { id: 5,  label: "Horário de término", tipo: "hora_fim"   },
  { id: 6,  label: "Bairro",             tipo: "bairro"     },
  { id: 7,  label: "Cidade",             tipo: "cidade"     },
  { id: 8,  label: "Salão / Local",      tipo: "salao"      },
  { id: 9,  label: "Detalhes do evento", tipo: "detalhes"   },
  { id: 10, label: "E-mail",             tipo: "email"      },
];

function valorCampoResumo(orc, tipo) {
  switch (tipo) {
    // Mesmo helper dos resumos: em "Outros" mostra a descrição que ele digitou,
    // senão a tela de confirmação também dizia só "Outros".
    case "celebracao": return orc.celebracaoId ? textoCelebracao(orc) : (orc.celebracao || "(não informado)");
    case "numero":     return orc.convidados || "(não informado)";
    case "data":       return orc.data       || "(não informado)";
    case "hora_ini":   return orc.horaInicio || "(não informado)";
    case "hora_fim":   return orc.horaFim     || "(não informado)";
    case "bairro":     return orc.bairro      || "(não informado)";
    case "cidade":     return orc.cidade      || "(não informado)";
    case "salao":      return orc.salao       || "(não informado)";
    case "onde":       return orc.ondeEncontrou || "(não informado)";
    case "detalhes":   return orc.detalhes    || "(nenhum)";
    case "email":      return orc.email       || "(não informado)";
    case "nascimento": return orc.dataNascimento || "(não informado)";
    default: return "(não informado)";
  }
}

function textoMenuServicos() {
  // A lista sai do EXIBICAO_PARA_ID, então menu e parser nunca discordam.
  return "Agora escolha os serviços que deseja orçamento (para mais de um, digite os números separados por vírgula, ex: *0,3,5 ou 124*):\n\n" +
    linhasMenuServicos(TODOS_SERVICOS) + "\n" +
    "*9* - *TODOS os serviços*";
}

async function mostrarConfirmacaoOrcamento(chatId, session) {
  const orc = session.orcamento || {};
  let txt = "📋 *Confira os dados do seu evento:*\n\n";
  for (const c of CAMPOS_CORRIGIVEIS) {
    const v = valorCampoResumo(orc, c.tipo);
    // Não envolve em negrito quando é e-mail/link — o WhatsApp linka e o
    // *asterisco* fica solto. Demais campos vão em negrito normalmente.
    const vFmt = String(v).includes("@") ? v : `*${v}*`;
    txt += `*${c.id}* - ${c.label}: ${vFmt}\n`;

    /* Empresa logo abaixo da Celebração, SEM número próprio: a lista tem teto
       de 10 itens (limite do WhatsApp). Ela aparece para o cliente conferir o
       nome que vai no arquivo da proposta; para corrigir, ele escolhe a
       Celebração e o bot repergunta. (Mario, 19/08/2026.) */
    if (c.tipo === "celebracao" && orc.empresa) {
      txt += `     Empresa: *${orc.empresa}*\n`;
    }
  }
  // Botões (2026-07-15): é a RETA FINAL — o cliente já deu todos os dados e
  // ainda não recebeu nada. Foi aqui que o caso de 28/06 abandonou, e é a
  // fuga mais cara do funil. O sendButtonList põe o "1 - / 2 -" no corpo,
  // então quem não vê o botão digita como sempre.
  session.step = "orcamento_confirmar";
  await sendTyping(chatId);
  await sendButtonList(
    chatId,
    txt + "\nEstá tudo certo?",
    [
      { id: "1", label: "Sim, quero o orçamento" },
      { id: "2", label: "Corrigir algo" }
    ]
  );
  session.ultimaPerguntaNaoRespondida = txt + "\nEstá tudo certo?\n*1* - Sim, quero o orçamento\n*2* - Corrigir algo";
}

// Recalcula os valores derivados após uma correção (duração e deslocamento)
async function finalizarCorrecoesOrcamento(session) {
  const orc = session.orcamento;
  if (orc.horaInicio && orc.horaFim) {
    orc.duracao = calcularDuracaoEvento(orc.horaInicio, orc.horaFim);
    orc.horas   = Number.parseInt(orc.duracao, 10) || orc.horas || 4;
  }
  await consultarDeslocamento(session);
  orc.local = [orc.salao, orc.bairro, orc.cidade].filter(Boolean).join(", ");
}

// Pergunta o próximo campo da fila de correção; se acabou, recalcula e reconfirma
async function pedirProximaCorrecao(chatId, session) {
  const fila = session.correcaoFila || [];
  if (fila.length === 0) {
    await finalizarCorrecoesOrcamento(session);
    await mostrarConfirmacaoOrcamento(chatId, session);
    return;
  }
  const campo = fila[0];
  session.correcaoAtual = campo;
  session.step = "orcamento_corrigir_valor";
  const perguntas = {
    celebracao: "Qual a celebração? (*Digite o número*)\n" +
                CELEBRACOES.map(c => `*${c.id}* ${c.label}`).join(" · "),
    numero:     "Quantos convidados? (*somente número*)",
    data:       "Qual a *data* do evento? (*Ex: 20/06/2026*)",
    hora_ini:   "Qual o *horário de início*? (*Ex: 18:00 ou 18h*)",
    hora_fim:   "Qual o *horário de término*? (*Ex: 23:00 ou 23h*)",
    bairro:     "Qual o *bairro* do evento?",
    cidade:     "Qual a *cidade* do evento?",
    salao:      "Qual o nome do *salão/local*? (ou responda *pular*)",
    empresa:    "Qual o *nome da empresa*? (ou responda *pular*)",
    onde:       "Onde nos encontrou?",
    detalhes:   "Quais os *detalhes adicionais* do evento? (ou responda *pular*)",
    email:      "Qual o seu *e-mail*? (ou responda *pular*)",
    nascimento: "Qual a sua *data de nascimento*? (*Ex: 01/02/1985* ou *pular*)",
  };
  await sendTyping(chatId);
  await sendText(chatId, perguntas[campo.tipo] || "Informe o novo valor:");
}

/**
 * Consulta o valor de deslocamento (tabela pm_deslocamento) via REST do
 * PhotoMusic Pro. O endpoint corrige o bairro digitado errado (fuzzy) e
 * retorna o valor cadastrado para bairro/cidade.
 * Em caso de erro ou bairro não cadastrado, orc.deslocamento fica null e
 * o resumo usa a mensagem genérica de deslocamento.
 */
async function consultarDeslocamento(session) {
  try {
    const orc = session.orcamento;
    // Aceita só a CIDADE (caso do "#local Nova Iguaçu"): o endpoint resolve
    // por cidade mesmo com bairro vazio. Antes exigia bairro e desistia.
    if (!orc?.bairro && !orc?.cidade) return;

    const resp = await axios.get(`${PM_API_BASE}/deslocamento-consultar`, {
      params:  { bairro: orc.bairro || "", cidade: orc.cidade || "" },
      headers: { "X-PM-Api-Key": PM_API_KEY },
      timeout: 6000
    });

    // "encontrado" = valor da tabela manual (pm_deslocamento).
    // "estimado"   = cidade SEM valor cadastrado; o WP calcula por distância
    //                (Google Distance Matrix). Antes o bot descartava esse
    //                status e caía no texto genérico "não está incluso" — ou
    //                seja, a integração com o Maps existia e não era usada.
    const st = resp.data?.status;
    if (st === "encontrado" || st === "estimado") {
      // Bairro corrigido pelo fuzzy → adota o nome oficial cadastrado
      if (resp.data.corrigido && resp.data.bairro) {
        console.log(`🚗 Bairro corrigido: "${orc.bairro}" → "${resp.data.bairro}"`);
        orc.bairro = resp.data.bairro;
      }
      orc.deslocamento = {
        valor:    Number(resp.data.valor),
        gratis:   resp.data.gratis === true,
        bairro:   resp.data.bairro,
        cidade:   resp.data.cidade,
        estimado: st === "estimado",
        km:       resp.data.km != null ? Number(resp.data.km) : null
      };
      const comoFoi = orc.deslocamento.estimado
        ? `ESTIMADO por distância (${orc.deslocamento.km} km)`
        : "tabela";
      console.log(`🚗 Deslocamento: ${orc.deslocamento.gratis ? "GRÁTIS (promoção)" : "R$ " + orc.deslocamento.valor} [${comoFoi}] (${orc.deslocamento.bairro || "-"}/${orc.deslocamento.cidade || "-"})`);
    } else {
      orc.deslocamento = null;
    }
  } catch (e) {
    console.warn(`⚠️ consultarDeslocamento: ${e.message}`);
  }
}

// ======================================================
// CONTROLE DE PAUSA  (estado persistido em utils/pauseControl.js)
// ======================================================

// ======================================================
// CONFIGURAÇÃO DO OPERADOR
// ======================================================
const OPERADOR_TELEFONE_ID = "5521964428172@c.us";

// ======================================================
// CLIENTE RESPONDEU → pausa o follow-up automático no funil (PhotoMusic Pro)
// Regra do operador: qualquer resposta do cliente PAUSA o follow-up (o card
// fica "⏸️ bot pausado" e o operador reativa com 1 clique). Se a mensagem
// sinalizar intenção de contratar, o lead vai para "Negociando" e o operador
// é avisado.
// ======================================================
function clienteQuerContratar(texto) {
  let t = String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[0300-036f]/g, ""); // tira acentos
  if (!t) return false;
  // negação explícita → não é intenção ("não quero contratar", "ainda não vou fechar")
  if (/\bnao\b[^.!?]*\b(contrat|fechar)/.test(t)) return false;
  return /\bcontrat(ar|o)\b/.test(t)
      || /\b(quero|desejo|gostaria|vamos|podemos|pode|vou)\b[^.!?]*\bfechar\b/.test(t)
      || /\bfechar\b[^.!?]*\bcontrat/.test(t);
}

async function avisarLeadRespondeu(telefone, texto) {
  const querContratar = clienteQuerContratar(texto);
  try {
    const resp = await axios.post(
      `${PM_API_BASE}/lead-cliente-respondeu`,
      {
        telefone,
        contratar: querContratar,
        mensagem: String(texto || "").slice(0, 120),
      },
      { headers: { "X-PM-Api-Key": PM_API_KEY }, timeout: 6000 }
    );
    const data = resp.data || {};
    if (data.status === "negociando") {
      console.log(`🤝 Lead #${data.id} (${data.nome || "?"}) → Negociando: cliente deseja contratar.`);
    } else if (data.status === "pausado") {
      console.log(`⏸️ Lead #${data.id} (${data.nome || "?"}): follow-up pausado (cliente respondeu).`);
    }
    // Avisa o operador quando o cliente sinaliza que quer fechar.
    if (querContratar && (data.status === "negociando" || data.status === "pausado")) {
      const nome = data.nome ? `*${data.nome}*` : `o cliente ${telefone}`;
      await sendText(
        OPERADOR_TELEFONE_ID,
        `🟢 *Cliente quer CONTRATAR!*\n\n${nome} respondeu sinalizando que deseja fechar contrato.\n📱 ${telefone}\n\nO lead foi movido para *Negociando* e o follow-up automático foi pausado. Assuma a conversa. 🙌`
      );
    }
    return data;
  } catch (e) {
    console.warn(`⚠️ avisarLeadRespondeu falhou (${telefone}): ${e.message}`);
    return null;
  }
}

// Operadores autorizados a enviar comandos (além da própria linha do bot,
// reconhecida por fromMe). Funciona no privado e em grupos.
// Para adicionar/remover, edite este mapa (número → nome).
const OPERADORES = {
  // Linha do operador (a mesma de OPERADOR_TELEFONE_ID, salva como "Foto Cabine").
  // Estava SÓ como destino das confirmações e não era aceita para ENVIAR comando —
  // por isso comandos mandados dela eram ignorados, sem resposta nenhuma.
  "21964428172": "Operador PhotoMusic",
  "21967082501": "Mario Nazeanze",
  "21982192443": "Adriana Mendonça",
  "21976020039": "Adriana Mendonça",
};
const OPERADORES_AUTORIZADOS = Object.keys(OPERADORES).map(normalizarNumero);

function ehNumeroAutorizado(numero) {
  const n = normalizarNumero(numero);
  return !!n && OPERADORES_AUTORIZADOS.includes(n);
}

// Nome amigável de quem enviou o comando (para o resumo do operador)
function nomeOperador(numero) {
  const n = normalizarNumero(numero);
  if (!n) return "operador";
  for (const [k, v] of Object.entries(OPERADORES)) {
    if (normalizarNumero(k) === n) return v;
  }
  if (n === normalizarNumero(OPERADOR_TELEFONE_ID)) return "PhotoMusic (linha)";
  return n;
}

const comandosServicos = {
  "#fotocabine": 1,
  "#totemfotografico": 2,
  // 🚧 EM TESTE — Totem Retrô. Id 13 é o mesmo do PhotoMusic Pro de propósito,
  // para o link do orçamento casar com o serviço lá. Ainda fora do menu.
  "#totemretro": 13,
  "#plataforma360": 3,
  "#fotopaparazzi": 4,
  "#fotolembranca": 5,
  "#fotografia": 6,
  "#somdj": 7,
  "#iluminacao": 8
};

/**
 * Texto da celebração para os resumos.
 *
 * 🚨 "Outros" (9) é o único caso em que o bot PEDE uma descrição ("descreva o
 * que você vai celebrar") e guarda em `orcamento.celebracao`. Os resumos
 * imprimiam só `celebracoes[id]`, ou seja a palavra "Outros", e a descrição que
 * o cliente digitou não aparecia em lugar nenhum. (Mario, 18/08/2026.)
 *
 * Nas outras 8 celebrações `orcamento.celebracao` é o próprio rótulo da tabela,
 * então não há o que acrescentar.
 */
function textoCelebracao(orc) {
  const o     = orc || {};
  const id    = o.celebracaoId;
  const rotulo = celebracoes[id];
  const descr = String(o.celebracao || "").trim();

  if (!rotulo) return descr || "Não especificada";
  if (id !== 9 || descr === "" || descr.toLowerCase() === rotulo.toLowerCase()) return rotulo;

  return `${rotulo}: ${descr}`;
}

const celebracoes = {
  1: "Aniversário de 15 anos",
  2: "Casamento",
  3: "Aniversário Infantil",
  4: "Aniversário Adolescente",
  5: "Aniversário Adulto",
  6: "Bodas",
  7: "Formatura",
  8: "Evento Corporativo",
  9: "Outros"
};

// Mensagem de boas-vindas dividida em 3 bolhas para maior impacto
const mensagemBoasVindas1 =
  "*Olá! Seja bem-vindo(a) à PhotoMusic Produções!* 🎉🎊😍\n" +
  "*É um prazer falar com você!*";

// Abertura em 3 tempos (2026-07-15, pedido do Mario): primeiro QUEM somos,
// depois o COMPROMISSO, e só então a prova social. A nota do Google deixa de
// ser um anúncio solto e vira a CONSEQUÊNCIA do jeito de atender ("por isso").
// Números atualizados: 1.500+ avaliações e 15 anos (eram 1.400 e 14).
const mensagemBoasVindas2a =
  "*Somos uma família que atende famílias* ❤️";

const mensagemBoasVindas2b =
  "*Temos um compromisso com o atendimento aos nossos clientes e a cada convidado do seu evento.*";

const mensagemBoasVindas2 =
  "⭐⭐⭐⭐⭐\n" +
  "*Por isso somos a empresa de experiências fotográficas mais bem avaliada do Brasil, com mais de 1.500 avaliações 5 estrelas e 15 anos transformando eventos em memórias inesquecíveis.*";

const mensagemBoasVindas3 =
  "*Como posso te ajudar hoje?*\n\n" +
  "Por favor, escolha a opção que melhor descreve o motivo do seu contato: *(Digite somente número)*\n" +
  "*1* - Solicitar um orçamento\n" +
  "*2* - Fotografia 1ª Eucaristia\n" +
  "*3* - Estou em processo de contratação\n" +
  "*4* - Tenho um serviço contratado e preciso de suporte\n" +
  "*5* - Outros assuntos\n" +
  "*6* - Não sou cliente, mas preciso falar com você\n" +
  "*7* - Estou em um evento e desejo baixar minha foto";

// Rótulos curtos de cada opção do menu — usados na tela de confirmação
// (evita o erro de digitar a opção errada e já entrar no fluxo errado).
const LABELS_MENU = {
  "1": "Solicitar um orçamento",
  "2": "Fotografia 1ª Eucaristia",
  "3": "Estou em processo de contratação",
  "4": "Tenho um serviço contratado e preciso de suporte",
  "5": "Outros assuntos",
  "6": "Não sou cliente, mas preciso falar com você",
  "7": "Baixar minha foto do evento"
};

  // FOTOGRAFIA 1ª EUCARISTIA — dados em services/eucaristia.js

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================
function registrarServicoEnviado(session, servico) {
  if (!session.orcamento.servicosEnviados.includes(servico)) {
    session.orcamento.servicosEnviados.push(servico);
  }
}

function servicoJaEnviado(session, servico) {
  return session.orcamento.servicosEnviados.includes(servico);
}

function extrairServicosDaMensagem(texto) {
  const limpo = String(texto || "").toLowerCase();

  // "todos" / "tudo" escrito por extenso vale o mesmo que o 9. Tem cliente que
  // responde com a palavra em vez do número, e ele ficava sem nada.
  if (/\b(todos|todas|tudo)\b/.test(limpo)) return [...TODOS_SERVICOS];

  const digitos = String(texto).replace(/\D+/g, "").split("");
  const escolhidos = [...new Set(digitos)].map(n => parseInt(n, 10));

  // 9 = TODOS os serviços (pedido comum: "quero orçamento de tudo").
  // Sem essa opção o cliente precisava digitar 0,1,2,3,4,5,6,7,8.
  if (escolhidos.includes(9)) return [...TODOS_SERVICOS];

  /* Traduz o número do MENU para o id interno. O 0 é serviço de verdade agora
     (Foto Cabine), então "10" precisa continuar valendo 1 e 0, que é o que o
     split de dígitos já faz. */
  const lista = [];
  for (const exib of escolhidos) {
    const id = EXIBICAO_PARA_ID[exib];
    if (id !== undefined && !lista.includes(id)) lista.push(id);
  }
  return lista;
}

// Extrai números de itens (1..max). Aceita colado ("256" → 2,5,6, como em
// serviços) e também com separador ("10,11" → 10,11, para itens de 2 dígitos).
function extrairNumerosCampos(texto, max) {
  const t = (texto || "").trim();
  let nums;
  if (/[,;.\s]/.test(t)) {
    // Com separador: cada token é um número inteiro (suporta 10, 11, 12...)
    nums = t.split(/[,;.\s]+/).map(s => parseInt(s.replace(/\D+/g, ""), 10));
  } else {
    const limpo = t.replace(/\D+/g, "");
    const comoNumero = parseInt(limpo, 10);
    if (Number.isInteger(comoNumero) && comoNumero >= 1 && comoNumero <= max) {
      // Token único que CABE na faixa → trata como UM número (ex.: "11" = item 11,
      // não [1,1]). Corrige o menu de correção, que vai até 12.
      nums = [comoNumero];
    } else {
      // Não cabe como número único (ex.: "124" num menu 1-8) → quebra em dígitos.
      nums = limpo.split("").map(s => parseInt(s, 10));
    }
  }
  return [...new Set(nums)].filter(n => Number.isInteger(n) && n >= 1 && n <= max);
}

// Mapa de meses por extenso (chaves SEM acento; comparação também sem acento)
const MESES_PT = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9, sete: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

// ======================================================
// PARSE DE DATA FLEXÍVEL
// Aceita DD/MM (assume ano corrente), DD/MM/AA(AA) e por extenso
// ("9 de setembro", "09 setembro", "9 de setembro de 2026", "9 set").
// Retorna { dia, mes, ano, str, date } ou null se inválida.
// ======================================================
// Depois de fechar o horário de um dia (seja respondendo início e fim
// separados, seja respondendo o intervalo de uma vez), decide se pergunta o
// próximo dia ou encerra a coleta de datas.
async function avancarAposHoraFimDoDia(chatId, session) {
  const totalDias = session.orcamento.dias || 1;

  if (session.orcamento.diaAtual < totalDias) {
    session.orcamento.diaAtual++;
    session.step = "orcamento_dia_data";
    await sendTyping(chatId);
    await sendText(
      chatId,
      `📅 *Dia ${session.orcamento.diaAtual} de ${totalDias}*\n` +
      `Qual a data? *(Ex: 01/06/2026)*`
    );
    return;
  }

  // Todos os dias coletados → usar 1º dia como referência de horário
  const primeiroDia = session.orcamento.diasDetalhes[0];
  session.orcamento.data       = primeiroDia.data;
  session.orcamento.horaInicio = primeiroDia.horaInicio;
  session.orcamento.horaFim    = primeiroDia.horaFim;
  session.orcamento.duracao    = calcularDuracaoEvento(primeiroDia.horaInicio, primeiroDia.horaFim);
  session.orcamento.horas      = Number.parseInt(session.orcamento.duracao, 10) || 4;

  session.step = "orcamento_bairro";
  await enviarPerguntaESalvar(chatId, session, "Qual o *bairro* do evento?");
}

function parsearDataFlex(texto) {
  const t = (texto || "").trim();
  const m = t.match(/^(0?[1-9]|[12][0-9]|3[01])[\/.\-](0?[1-9]|1[0-2])(?:[\/.\-](\d{2}|\d{4}))?$/);

  if (!m) {
    // Tenta formato por extenso: "9 de setembro", "09 setembro de 2026", "9 set"
    const semAcento = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const mn = semAcento.match(/^(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{2}|\d{4}))?$/);
    if (!mn) return null;

    const diaN   = parseInt(mn[1], 10);
    const mesNum = MESES_PT[mn[2]];
    if (!mesNum || diaN < 1 || diaN > 31) return null;

    const dia = String(diaN).padStart(2, "0");
    const mes = String(mesNum).padStart(2, "0");
    let ano   = mn[3] || "";
    if (ano.length === 2) {
      ano = "20" + ano;
    } else if (!ano) {
      // Sem ano: usa o ano corrente; se a data já passou, assume o próximo ano
      ano = String(new Date().getFullYear());
      const tentativa = new Date(`${ano}-${mes}-${dia}`);
      const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
      if (!isNaN(tentativa.getTime()) && tentativa < hoje0) {
        ano = String(parseInt(ano, 10) + 1);
      }
    }

    const dateExt = new Date(`${ano}-${mes}-${dia}`);
    // Rejeita datas que o JS "rola" (ex.: 31 de fevereiro vira março)
    if (isNaN(dateExt.getTime()) ||
        dateExt.getUTCMonth() + 1 !== mesNum ||
        dateExt.getUTCDate() !== diaN) return null;

    return { dia, mes, ano, str: `${dia}/${mes}/${ano}`, date: dateExt };
  }

  const dia = m[1].padStart(2, "0");
  const mes = m[2].padStart(2, "0");
  let ano   = m[3] || "";
  if (!ano) ano = String(new Date().getFullYear()); // sem ano → ano corrente
  else if (ano.length === 2) ano = "20" + ano;

  const date = new Date(`${ano}-${mes}-${dia}`);
  if (isNaN(date.getTime())) return null;

  return { dia, mes, ano, str: `${dia}/${mes}/${ano}`, date };
}

// Expande um INTERVALO de datas ("30/08 a 06/09/2026") em todas as datas dia a
// dia. A data da DIREITA é sempre a mais completa; a da ESQUERDA herda o que
// faltar dela (só dia "01" herda mês+ano; "30/8" herda o ano). Devolve array de
// "DD/MM/AAAA" ou null se não for um intervalo válido.
function expandirIntervaloDatas(esq, dir) {
  const fim = parsearDataFlex(dir);
  if (!fim) return null;

  let ini = parsearDataFlex(esq);
  if (!ini) {
    const soDia = esq.trim().match(/^(\d{1,2})$/);
    const diaMes = esq.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
    if (soDia) {
      ini = parsearDataFlex(`${soDia[1]}/${fim.mes}/${fim.ano}`);       // herda mês+ano
    } else if (diaMes) {
      ini = parsearDataFlex(`${diaMes[1]}/${diaMes[2]}/${fim.ano}`);     // herda ano
    }
  }
  if (!ini) return null;

  // Datas locais (evita deslocamento de fuso ao iterar).
  const dIni = new Date(+ini.ano, +ini.mes - 1, +ini.dia);
  const dFim = new Date(+fim.ano, +fim.mes - 1, +fim.dia);
  if (dIni > dFim) return null;                       // intervalo invertido
  if ((dFim - dIni) / 86400000 > 366) return null;    // guarda contra intervalo absurdo

  const out = [];
  const cur = new Date(dIni.getTime());
  while (cur <= dFim) {
    out.push(
      String(cur.getDate()).padStart(2, "0") + "/" +
      String(cur.getMonth() + 1).padStart(2, "0") + "/" +
      String(cur.getFullYear())
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Lê as datas de um evento de vários dias. Aceita, misturado:
//   • intervalo:  "01/08/2026 a 08/08/2026", "30/8 a 6/9/26", "01 a 08/08/2026"
//   • datas soltas separadas por vírgula: "01/08/2026, 03/08/2026"
//   • mistura: "01 a 03/08/2026, 07/08/2026"
// Ordena, remove repetidas e descarta datas no passado.
function extrairDatasCorporativas(texto) {
  // Separa por VÍRGULA/; (NÃO por espaço — intervalos têm espaço e o "a").
  const segmentos = String(texto || "")
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const set = new Set();
  const itens = [];

  const addData = (str) => {
    const d = parsearDataFlex(str);
    if (!d) return;
    const dLoc = new Date(+d.ano, +d.mes - 1, +d.dia);
    if (dLoc < hoje) return;                 // não aceita passado
    if (set.has(d.str)) return;              // não duplica
    set.add(d.str);
    itens.push({ str: d.str, t: dLoc.getTime() });
  };

  for (const seg of segmentos) {
    // Intervalo? separador " a ", " à ", " até ", " ao " ou " - " (com espaços).
    const partes = seg.split(/\s+(?:a|à|ate|até|ao|-|—)\s+/i);
    if (partes.length === 2) {
      const intervalo = expandirIntervaloDatas(partes[0], partes[1]);
      if (intervalo) { intervalo.forEach(addData); continue; }
    }
    addData(seg); // data única
  }

  itens.sort((a, b) => a.t - b.t);
  return itens.map(x => x.str);
}

// ======================================================
// VALIDAÇÃO DE DATA DE NASCIMENTO
// ======================================================
function validarDataNascimento(texto) {
  const texto_limpo = texto.trim();
  const regex = /^(0[1-9]|[12][0-9]|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](\d{2}|\d{4})$/;
  
  if (!regex.test(texto_limpo)) return null;

  const sep = texto_limpo.includes("/") ? "/" : texto_limpo.includes(".") ? "." : "-";
  const [dia, mes, ano] = texto_limpo.split(sep);
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;

  const data = new Date(`${anoCompleto}-${mes}-${dia}`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Data de nascimento deve ser no passado
  if (data >= hoje) return null;

  // Não permitir menores de 13 anos
  const idade = hoje.getFullYear() - data.getFullYear();
  if (idade < 13) return null;

  return `${dia}/${mes}/${anoCompleto}`;
}

// ======================================================
// VALIDAÇÃO DE EMAIL
// ======================================================
function validarEmail(texto) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(texto.trim()) ? texto.trim() : null;
}

// ======================================================
// HELPER — INTERPRETAR SIM / NÃO (texto ou número)
// Aceita: "1", "sim", "s", "yes" → "1"
//         "2", "não", "nao", "n", "no" → "2"
// Retorna null se não reconhecer
// ======================================================
function interpretarSimNao(texto) {
  const t = String(texto || "").trim().toLowerCase()
    .normalize("NFD").replace(/[0300-036f]/g, "");
  if (["1", "sim", "s", "yes", "y"].includes(t)) return "1";
  if (["2", "nao", "n", "no", "nope", "nah"].includes(t)) return "2";
  return null;
}

// ======================================================
// FUNÇÃO — MOSTRAR MENU INICIAL
// ======================================================
// ======================================================
// ANTI-LOOP (2) — boas-vindas repetindo
// Regra do Mario: se a mensagem de BOAS-VINDAS for enviada 10x para o mesmo
// número, é outro chatbot respondendo sozinho (o nosso reabre o menu, o dele
// responde, e não para). Cliente de verdade nunca faz o menu abrir 10 vezes.
// O fluxo normal NÃO é afetado — só o reenvio do menu conta aqui.
// ======================================================
const MENU_MAX_REPETICOES = 10;
const MENU_JANELA_MS      = 15 * 60 * 1000; // 15 minutos
const menuContador        = new Map();      // chatId -> { inicio, n }

function contarMenuInicial(chatId) {
  const agora = Date.now();
  let e = menuContador.get(chatId);
  if (!e || agora - e.inicio > MENU_JANELA_MS) e = { inicio: agora, n: 0 };
  e.n++;
  menuContador.set(chatId, e);
  return e.n;
}

async function mostrarMenuInicial(chatId) {
  const vezes = contarMenuInicial(chatId);
  if (vezes >= MENU_MAX_REPETICOES) {
    pausarCliente(chatId);
    console.log(`🛑 ANTI-LOOP: menu inicial repetiu ${vezes}x para ${chatId} — número pausado`);
    try {
      await sendText(
        OPERADOR_TELEFONE_ID,
        `🛑 *Anti-loop acionado*\n\n` +
        `O menu de boas-vindas foi enviado *${vezes}x* para *${chatId}* e eu pausei o número.\n\n` +
        `Isso costuma ser outro chatbot respondendo sozinho. ` +
        `Se for cliente de verdade, libere com:\n*retomar ${chatId}*`
      );
    } catch (e) {
      console.error(`⚠️ Falha ao avisar operador do anti-loop do menu: ${e.message}`);
    }
    return; // não reenvia o menu
  }

  await sendTyping(chatId);
  // ABERTURA EM 1 MENSAGEM SÓ (2026-08-04, pedido do Mario): antes eram 4 bolhas
  // antes do menu, o que cansava o cliente. Agora é uma abertura curta com a
  // prova social (Google) já dentro do próprio menu. O texto é PROPOSITALMENTE
  // enxuto: se passar de ~600 caracteres o WhatsApp corta com "Ler mais" e
  // esconde justamente as opções do menu.
  await sendOptionList(
    chatId,
    "*Olá! Seja bem-vindo(a) à PhotoMusic Produções!*\n\n" +
      "*Somos a empresa de experiências fotográficas mais bem avaliada do Brasil*, com mais de 1.500 avaliações 5 ⭐ no Google.\n\n" +
      "*Como posso te ajudar hoje?*",
    Object.keys(LABELS_MENU).map(k => ({ id: k, title: LABELS_MENU[k] })),
    { title: "Como posso ajudar?", buttonLabel: "Ver opções" }
  );

  // ✅ Não zera a sessão inteira; só garante os campos necessários
  if (!sessions[chatId]) sessions[chatId] = {};

  sessions[chatId] = {
    ...sessions[chatId],
    step: "aguardando_opcao",
    menuInicialEnviado: true,       // ✅ NOVO
    ultimaInteracao: Date.now(),

    // garante defaults importantes sem apagar o resto
    enviouAvaliacao: sessions[chatId].enviouAvaliacao ?? false,
    enviouApresentacao: sessions[chatId].enviouApresentacao ?? false,
    primeiraRodadaFinalizada: sessions[chatId].primeiraRodadaFinalizada ?? false,
    segundaRodadaFinalizada: sessions[chatId].segundaRodadaFinalizada ?? false,
    orcamento: sessions[chatId].orcamento ?? { servicosEnviados: [] },
    servicosEnviados: sessions[chatId].servicosEnviados ?? [],
    enviandoAvaliacao: sessions[chatId].enviandoAvaliacao ?? false,
    processandoServico: sessions[chatId].processandoServico ?? false,
    enviandoOrcamentos: sessions[chatId].enviandoOrcamentos ?? false,
    lembreteOrcamentoEnviado: sessions[chatId].lembreteOrcamentoEnviado ?? false
  };
}

// ======================================================
// ROTEAMENTO DA OPÇÃO DO MENU (chamado após a confirmação)
// ======================================================
async function executarOpcaoMenu(chatId, session, opcaoMenu, chatIdNormalizado) {
  switch (opcaoMenu) {
    case "1":
      await sendTyping(chatId);
      await sendText(chatId, "Você deseja *Solicitar um Orçamento*😍.");
      session.step = "orcamento_nome";
      session.orcamento = { servicosEnviados: [] };
      session.servicosEnviados = [];
      session.lembreteOrcamentoEnviado = false;

      await sendTyping(chatId);
      await sendText(chatId, "Perfeito! Vamos começar seu orçamento.\nQual o seu nome?");
      return;

    case "2":
      await sendTyping(chatId);
      await sendText(
        chatId,
        "Parabéns pelo(a) catequisando(a) está se preparando para receber Jesus Cristo na Santíssima Eucaristia. 😍\n\n" +
        "Perfeito! Vamos começar.\nQual o nome do Responsável?"
      );
      session.step = "eucaristia_nome";
      session.eucaristia = {};
      return;

    case "3":
      await sendTyping(chatId);
      await sendText(chatId, "Você está em processo de contratação.\nComo posso ajudar?");
      pausarCliente(chatIdNormalizado);
      return;

    case "4":
      await sendTyping(chatId);
      await sendText(chatId, "Você já tem um serviço contratado.\nComo posso te ajudar?");
      pausarCliente(chatIdNormalizado);
      return;

    case "5":
      await sendTyping(chatId);
      await sendText(chatId, "Claro! Me diga qual é o assunto.");
      pausarCliente(chatIdNormalizado);
      return;

    case "6":
      await sendTyping(chatId);
      await sendText(chatId, "Sem problemas! Como posso te ajudar?");
      pausarCliente(chatIdNormalizado);
      return;

    case "7":
      await sendTyping(chatId);
      await fluxoEventos(chatId, session);
      return;
  }
}

// ======================================================
// CONTROLE DE AVALIAÇÃO E APRESENTAÇÃO
// ======================================================
async function enviarAvaliacaoSeNecessario(chatId, session) {
  if (session.enviouAvaliacao) return;

  await enviarAvaliacaoEmpresa(chatId, sessions);
  session.enviouAvaliacao = true;
}

async function enviarApresentacao(chatId) {
  const session = sessions[chatId];
  if (!session) return;

  if (session.enviandoApresentacao) {
    console.log(`⚠️ Já está enviando apresentação para ${chatId}`);
    return;
  }

  session.enviandoApresentacao = true;
  try {
    await sendTyping(chatId);
    await sendText(chatId, "📹 Aqui está nossa apresentação...");
  } finally {
    session.enviandoApresentacao = false;
  }
}

// ======================================================
// FUNÇÃO UNIFICADA PARA ENVIAR QUALQUER ORÇAMENTO
// ======================================================
async function enviarOrcamentoUnificado(
  chatId,
  servico,
  celebracaoId,
  convidados,
  horas,
  dias,
  modoManual = false
) {
  if (!sessions[chatId]) {
    sessions[chatId] = {
      servicosEnviados: [],
      orcamento: {},
    };
  }

  const session = sessions[chatId];

  if (horas !== undefined && horas !== null) {
    const horasNum = typeof horas === "number" ? horas : Number.parseInt(String(horas), 10);
    if (!Number.isNaN(horasNum)) session.orcamento.horas = horasNum;
  }

  if (!modoManual) {
    await enviarAvaliacaoSeNecessario(chatId, session);
  }

  // ⚠️ IMPORTANTE: Avaliação é enviada AUTOMATICAMENTE na primeira vez
  // Nunca permitir envio manual para evitar duplicatas
  // (Removido: if (modoManual && session.enviarAvaliacaoManual === true))

  while (session.enviandoAvaliacao) {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (session.processandoServico) {
    console.log(`⏳ Aguardando serviço anterior terminar para ${chatId}`);
    return;
  }

  session.processandoServico = true;

  try {
    switch (servico) {
      case 1:
        await enviarFotoCabine(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 2:
        await enviarTotemFotografico(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 3:
        await enviarPlataforma360(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 4:
        await enviarFotoPaparazzi(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 5:
        await enviarFotoLembranca(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 6:
        await enviarFotografia(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 7:
        await enviarSomDJ(chatId, celebracaoId, convidados, sessions, false);
        break;
      case 8:
        await enviarIluminacao(chatId, celebracaoId, convidados, sessions, false);
        break;
      // 🚧 Totem Retrô em teste, entra pelo 0 escondido e pelo #totemretro
      case 13:
        await enviarTotemRetro(chatId, celebracaoId, convidados, sessions, false);
        break;
      default:
        await sendText(chatId, "*⚠ Serviço inválido.*");
    }

  } finally {
    session.processandoServico = false;
  }

}

// ======================================================
// ENVIO DE ORÇAMENTO MANUAL (UNIFICADO E CORRIGIDO)
// ======================================================
// 📖 COMO USAR:
// 
// 1️⃣  UM ORÇAMENTO:
//     #iluminacao 0,2,120,6,1
//
// 2️⃣  MÚLTIPLOS ORÇAMENTOS (vírgula + espaço + #):
//     #fotocabine 0,2,120,6,1, #somdj 0,2,120,6,1, #iluminacao 0,2,120,6,1
//
// 3️⃣  COM CLIENTE ESPECÍFICO:
//     #fotocabine 0,2,120,6,1 -> 5521999999999
//
// 4️⃣  MÚLTIPLOS + CLIENTE:
//     #fotocabine 0,2,120,6,1, #somdj 0,2,120,6,1 -> 5521999999999
//
// 5️⃣  COM A APRESENTAÇÃO COMPLETA (fotos/vídeos):  +completo
//     #fotocabine 0,2,120,6,1 +completo -> 5521999999999
//
//     Desde 2026-07-15 o comando manda SÓ O PREÇO por padrão, igual ao fluxo
//     automático: o cliente recebe o orçamento e escolhe no menu se quer ver
//     os detalhes. Use "+completo" quando o cliente NUNCA viu o serviço e
//     você quer empurrar as fotos junto (lead frio que pediu por telefone).
//     A flag vale para o LOTE inteiro e pode ir em qualquer posição, igual
//     ao "->". Com ela, o menu não oferece "mais detalhes" do que já foi
//     mostrado.
//
// ======================================================


// ======================================================
// ENVIO DE MÚLTIPLOS ORÇAMENTOS — VERSÃO ATUALIZADA
// ======================================================
async function enviarMultiplosOrcamentos(chatId, listaServicos) {
  const session = sessions[chatId];
  if (!session) return true;

  const orc = session.orcamento || {};

  // ==============================================================
  // EVENTO MULTI-DIA (corporativo=8 ou outros=9 com dias > 1)
  // Envia apresentação completa de cada serviço (sem PDF)
  // Depois envia o resumo unificado com nota de orçamento em preparo
  // ==============================================================
  const diasTotal = orc.dias || 1;
  const clbId     = orc.celebracaoId;

  if ((clbId === 8 || clbId === 9) && diasTotal > 1) {

    // Registra serviços como "enviados" para aparecerem no resumo
    listaServicos.forEach(id => {
      if (!orc.servicosEnviados) orc.servicosEnviados = [];
      if (!orc.servicosEnviados.includes(id)) orc.servicosEnviados.push(id);
    });

    // ✅ Envia avaliação da empresa UMA VEZ (igual ao fluxo normal de 1 dia)
    while (session.enviandoAvaliacao) {
      await new Promise(r => setTimeout(r, 300));
    }
    if (!session.enviouAvaliacao) {
      console.log(`📊 [Multi-dia] Enviando avaliação para ${chatId}`);
      await enviarAvaliacaoEmpresa(chatId, sessions);
      while (session.enviandoAvaliacao) {
        await new Promise(r => setTimeout(r, 300));
      }
      session.enviouAvaliacao = true;
    }

    // Deduplicação de moldura/comocontratar igual ao fluxo normal
    const servicosComMolduraM = [1, 2, 4, 5, 13];
    const ultimoComMolduraM   = [...listaServicos].reverse()
      .find(id => servicosComMolduraM.includes(id));

    // Envia apresentação de cada serviço (apenasFluxo=true → pula PDF)
    for (const [idx, servico] of listaServicos.entries()) {
      sessions[chatId]._envioMultiplo = {
        ehUltimo:           idx === listaServicos.length - 1,
        ehUltimoComMoldura: servico === ultimoComMolduraM,
        servicosNaLista:    listaServicos,
        apenasFluxo:        true   // ← sinaliza para pular PDF em todos os serviços
      };

      await enviarOrcamentoUnificado(
        chatId,
        servico,
        orc.celebracaoId,
        orc.convidados,
        orc.horas || 4,
        diasTotal,
        true
      );

      await new Promise(r => setTimeout(r, 600));
    }

    delete sessions[chatId]._envioMultiplo;

    // Resumo unificado (inclui cronograma + nota "orçamento em preparo")
    await enviarResumoCliente(chatId, session);

    await sendTyping(chatId);
    await sendText(chatId, "Deus abençoe você e sua equipe, grandiosamente!!! 🙏✨");

    session.step = "finalizado";

    if (!orc.capturado) {
      orc.capturado = true;
      capturarClienteOrcamento(chatId, session).catch(() => {});
    }
    return;
  }

  // ==============================================================
  // FLUXO NORMAL — 1 dia ou evento não corporativo/outros
  // ==============================================================

  // Serviços com molduradasfotos.mp3 (para deduplicação)
  const servicosComMoldura = [1, 2, 4, 5, 13];
  const ultimoComMoldura   = [...listaServicos].reverse()
    .find(id => servicosComMoldura.includes(id));

  // ✅ Aguardar avaliação ser enviada (máximo 1 vez)
  while (session.enviandoAvaliacao) {
    await new Promise(r => setTimeout(r, 300));
  }

  if (session.enviandoOrcamentos) {
    console.log(`⚠️ Já está enviando orçamentos para ${chatId}`);
    return true;
  }

  session.enviandoOrcamentos = true;

  try {
    // ✅ Enviar avaliação UMA VEZ antes de todos os serviços
    if (!session.enviouAvaliacao) {
      console.log(`📊 Enviando avaliação da empresa para ${chatId}`);
      await enviarAvaliacaoEmpresa(chatId, sessions);

      // Aguardar avaliação terminar
      while (session.enviandoAvaliacao) {
        await new Promise(r => setTimeout(r, 300));
      }

      session.enviouAvaliacao = true;
    }

    // ✅ Agora enviar cada serviço (SEM avaliação novamente)
    for (const [idx, servico] of listaServicos.entries()) {

      while (session.processandoServico) {
        await new Promise(r => setTimeout(r, 300));
      }

      // Define flags de deduplicação (lidas pelos serviços via sessions[chatId]._envioMultiplo)
      // apenasOrcamento (2026-07-15, ideia da Adriana): manda SÓ o preço/PDF.
      // As fotos e vídeos viram opcionais e só vão se o cliente pedir no menu
      // pós-orçamento. Antes, ele levava ~80 mensagens antes de ver um valor.
      sessions[chatId]._envioMultiplo = {
        apenasOrcamento:   true,
        ehUltimo:          idx === listaServicos.length - 1,
        ehUltimoComMoldura: servico === ultimoComMoldura,
        servicosNaLista:   listaServicos
      };

      const celebracaoId = session.orcamento.celebracaoId;
      const convidados   = session.orcamento.convidados;
      const horas        = Number.parseInt(session.orcamento.duracao, 10) || session.orcamento.horas || 4;
      const diasServ     = session.orcamento.dias || 1;

      console.log(`📤 Enviando orçamento do serviço ${servico} para ${chatId}`);

      // ✅ IMPORTANTE: Passar modoManual=true para NÃO enviar avaliação novamente
      await enviarOrcamentoUnificado(
        chatId,
        servico,
        celebracaoId,
        convidados,
        horas,
        diasServ,
        true  // ✅ modoManual=true previne re-envio de avaliação
      );

      registrarServicoEnviado(session, servico);

      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // Limpa flags de deduplicação após todos os serviços
    delete sessions[chatId]._envioMultiplo;

    /* 🧾 UM ORÇAMENTO SÓ, com todos os serviços migrados deste pedido
       (decisão do Mario, 17/08/2026). Vem DEPOIS da apresentação de todos: cada
       serviço mostrou a foto do seu equipamento, e aqui vai o preço de tudo
       junto, com o desconto de R$ 100 por serviço a mais.
       Serviço ainda não migrado continua mandando o PDF pronto dele lá dentro.
       `segundaRodada`: se ele já tinha recebido orçamento antes, o PDF novo sai
       com TUDO e o texto avisa que substitui o anterior. */
    const _jaTinhaOrcamento = Object.keys(session.orcamento?.linksOrcamento || {}).length > 0;
    await enviarOrcamentoGerado(chatId, session, listaServicos, {
      segundaRodada: _jaTinhaOrcamento
    });

    // 📌 RESUMO FINAL DO EVENTO PARA O CLIENTE (UMA VEZ)
    await enviarResumoCliente(chatId, session);

    await sendTyping(chatId);
    await sendText(chatId, "Perfeito! Qualquer dúvida estou por aqui 😊");

    await sendTyping(chatId);
    await sendText(chatId, "Deus abençoe você e sua família, grandiosamente!!!");

    // Captura aniversário do cliente para sistema de comemorações (fire and forget)
    if (!session.orcamento?.capturado) {
      session.orcamento = session.orcamento || {};
      session.orcamento.capturado = true;
      capturarClienteOrcamento(chatId, session).catch(() => {});
    }

    // Menu dinâmico: detalhes (se houver o que detalhar), mais orçamento
    // (se houver o que orçar) e a saída. Define o step por dentro.
    await perguntarPosOrcamento(chatId, session);

    return;

  } finally {
    session.enviandoOrcamentos = false;
    // Garante limpeza das flags mesmo em caso de erro
    delete sessions[chatId]?._envioMultiplo;
  }
}

// ======================================================
// PERGUNTAR SE O CLIENTE QUER MAIS ORÇAMENTOS
// ======================================================
async function perguntarMaisOrcamentos(chatId) {
  await sendTyping(chatId);
  await sendText(
    chatId,
    "Deseja orçamento de mais algum serviço?\n\n" +
      "*1* - Sim, desejo mais orçamentos\n" +
      "*2* - Não, por enquanto é só"
  );
}

// ======================================================
// SERVIÇOS — nome por id
// ======================================================
const SERVICOS_NOMES = {
  1: "Foto Cabine",
  2: "Totem Fotográfico",
  3: "Plataforma 360º",
  4: "Foto Paparazzi Digital",
  5: "Foto Lembrança",
  6: "Cobertura Fotográfica",
  7: "Som Completo com DJ",
  8: "Iluminação para Pista de Dança",
  13: "Totem Retrô"
};

// O id 13 é o mesmo do PhotoMusic Pro de propósito, para o link do orçamento
// casar com o serviço de lá.
const SERVICO_TOTEM_RETRO = 13;

/* ======================================================
   🔢 NÚMERO QUE O CLIENTE DIGITA  x  ID INTERNO DO SERVIÇO
   (renumeração aprovada pelo Mario em 17/08/2026)
   ======================================================
   O Totem Retrô saiu do "0 escondido" e entrou no menu de verdade. Como o menu
   do WhatsApp é de UM DÍGITO e o 9 é "TODOS", os 9 serviços só cabem usando o
   ZERO: 0 a 8 são os serviços e o 9 segue sendo todos.

   🚨 A NUMERAÇÃO INTERNA NÃO MUDOU. O Retrô continua id 13 (o mesmo do
   WordPress), a Cabine continua id 1. O que muda é só o número que aparece
   para o cliente, e a tradução mora AQUI, num lugar só. Nunca imprimir id
   interno num menu: "13 - Totem Retrô" seria lido pelo parser como 1 e 3
   (Cabine + Plataforma), que é um bug que já aconteceu no endpoint do WP. */
const EXIBICAO_PARA_ID = {
  0: 1,   // Foto Cabine (carro-chefe, abre a lista)
  1: 13,  // Totem Retrô
  2: 2,   // Totem Fotográfico
  3: 3,   // Plataforma 360º
  4: 4,   // Foto Paparazzi Digital
  5: 5,   // Foto Lembrança
  6: 6,   // Cobertura Fotográfica
  7: 7,   // Som Completo com DJ
  8: 8,   // Iluminação para Pista de Dança
};
const ID_PARA_EXIBICAO = Object.fromEntries(
  Object.entries(EXIBICAO_PARA_ID).map(([exib, id]) => [id, Number(exib)])
);

/** Número que o cliente vê para um serviço (ex.: id 13 -> "1"). */
function numeroExibicao(id) {
  const n = ID_PARA_EXIBICAO[Number(id)];
  return n === undefined ? null : n;
}

/** Ordem do MENU, não a dos ids: é ela que manda em toda lista mostrada. */
const TODOS_SERVICOS = Object.keys(EXIBICAO_PARA_ID)
  .map(Number).sort((a, b) => a - b)
  .map(exib => EXIBICAO_PARA_ID[exib]);

/** Linha "*0* - Foto Cabine" para os ids dados, na ordem do menu. */
function linhasMenuServicos(ids) {
  return ids
    .filter(id => numeroExibicao(id) !== null)
    .sort((a, b) => numeroExibicao(a) - numeroExibicao(b))
    .map(id => `*${numeroExibicao(id)}* - ${SERVICOS_NOMES[id]}`)
    .join("\n");
}

// ======================================================
// MENU PÓS-ORÇAMENTO (dinâmico) — ideia da Adriana, 2026-07-15
// ======================================================
// O cliente recebe o ORÇAMENTO logo depois da prova social; os detalhes
// (fotos/vídeos) só vão se ele PEDIR. Antes, ele levava ~80 mensagens antes
// de ver um preço.
//
// O menu se monta a partir de 2 conjuntos:
//   orçados    = session.orcamento.servicosEnviados
//   detalhados = session.orcamento.servicosDetalhados
// Regra:
//   existe orçado ainda NÃO detalhado → "mais detalhes"
//   existe serviço ainda NÃO orçado   → "mais orçamento"
//   sempre                            → "por enquanto é só"
//
// Os 3 menus que o Mario desenhou são este MESMO menu em estados diferentes:
// quando tudo já foi detalhado, a 1ª opção some sozinha e sobram 2. E cabe
// em 3 botões, que é o limite do WhatsApp.
function servicosParaDetalhar(session) {
  const orcados    = session.orcamento?.servicosEnviados   || [];
  const detalhados = session.orcamento?.servicosDetalhados || [];
  return orcados.filter(s => !detalhados.includes(s));
}

// Quantos serviços o bot detalha de uma vez sem perguntar (Mario, 17/08/2026).
// Cada serviço detalhado é uma dezena de mídias + o PDF do orçamento; quem
// pediu "9 - todos" e clicou em "mais detalhes" levava uma enxurrada com cara
// de spam. Acima deste teto o bot PERGUNTA de quais serviços ele quer.
const MAX_DETALHES_DE_UMA_VEZ = 4;

// Pausa entre um serviço e o seguinte no envio em lote (o "envio pausado" que
// o Mario pediu). Bem maior que os 600ms do orçamento, porque aqui vão fotos,
// vídeos, áudios e o PDF de cada serviço.
const PAUSA_ENTRE_DETALHES_MS = 3000;

// Menu de quais serviços detalhar. Usa os MESMOS números do menu de serviços
// (1 = Foto Cabine ... 8 = Iluminação, 9 = todos), para o cliente responder
// igual ao que já respondeu ao pedir o orçamento: "134" ou "1,3,4".
function textoMenuDetalhes(disponiveis) {
  /* 🚨 NÚMERO DE EXIBIÇÃO, NUNCA O ID INTERNO. Aqui era `*${s}*` com o id, e
     com o Totem Retrô no menu isso imprimiria "13 - Totem Retrô", que o parser
     leria como 1 e 3 (Cabine + Plataforma). Mesmo bug que já aconteceu no
     endpoint do WordPress. (Mario, 17/08/2026.) */
  return `Você pediu orçamento de *${disponiveis.length} serviços*. De quais deles você quer ver os *detalhes*?\n\n` +
    "Digite os números, colados ou separados por vírgula (ex: *0,3,4* ou *034*):\n\n" +
    linhasMenuServicos(disponiveis) +
    "\n*9* - *TODOS*";
}

// Traduz a resposta do menu de detalhes na lista de serviços. Reaproveita o
// parser do orçamento (dígitos colados, vírgula, 9 = todos) e depois filtra
// pelos que ele realmente orçou e ainda não viu.
function extrairServicosDetalhe(texto, disponiveis) {
  // "todos" / "tudo" escrito por extenso vale o mesmo que o 9: tem cliente que
  // responde com a palavra em vez do número.
  const limpo = String(texto || "").toLowerCase();
  if (/\b(todos|todas|tudo)\b/.test(limpo)) return [...disponiveis];

  const escolhidos = extrairServicosDaMensagem(texto);
  return disponiveis.filter(s => escolhidos.includes(s));
}

function servicosParaOrcar(session) {
  const orcados = session.orcamento?.servicosEnviados || [];
  return TODOS_SERVICOS.filter(s => !orcados.includes(s));
}

function registrarServicoDetalhado(session, servico) {
  session.orcamento = session.orcamento || {};
  session.orcamento.servicosDetalhados = session.orcamento.servicosDetalhados || [];
  if (!session.orcamento.servicosDetalhados.includes(servico)) {
    session.orcamento.servicosDetalhados.push(servico);
  }
}

function montarMenuPosOrcamento(session) {
  const opcoes = [];
  if (servicosParaDetalhar(session).length > 0) {
    opcoes.push({ acao: "detalhes",  label: "Quero mais detalhes" });
  }
  if (servicosParaOrcar(session).length > 0) {
    opcoes.push({ acao: "orcamento", label: "Quero mais orçamento" });
  }
  opcoes.push({ acao: "fim", label: "Está ótimo, por enquanto é só" });
  return opcoes.map((o, i) => ({ ...o, id: String(i + 1) }));
}

async function perguntarPosOrcamento(chatId, session) {
  const opcoes = montarMenuPosOrcamento(session);

  // Sobrou só o "por enquanto é só": não há nada a oferecer, não pergunta.
  if (opcoes.length === 1) {
    await sendTyping(chatId);
    await sendText(chatId, "Qualquer dúvida é só me chamar 😊");
    session.step = "finalizado";
    return;
  }

  // Guarda o menu montado: a resposta ("1","2","3") é posicional, e as opções
  // mudam conforme o estado. Sem isso, não dá para traduzir o número na ação.
  session._menuPos = opcoes.map(o => ({ id: o.id, acao: o.acao, label: o.label }));
  session.step = "orcamento_pos";

  await sendTyping(chatId);
  await sendButtonList(
    chatId,
    "Posso te ajudar em mais alguma coisa?",
    opcoes.map(o => ({ id: o.id, label: o.label }))
  );
}

// Processa a escolha do menu pós-orçamento ("1 - detalhes", "2 - mais orçamento",
// "3 - por enquanto é só"). Extraído para ser reutilizável: também é chamado quando
// o cliente JÁ escolheu encerrar (step "finalizado") mas depois clica/envia 1 ou 2,
// reativando o fluxo em vez de ficar mudo (pedido do Mario 26/07).
async function processarOrcamentoPos(chatId, session, corpoMensagem) {
  const opcoes  = session._menuPos || montarMenuPosOrcamento(session);
  const escolha = opcoes.find(o => o.id === String(corpoMensagem).trim());

  if (!escolha) {
    session.tentativasInvalidasPos = (session.tentativasInvalidasPos || 0) + 1;
    if (session.tentativasInvalidasPos >= 3) {
      await autoPausarFluxo(chatId, session, "respostas inválidas no menu pós-orçamento");
      return;
    }
    await sendTyping(chatId);
    await sendButtonList(
      chatId,
      "Não entendi. Escolha uma opção:",
      opcoes.map(o => ({ id: o.id, label: o.label }))
    );
    return;
  }

  session.tentativasInvalidasPos = 0;

  if (escolha.acao === "fim") {
    await sendTyping(chatId);
    await sendText(chatId, "Perfeito! Qualquer dúvida é só me chamar 😊");
    session.step = "finalizado";
    return;
  }

  if (escolha.acao === "detalhes") {
    const paraDetalhar = servicosParaDetalhar(session);

    /* Manda os detalhes de TODOS os serviços orçados (Mario, 06/08/2026).
       Antes, com vários, o bot perguntava "de qual serviço?" e o cliente que
       pediu 3 orçamentos recebia os detalhes de 1 só — ficava com a impressão
       de que os outros não tinham detalhe nenhum. Quem pede "mais detalhes"
       quer ver o que contratou, não escolher de novo.

       ⚠️ Com MUITOS serviços (o "9 - todos" é comum) isso virava uma enxurrada
       de mídia. Acima de MAX_DETALHES_DE_UMA_VEZ o bot pergunta quais, no
       mesmo formato do menu de serviços (Mario, 17/08/2026). */
    if (paraDetalhar.length > MAX_DETALHES_DE_UMA_VEZ) {
      session.step = "orcamento_escolher_detalhe";
      await enviarPerguntaESalvar(chatId, session, textoMenuDetalhes(paraDetalhar));
      return;
    }

    await enviarDetalhesEmLote(chatId, session, paraDetalhar);
    await perguntarPosOrcamento(chatId, session);
    return;
  }

  if (escolha.acao === "orcamento") {
    const restantes = servicosParaOrcar(session);
    session.step = "orcamento_escolher_servico";
    await sendTyping(chatId);
    /* 🚨 id da lista = número de EXIBIÇÃO, nunca o id interno. Com o id
       interno, o Totem Retrô viraria "13" e o parser leria 1 e 3. */
    await sendOptionList(
      chatId,
      "De qual outro serviço você deseja orçamento?",
      restantes
        .filter(s => numeroExibicao(s) !== null)
        .sort((a, b) => numeroExibicao(a) - numeroExibicao(b))
        .map(s => ({ id: String(numeroExibicao(s)), title: SERVICOS_NOMES[s] })),
      { title: "Serviços", buttonLabel: "Ver serviços" }
    );
    return;
  }
}

// ======================================================
// E-MAIL / NASCIMENTO — perguntar ANTES de pedir (2026-07-15, pedido do Mario)
// ======================================================
// Antes o bot pedia "seu e-mail... ou responda *pular*": obrigava a digitar a
// palavra "pular" para NÃO dar o e-mail, o que é mais trabalho do que dar.
// Agora pergunta Sim/Não no botão e só pede o dado se a pessoa quiser.
// (Os dois campos são opcionais e não mudam o orçamento.)
async function perguntarEmailOpcional(chatId, session) {
  session.step = "coletar_email_opcional";
  const p = "Deseja informar seu *e-mail* para receber o orçamento em *PDF* também, caso tenha dificuldade pelo WhatsApp?";
  await sendTyping(chatId);
  await sendButtonList(chatId, p, [
    { id: "1", label: "Sim" },
    { id: "2", label: "Não" }
  ]);
  session.ultimaPerguntaNaoRespondida = p + "\n*1* - Sim\n*2* - Não";
}

async function perguntarNascimentoOpcional(chatId, session) {
  session.step = "coletar_nascimento_opcional";
  const p = "Deseja informar sua *data de nascimento*? É para te enviarmos uma mensagem no seu aniversário 🎂";
  await sendTyping(chatId);
  await sendButtonList(chatId, p, [
    { id: "1", label: "Sim" },
    { id: "2", label: "Não" }
  ]);
  session.ultimaPerguntaNaoRespondida = p + "\n*1* - Sim\n*2* - Não";
}

// Envia os detalhes de uma LISTA de serviços, um de cada vez e com respiro
// entre eles (Mario, 17/08/2026: "se for muito serviço envia pausadamente,
// para não parecer spam"). Avisa antes quando é mais de um, para o cliente
// entender que vem por partes e não achar que o bot travou no meio.
async function enviarDetalhesEmLote(chatId, session, lista) {
  /* 🚨 Com orçamento GERADO, um PDF só atende vários serviços, e o mesmo link
     fica gravado em linksOrcamento para cada id. Sem deduplicar por URL, quem
     pediu detalhes de 3 serviços recebia o MESMO arquivo 3 vezes.
     O Set é por LOTE: se ele voltar depois e pedir outro serviço, recebe de
     novo, o que é certo, porque aí é outra conversa. */
  session._pdfsEnviadosNoLote = new Set();

  if (lista.length > 1) {
    await sendTyping(chatId);
    await sendText(
      chatId,
      `Perfeito! Vou te mostrar os detalhes de *${lista.length} serviços*, ` +
      "um de cada vez, com o orçamento de cada um no fim 😊"
    );
  }

  for (const [idx, servico] of lista.entries()) {
    // Operador assumiu a conversa no meio do lote: para na hora, senão o
    // cliente segue recebendo mídia automática por cima da conversa humana.
    if (estaPausado(chatId) || session.pausado) return;

    await enviarDetalhesServico(chatId, session, servico);
    if (idx < lista.length - 1) {
      await new Promise(r => setTimeout(r, PAUSA_ENTRE_DETALHES_MS));
    }
  }
}

// Reenvia o PDF do orçamento do serviço logo depois dos detalhes dele
// (Mario, 17/08/2026). Antes o cliente lia os detalhes e tinha que ROLAR a
// conversa para trás para achar o preço; ele desistia de procurar e voltava a
// perguntar valor por mensagem. O link fica guardado em
// `orcamento.linksOrcamento[id]` pelo enviarPdfComLink do primeiro envio.
async function reenviarOrcamentoDoServico(chatId, session, servico) {
  const link = session.orcamento?.linksOrcamento?.[servico];
  // Multi-dia e corporativo não geram PDF na hora (o orçamento vai depois,
  // montado pela equipe): sem link, não há o que reenviar.
  if (!link) return;
  if (estaPausado(chatId) || session.pausado) return;

  // Mesmo PDF já reenviado neste lote (orçamento único de vários serviços).
  if (session._pdfsEnviadosNoLote?.has(link)) {
    console.log(`↩️ [detalhes] PDF já reenviado neste lote, pulando: ${link}`);
    return;
  }
  session._pdfsEnviadosNoLote?.add(link);

  const nome = SERVICOS_NOMES[servico] || "serviço";
  try {
    await sendTyping(chatId);
    await sendText(
      chatId,
      `💰 E aqui está de novo o *orçamento da ${nome}*, para você não precisar voltar na conversa 😊`
    );
    await enviarPdfComLink(
      chatId,
      link,
      `Orcamento-${nome.replace(/[^A-Za-z0-9]+/g, "-")}`,
      sendTyping,
      sendText,
      sendFileByUrl
    );
  } catch (e) {
    // Falha no reenvio não pode derrubar o lote de detalhes.
    console.error(`⚠️ Reenvio do orçamento (${nome}):`, e.message);
  }
}

// Envia SÓ os detalhes (fotos/vídeos) de um serviço — sem repetir o preço.
async function enviarDetalhesServico(chatId, session, servico) {
  sessions[chatId]._envioMultiplo = {
    apenasFluxo:        true,   // manda a apresentação, pula o PDF
    ehUltimo:           true,
    ehUltimoComMoldura: true,
    servicosNaLista:    [servico]
  };
  try {
    const celebracaoId = session.orcamento.celebracaoId;
    const convidados   = session.orcamento.convidados;
    const horas        = Number.parseInt(session.orcamento.duracao, 10) || session.orcamento.horas || 4;
    const diasServ     = session.orcamento.dias || 1;

    await enviarOrcamentoUnificado(chatId, servico, celebracaoId, convidados, horas, diasServ, true);
    registrarServicoDetalhado(session, servico);
  } finally {
    delete sessions[chatId]?._envioMultiplo;
  }

  // O PDF vai DEPOIS dos detalhes, fechando o serviço: é a última coisa que
  // ele vê antes do próximo, e é onde está o preço.
  await reenviarOrcamentoDoServico(chatId, session, servico);
}


// ======================================================
// HELPER — SALVAR ÚLTIMA PERGUNTA NÃO RESPONDIDA
// ======================================================
async function enviarPerguntaESalvar(chatId, session, pergunta) {
  await sendTyping(chatId);
  await sendText(chatId, pergunta);
  session.ultimaPerguntaNaoRespondida = pergunta; // 📌 Guardar pergunta
}



// ======================================================
// HANDLE INCOMING MESSAGE — VERSÃO FINAL CORRIGIDA + #cliente
// ======================================================
async function handleIncomingMessage(message) {
  console.log("🔔 Nova mensagem recebida (raw):", JSON.stringify(message, null, 2));

  // ✅ Extrair messageId para uso no deduplicador (ainda não adicionar ao set)
  const messageId = message.messageId || message.id;

  // 🚨 VERIFICAR DUPLICATA — apenas leitura aqui, sem adicionar ao set ainda
  // (Adicionar ao set só depois de validar chatId, para evitar que eventos
  //  sem "phone" da Z-API bloqueiem a mensagem real com o mesmo messageId)
  if (messageId && mensagensProcessadas.has(messageId)) {
    console.log(`⏭ Mensagem já processada: ${messageId}. Ignorando duplicata.`);
    return;
  }

  const corpoMensagem =
    message.text?.message ||
    message.body ||
    message.caption ||
    "";

  const corpoNormalizado = corpoMensagem.trim().toLowerCase();

  // ======================================================
  // FIXAR chatId (sempre o número REAL do cliente)
  // ======================================================
  let chatIdRaw = message.from || message.phone;

  if (!chatIdRaw) {
    console.log("⚠️ ERRO: mensagem recebida sem identificador de remetente.");
    return;
  }

  // 🚨 REGISTRAR NO DEDUPLICADOR — só após validar que tem chatId
  // Garante que eventos sem "phone" (status/ack da Z-API) não poluem o set
  if (messageId) {
    mensagensProcessadas.add(messageId);
    // Limpar mensagens antigas (manter últimas 1000)
    if (mensagensProcessadas.size > 1000) {
      const firstKey = mensagensProcessadas.values().next().value;
      mensagensProcessadas.delete(firstKey);
    }
  } else {
    console.log("⚠️ AVISO: Mensagem sem ID único, processando mesmo assim");
  }

  console.log("🔔 chatId detectado (raw):", chatIdRaw);

  // Normaliza o número
  let chatIdNormalizado = normalizarNumero(chatIdRaw);

  // 🔥 CORREÇÃO ESSENCIAL — DEFINIR chatId
  const chatId = chatIdNormalizado;

  console.log("🔔 chatId normalizado:", chatIdNormalizado);
  console.log(`📩 Mensagem recebida: ${corpoMensagem}`);

  // ======================================================
  // IDENTIFICAR OPERADOR, BOT E CLIENTE + SALVAR ÚLTIMO CLIENTE
  // ======================================================
  const isBot = message.fromApi === true;

  // A mensagem parece um COMANDO de operador? (começa com prefixo conhecido)
  const _corpoCmd = (corpoMensagem || "").trim().toLowerCase();
  const pareceComandoOperador =
    _corpoCmd.startsWith("#") ||
    /^(pausarespecial|retomarespecial|pausar|retomar|resetar|respondercliente|responder|listarpausas)\b/.test(_corpoCmd);

  // Operador:
  //  - a própria linha do bot (fromMe) — atendimento manual, sempre operador;
  //  - um número autorizado SÓ quando a mensagem é um comando. Mensagem
  //    normal de um número autorizado é tratada como CLIENTE (permite que
  //    Mário/Adriana testem o fluxo com o próprio número).
  // Em grupo, quem envia é o participantPhone; no privado, é o phone/from.
  const remetenteReal = message.participantPhone || message.phone || message.from;
  const isOperador = !isBot && (
    message.fromMe === true ||
    (ehNumeroAutorizado(remetenteReal) && pareceComandoOperador)
  );

  // ignora mensagens enviadas pelo próprio bot
  if (isBot) {
    console.log("⏭ Ignorando mensagem enviada pelo próprio bot.");
    return;
  }

  // ======================================================
  // ⛪ BANCADA DA PARÓQUIA — APOSENTADA em 24/07/2026
  // ======================================================
  // O Sistema de Gestão Paroquial saiu daqui: virou app próprio da Rapha Lumen
  // (`paroquia-pro`, região gru/São Paulo, código em D:\Rapha Lumen\ParoquiaPro)
  // e roda na Z-API do número da PRÓPRIA paróquia. Esta bancada rodava em iad
  // (EUA) e só aceitava dado fictício.
  // Mantido só o aviso para quem digitar "#psj" aqui por hábito (Mario/Maju).
  const _psjLow = (corpoMensagem || "").trim().toLowerCase();
  if (_psjLow === "#psj" || String(sessions[chatId]?.step || "").startsWith("psj_")) {
    delete sessions[chatId];
    await sendText(
      chatId,
      "⛪ A bancada de teste da paróquia foi *aposentada*.\n\n" +
      "O sistema agora roda no WhatsApp da *própria paróquia*. Use o *#psj* lá. 🙏"
    );
    return;
  }

  // ======================================================
  // SALVAR ÚLTIMO CLIENTE (SOMENTE cliente real; ignora operador e ignora @lid)
  // ======================================================
  const operadorNum = normalizarNumero(OPERADOR_TELEFONE_ID);

  const rawFrom = String(message.from || "");
  const rawPhone = String(message.phone || "");

  const isGrupo = rawFrom.endsWith("@g.us") || message.isGroup === true;
  const isNewsletter = message.isNewsletter === true;
  const isStatusBroadcast = rawFrom.includes("status@broadcast");

  // qualquer coisa com @lid NÃO pode virar "último cliente"
  const pareceLid = rawFrom.includes("@lid") || rawPhone.includes("@lid");

  // ✅ Só salva quando o CLIENTE falou (fromMe=false) e não é bot, nem grupo, nem @lid
  if (!isBot && !isOperador && !isGrupo && !isNewsletter && !isStatusBroadcast && !pareceLid) {
    if (chatId && chatId !== operadorNum) {
      sessions["__ultimo_cliente__"] = chatId; // chatId já está normalizado (só números)
      console.log(`🧷 Último cliente atualizado (cliente falou): ${chatId}`);

      // O cliente respondeu → pausa o follow-up automático no funil do
      // PhotoMusic Pro (e move p/ Negociando + avisa operador se quer
      // contratar). Fire-and-forget para não atrasar o processamento.
      avisarLeadRespondeu(chatId, corpoMensagem);
    }
  }

  function extrairNumero(msg) {
    // ✅ Detecta número internacional (começa com +) ANTES de remover não-dígitos.
    // Ex: "resetar +1 (561) 710-1530"  →  match = "+1 (561) 710-1530"
    // Ex: "pausar +49 30 1234-5678"    →  match = "+49 30 1234-5678"
    // Passa pelo normalizarNumero que já trata DDI corretamente.
    const matchIntl = msg.match(/\+\d[\d\s\-\(\)\.]{6,20}/);
    if (matchIntl) {
      return normalizarNumero(matchIntl[0]);
    }

    // Extrai apenas números da mensagem (comportamento original para BR)
    const apenasNumeros = msg.replace(/\D+/g, "");

    if (!apenasNumeros) return "";

    // Casos BR:
    // 1. "5521967082501" (13 dígitos com 55) → já está ok
    // 2. "5521967082501" (12 dígitos com 55) → já está ok
    // 3. "21967082501"   (11 dígitos com DDD)  → adicionar "55"
    // 4. "967082501"     (10 dígitos)           → adicionar "5521"
    // 5. "67082501"      (9 dígitos)            → adicionar "5521"
    // 6. "55 21 96708-2501" → remove espaços/hífens, fica "5521967082501"

    if (apenasNumeros.length === 13 && apenasNumeros.startsWith("55")) return apenasNumeros;
    if (apenasNumeros.length === 12 && apenasNumeros.startsWith("55")) return apenasNumeros;

    if (apenasNumeros.length === 11) {
      // Celular BR: DDD(2) + dígito 9 + número(8) → 3º dígito (índice 2) = '9'
      // Internacional sem '+': não adicionar 55 (já sem o '9')
      if (apenasNumeros[2] === '9') return "55" + apenasNumeros;
      return apenasNumeros; // internacional digitado sem '+'
    }

    if (apenasNumeros.length === 10) return "5521" + apenasNumeros;
    if (apenasNumeros.length === 9)  return "5521" + apenasNumeros;

    // Qualquer outro tamanho: adicionar "55" se não tiver
    if (!apenasNumeros.startsWith("55")) return "55" + apenasNumeros;

    return apenasNumeros;
  }

  // ======================================================
  // Extrai um NÚMERO com formatação livre (+55, espaços, hífen, parênteses,
  // ex.: "+55 21 97707-2974", "(21) 97707-2974", "21 977072974") do INÍCIO
  // de um texto, separando do "resto" que vem depois na mesma linha.
  // Usado por comandos como "responder NUMERO RESPOSTA", onde antes só o
  // 1º token (separado por espaço) era considerado número — quebrava
  // qualquer formato com espaço dentro do telefone. 2026-07-11.
  // ======================================================
  function extrairNumeroComResto(texto) {
    const t = String(texto || "").trim();
    // Telefone: começa e termina em dígito, com +, espaços, hífen, parênteses
    // ou pontos no meio (comprimento generoso p/ cobrir DDI+DDD+9 dígitos).
    // O "resto" é OBRIGATÓRIO no match (\s+([\s\S]+) sem "?"): isso força o
    // regex a fazer backtrack e achar o MAIOR telefone válido que ainda deixe
    // sobra pra resposta — sem isso, uma resposta de 1 dígito (ex: "2") era
    // engolida pro final do número (greedy), esvaziando a resposta.
    const m = t.match(/^(\+?\(?\d[\d\s\-\(\)\.]{4,18}\d)\s+([\s\S]+)$/);
    if (m) return { numero: m[1].trim(), resto: m[2].trim() };
    // Fallback: comportamento antigo (1º token = número) para não quebrar
    // casos fora do padrão esperado (ex.: só o número, sem resposta).
    const partes = t.split(/\s+/);
    return { numero: partes[0] || "", resto: partes.slice(1).join(" ").trim() };
  }

  // 🔹 AQUI: comandos do operador PRIMEIRO
  const ehComandoOperador =
    isOperador &&
    (
      corpoNormalizado.startsWith("pausarespecial") ||
      corpoNormalizado.startsWith("retomarespecial") ||
      corpoNormalizado.startsWith("pausar") ||
      corpoNormalizado.startsWith("retomar") ||
      corpoNormalizado.startsWith("resetar") ||
      corpoNormalizado.startsWith("respondercliente") ||
      corpoNormalizado.startsWith("responder") ||
      corpoNormalizado.startsWith("#")
    );

  // ======================================================
  // EXECUTAR COMANDOS DO OPERADOR
  // ======================================================
  if (ehComandoOperador) {

    // Para onde vai a CONFIRMAÇÃO do comando: no privado, o DM da linha do bot
    // (OPERADOR_TELEFONE_ID); em GRUPO, o próprio grupo, para o operador ver o
    // resultado onde digitou. O efeito no cliente (pausar/retomar/responder) é
    // o mesmo nos dois casos.
    const destinoOperador = isGrupo ? chatIdRaw : OPERADOR_TELEFONE_ID;

    let numero = extrairNumero(corpoMensagem);

    if (!numero && message.quotedMsg?.phone) {
      numero = extrairNumero(message.quotedMsg.phone);
    }

    // ======================================================
    // DETECTAR E ENVIAR YOUTUBE
    // ======================================================
    if (isOperador && (corpoMensagem.includes("youtube.com") || corpoMensagem.includes("youtu.be"))) {
      console.log(`📹 [YouTube] Operador enviando link: ${corpoMensagem}`);
      
      // Limpar o link
      const linkYoutube = corpoMensagem.trim();
      
      // Validar se é YouTube
      if (linkYoutube.includes("youtube.com") || linkYoutube.includes("youtu.be")) {
        // Enviar para cliente alvo (se definido)
        const clienteAlvo = sessions["__ultimo_cliente__"];
        if (clienteAlvo) {
          await sendText(clienteAlvo, linkYoutube);
          await sendText(chatId, `✅ Link do YouTube enviado para o cliente! (O WhatsApp gera preview automaticamente)`);
          console.log(`✅ Link enviado para ${clienteAlvo}`);
        } else {
          // Se não tem cliente definido, enviar para quem enviou (teste)
          await sendText(chatId, `Teste:\n${linkYoutube}\n\n(Faça #cliente NUMERO para definir cliente alvo)`);
        }
        return;
      }
    }

    // ======================================================
    // COMANDO #cliente — definir cliente manualmente
    // ======================================================
    if (corpoNormalizado.startsWith("#cliente")) {

      const numeroBruto = corpoMensagem
        .replace("#cliente", "")
        .replace(/[^\d]/g, "")
        .trim();

      if (!numeroBruto) {
        await sendText(
          destinoOperador,
          "⚠ Você precisa informar um número.\nExemplo:\n#cliente 5521993290588"
        );
        return;
      }

      const numeroNormalizado = normalizarNumero(numeroBruto);

      if (!numeroNormalizado || numeroNormalizado.length < 11) {
        await sendText(
          destinoOperador,
          "⚠ Número inválido. Informe no formato:\n#cliente 5521993290588"
        );
        return;
      }

      sessions["__cliente_manual__"] = numeroNormalizado;

      console.log("📌 [MANUAL] Cliente definido manualmente:", numeroNormalizado);

      await sendText(
        destinoOperador,
        `✅ Cliente definido manualmente como:\n*${numeroNormalizado}*\n\n` +
        "Agora você pode enviar o orçamento manual normalmente.\n" +
        "Exemplo:\n#fotocabine 0,8,120,6,1"
      );

      return;
    }

    // ======================================================
    // COMANDO #limparcliente — remover cliente manual
    // ======================================================
    if (corpoNormalizado.startsWith("#limparcliente")) {

      delete sessions["__cliente_manual__"];

      console.log("🧹 [MANUAL] Cliente manual removido.");

      await sendText(
        destinoOperador,
        "🧹 Cliente manual removido.\nAgora o bot tentará identificar automaticamente."
      );

      return;
    }

    // ======================================================
    // PAUSA ESPECIAL
    // COMANDO: pausarespecial 21 99999-8888
    // ======================================================
    if (corpoNormalizado.startsWith("pausarespecial")) {
      const telefone = corpoMensagem.slice(15).trim();
      
      const sucesso = await pausarEspecial(telefone);
      
      if (sucesso) {
        // ✅ NÃO deletar sessions global!
        // A pausa é controlada por sessoesRetomadas[telefonNorm] (JSON)
        // ou por pausado=1 no DB — Sessions global é para fluxo de orçamento/menu

        await sendText(destinoOperador, `✅ Cliente PAUSADO!`);
      } else {
        await sendText(destinoOperador, `❌ Falha ao pausar — verifique a conexão com o servidor`);
      }
      return;
    }

    // ======================================================
    // RETOMAR ESPECIAL
    // COMANDO: retomarespecial 21 99999-8888
    // ======================================================
    if (corpoNormalizado.startsWith("retomarespecial")) {
      const telefone = corpoMensagem.slice(16).trim();

      const sucesso = await retomarEspecial(telefone);

      if (sucesso) {
        // ✅ NÃO deletar sessions global!
        // A retomada é controlada por sessoesRetomadas[telefonNorm] (JSON)
        // ou por pausado=0 no DB — Sessions global é para fluxo de orçamento/menu

        await sendText(destinoOperador, `✅ Cliente RETOMADO!`);
      } else {
        await sendText(destinoOperador, `❌ Número não encontrado (JSON nem DB)`);
      }
      return;
    }

    // ======================================================
    // LISTAR PAUSA ESPECIAL
    // COMANDO: listarpausas
    // ======================================================
    if (corpoNormalizado === "listarpausas") {
      listarPausadosEspeciais();
      await sendText(destinoOperador, `📋 Lista enviada ao console`);
      return;
    }

    // ======================================================
    // PAUSAR (pausa normal - só de operador)
    // COMANDO: pausar 21 99999-8888
    // ======================================================
    if (corpoNormalizado.startsWith("pausar")) {
      const normalizado = normalizarNumero(numero);
      pausarCliente(normalizado);
      await sendText(destinoOperador, `⏸ Atendimento pausado para ${normalizado}`);
      return;
    }

    // ======================================================
    // RETOMAR
    // COMANDO: retomar 21 99999-8888
    // ======================================================
    if (corpoNormalizado.startsWith("retomar")) {
      const normalizado = normalizarNumero(numero);
      retomarCliente(normalizado);

      // 📌 AVISAR O CLIENTE QUE RETOMOU
      await sendTyping(normalizado);
      await new Promise(r => setTimeout(r, 500));
      await sendText(normalizado, "Vamos continuar?");
      
      // 📌 VERIFICAR EM QUE PASSO ESTAVA E REENVIAR ÚLTIMA PERGUNTA
      const session = sessions[normalizado];
      if (session && session.step) {
        console.log(`📌 Cliente estava em: ${session.step}`);
        await sendText(destinoOperador, `▶ Atendimento retomado para ${normalizado} (estava em: ${session.step})`);
        
        // 📌 REENVIAR ÚLTIMA PERGUNTA SE EXISTIR
        if (session.ultimaPerguntaNaoRespondida) {
          await new Promise(r => setTimeout(r, 500));
          console.log(`📌 Reenviando pergunta: ${session.ultimaPerguntaNaoRespondida}`);
          await sendTyping(normalizado);
          await sendText(normalizado, session.ultimaPerguntaNaoRespondida);
        }
      } else {
        console.log(`📌 Cliente não tinha sessão, enviando menu inicial`);
        await mostrarMenuInicial(normalizado);
        await sendText(destinoOperador, `▶ Atendimento retomado para ${normalizado} (sem contexto anterior)`);
      }
      return;
    }

    // ======================================================
    // RESETAR
    // COMANDO: resetar 21 99999-8888
    // ======================================================
    if (corpoNormalizado.startsWith("resetar")) {
      const normalizado = normalizarNumero(numero);
      retomarCliente(normalizado);
      delete sessions[normalizado];
      await mostrarMenuInicial(normalizado);
      await sendText(destinoOperador, `🔄 Atendimento resetado para ${normalizado}`);
      return;
    }

    // ======================================================
    // REPLAY DE CONVERSA — RECONSTRUIR SESSÃO DO CLIENTE
    // COMANDO: respondercliente NUMERO
    //          [colar a conversa exportada do WhatsApp]
    //
    // O sistema extrai só as respostas do cliente, faz replay
    // silencioso de todas exceto a última, e processa a última
    // normalmente — o cliente recebe a próxima pergunta.
    // ======================================================
    if (corpoNormalizado.startsWith("respondercliente")) {

      // --- Parsear cabeçalho e corpo ---
      const linhasCmd = corpoMensagem.split("\n");
      const primeiraLinha = linhasCmd[0] || "";
      // Número = tudo que vem depois de "respondercliente" na 1ª linha (nada
      // mais é esperado ali), então formatos com espaço (+55 21 97707-2974,
      // (21) 97707-2974 etc.) funcionam — antes só o 1º token era usado.
      const numeroRaw = primeiraLinha.replace(/^respondercliente/i, "").trim();
      const corpoConversa = linhasCmd.slice(1).join("\n");

      if (!numeroRaw) {
        await sendText(destinoOperador,
          "⚠ Formato:\n*respondercliente NUMERO*\n[cole a conversa exportada do WhatsApp abaixo]"
        );
        return;
      }

      const numeroCliente = normalizarNumero(numeroRaw);
      if (!numeroCliente || numeroCliente.length < 10) {
        await sendText(destinoOperador,
          `⚠ Número inválido: *${numeroRaw}*\n\n` +
          "Formatos aceitos:\n" +
          "  +5521995021656\n  5521995021656\n  21995021656\n  995021656"
        );
        return;
      }

      // --- Detectar se veio conversa para replay ---
      const temConversa = /\[[\d:,\/ ]+\]/.test(corpoConversa);

      if (!temConversa) {
        await sendText(destinoOperador,
          "⚠ Nenhuma conversa detectada.\n\n" +
          "Cole a conversa exportada do WhatsApp logo abaixo do número:\n\n" +
          "*respondercliente 5521995021656*\n" +
          "[01:37] +55 21 995...: 1\n" +
          "[01:37] Foto Cabine: Perfeito!...\n" +
          "..."
        );
        return;
      }

      // --- Extrair só as mensagens do CLIENTE ---
      function parsearConversa(texto, clienteNum) {
        const clienteDigits = clienteNum.replace(/\D/g, "");
        const msgs = [];
        let ultimaFoiBot = false; // a ÚLTIMA fala colada foi do bot (não do cliente)?
        for (const linha of texto.split("\n")) {
          // Formato: [HH:MM, DD/MM/YYYY] Speaker: conteudo
          //      ou  [HH:MM] Speaker: conteudo
          const match = linha.match(/^\[[\d:,\/ ]+\]\s+(.+?):\s*(.+)$/);
          if (!match) continue;
          const speaker = match[1].trim();
          const conteudo = match[2].trim();
          if (!conteudo) continue;
          // Verifica se o speaker é o cliente comparando dígitos finais
          const speakerDigits = speaker.replace(/\D/g, "");
          const isCliente =
            speakerDigits.length >= 6 && (
              speakerDigits === clienteDigits ||
              clienteDigits.endsWith(speakerDigits.slice(-10)) ||
              speakerDigits.endsWith(clienteDigits.slice(-10))
            );
          if (isCliente) {
            msgs.push(conteudo);
            ultimaFoiBot = false;
          } else {
            // Linha do bot (nome sem número) ou de terceiro: a conversa, até aqui,
            // terminou numa fala que NÃO é do cliente.
            ultimaFoiBot = true;
          }
        }
        return { msgs, ultimaFoiBot };
      }

      const { msgs: mensagensCliente, ultimaFoiBot } = parsearConversa(corpoConversa, numeroCliente);

      if (mensagensCliente.length === 0) {
        await sendText(destinoOperador,
          `⚠ Nenhuma mensagem do cliente *${numeroCliente}* encontrada na conversa.\n\n` +
          "Verifique se o número está correto e se a conversa foi exportada corretamente."
        );
        return;
      }

      // --- Helper: criar mensagem simulada ---
      function criarSimulada(numero, texto) {
        const ts = Date.now() + Math.random();
        return {
          from: numero + "@c.us", phone: numero, to: null,
          body: texto, text: { message: texto },
          isGroup: false, isGroupMsg: false,
          fromMe: false, fromApi: false,
          messageId: "replay-" + ts, id: "replay-" + ts,
          type: "text", isNewsletter: false, isEdit: false,
          chatName: null, senderName: null,
          quotedMsg: null, quotedMessage: null
        };
      }

      // --- Reconstruir sessão do zero ---
      // Cria sessão já com menuInicialEnviado=true (menu já foi exibido ao cliente)
      delete sessions[numeroCliente];
      sessions[numeroCliente] = {
        step: "aguardando_opcao",
        menuInicialEnviado: true,
        enviouAvaliacao: false,
        enviouApresentacao: false,
        primeiraRodadaFinalizada: false,
        segundaRodadaFinalizada: false,
        orcamento: { servicosEnviados: [] },
        servicosEnviados: [],
        enviandoAvaliacao: false,
        processandoServico: false,
        enviandoOrcamentos: false,
        enviandoOrcamentosManualmente: false,
        ultimaInteracao: Date.now(),
        lembreteOrcamentoEnviado: false,
        ultimaPerguntaNaoRespondida: null
      };

      // Se a conversa colada TERMINA com mensagem do bot, a próxima pergunta JÁ foi
      // enviada ao cliente (está colada) — então reproduzimos TODAS as respostas em
      // SILÊNCIO e NÃO reenviamos nada (senão o bot manda a mesma pergunta de novo,
      // caso Rayane 29/06). Só quando a conversa termina numa resposta do CLIENTE
      // (ele respondeu e o bot não respondeu de volta, ex.: sistema reiniciou) é que
      // a última vai em modo NORMAL, p/ o cliente receber a próxima pergunta.
      const reenviarProxima = !ultimaFoiBot;
      const qtdSilenciosa = reenviarProxima
        ? mensagensCliente.length - 1
        : mensagensCliente.length;

      await sendText(destinoOperador,
        `🔄 Reconstruindo sessão de *${numeroCliente}*...\n` +
        `📋 ${mensagensCliente.length} mensagens do cliente encontradas:\n` +
        mensagensCliente.map((m, i) => `${i + 1}. "${m}"`).join("\n") +
        (reenviarProxima
          ? `\n\n➡️ A conversa termina numa resposta do cliente — vou reenviar a próxima pergunta.`
          : `\n\n🤫 A conversa termina numa mensagem do bot — a última pergunta já foi enviada, então NÃO vou reenviar nada.`)
      );

      // --- Replay silencioso ---
      ativarModoSilencioso(numeroCliente);
      let replayOk = true;
      try {
        for (let i = 0; i < qtdSilenciosa; i++) {
          const msg = mensagensCliente[i];
          const stepAntes = sessions[numeroCliente]?.step;
          console.log(`🔇 [Replay ${i + 1}/${qtdSilenciosa}] step=${stepAntes} msg="${msg}"`);
          await handleIncomingMessage(criarSimulada(numeroCliente, msg));
          await new Promise(r => setTimeout(r, 80)); // pequena pausa anti-race
        }
      } catch (e) {
        replayOk = false;
        console.error("🚨 [Replay] Erro durante replay silencioso:", e.message);
        await sendText(destinoOperador, `❌ Erro no replay: ${e.message}`);
      } finally {
        desativarModoSilencioso(numeroCliente);
      }

      if (!replayOk) return;

      if (reenviarProxima) {
        // --- Última mensagem em modo normal (cliente recebe a próxima pergunta) ---
        const ultima = mensagensCliente[mensagensCliente.length - 1];
        const stepFinal = sessions[numeroCliente]?.step || "?";
        console.log(`▶️ [Replay FINAL] step=${stepFinal} msg="${ultima}"`);

        await handleIncomingMessage(criarSimulada(numeroCliente, ultima));

        await sendText(destinoOperador,
          `✅ Sessão reconstruída com sucesso!\n\n` +
          `👤 Cliente: *${numeroCliente}*\n` +
          `📩 Última resposta reproduzida: *"${ultima}"*\n` +
          `📍 Step final: *${sessions[numeroCliente]?.step || "?"}*\n\n` +
          `O cliente acabou de receber a próxima pergunta e pode continuar normalmente.`
        );
      } else {
        // Conversa terminou numa msg do bot: tudo reproduzido em silêncio, nada reenviado.
        await sendText(destinoOperador,
          `✅ Sessão reconstruída com sucesso!\n\n` +
          `👤 Cliente: *${numeroCliente}*\n` +
          `📍 Step final: *${sessions[numeroCliente]?.step || "?"}*\n\n` +
          `A última pergunta já tinha sido enviada ao cliente, então *nada foi reenviado*. ` +
          `É só aguardar a resposta dele a partir desse ponto.`
        );
      }
      return;
    }

    // ======================================================
    // RESPONDER NO LUGAR DO CLIENTE
    // COMANDO: responder NUMERO RESPOSTA
    // Ex: responder 5521995021656 pular
    //     responder 5521995021656 2
    // ======================================================
    if (corpoNormalizado.startsWith("responder")) {
      // Separa NUMERO (formatação livre: +55 21 97707-2974, (21) 97707-2974,
      // 21 977072974 etc.) do resto da linha (a resposta em si) — antes só o
      // 1º token era considerado número, quebrando formatos com espaço.
      const corpoSemComando = corpoMensagem.trim().replace(/^responder\s+/i, "");
      const { numero: numeroRaw, resto: respostaTexto } = extrairNumeroComResto(corpoSemComando);

      if (!numeroRaw || !respostaTexto) {
        await sendText(
          destinoOperador,
          "⚠ Formato correto:\n*responder NUMERO RESPOSTA*\n\n" +
          "Exemplos:\n" +
          "  `responder 5521995021656 pular`\n" +
          "  `responder 5521995021656 2`\n" +
          "  `responder 5521995021656 nome@email.com`"
        );
        return;
      }

      const numeroCliente = normalizarNumero(numeroRaw);

      if (!numeroCliente || numeroCliente.length < 10) {
        await sendText(destinoOperador,
          `⚠ Número inválido: *${numeroRaw}*\n\n` +
          "Formatos aceitos:\n" +
          "  +5521995021656\n  5521995021656\n  21995021656\n  995021656"
        );
        return;
      }

      const sessaoCliente = sessions[numeroCliente];
      if (!sessaoCliente) {
        await sendText(
          destinoOperador,
          `⚠ Nenhuma sessão ativa para *${numeroCliente}*.\n` +
          `Use *resetar ${numeroCliente}* para reiniciar o atendimento.`
        );
        return;
      }

      // Destrava antes de injetar: tira da pausa do operador e, se o fluxo
      // foi pausado (3 erros) ou encerrado por follow-up, volta ao passo
      // onde o cliente travou — assim a resposta entra no lugar certo.
      if (estaPausado(numeroCliente)) retomarCliente(numeroCliente);
      if ((sessaoCliente.step === "pausado_fluxo" || sessaoCliente.step === "pausado_followup")
          && sessaoCliente.stepAnterior) {
        sessaoCliente.step = sessaoCliente.stepAnterior;
        sessaoCliente.avisouOperadorFollowup = false;
      }

      console.log(`🎭 [OPERADOR] Injetando resposta "${respostaTexto}" para ${numeroCliente} (step: ${sessaoCliente.step})`);

      // Monta uma mensagem simulada no mesmo formato que a Z-API envia
      const mensagemSimulada = {
        from:           numeroCliente + "@c.us",
        phone:          numeroCliente,
        to:             null,
        body:           respostaTexto,
        text:           { message: respostaTexto },
        isGroup:        false,
        isGroupMsg:     false,
        fromMe:         false,
        fromApi:        false,
        messageId:      "op-inject-" + Date.now(),
        id:             "op-inject-" + Date.now(),
        type:           "text",
        isNewsletter:   false,
        isEdit:         false,
        chatName:       null,
        senderName:     null,
        quotedMsg:      null,
        quotedMessage:  null
      };

      await handleIncomingMessage(mensagemSimulada);
      await sendText(
        destinoOperador,
        `✅ Resposta *"${respostaTexto}"* injetada para *${numeroCliente}*\n` +
        `Step anterior: ${sessaoCliente.step} → Step atual: ${sessions[numeroCliente]?.step || "?"}`
      );
      return;
    }

    // ======================================================
    // COMANDOS MANUAIS (#fotocabine, #totem, etc.)
    // ======================================================
    if (corpoNormalizado.startsWith("#")) {
      console.log("⚙️ Executando comando manual do operador:", corpoMensagem);

      // ======================================================
      // FLAG "+completo" (2026-07-15)
      // ======================================================
      // Por padrão o comando manual agora manda SÓ O PREÇO, igual ao fluxo
      // automático (o cliente pede os detalhes no menu se quiser). Com
      // "+completo" em qualquer lugar do lote, manda a apresentação inteira
      // (fotos/vídeos) como era antes — útil para lead frio que nunca viu o
      // serviço. É flag do LOTE, não de cada comando, igual ao "->".
      // Ex.: #fotocabine 0,2,120,6,1 +completo -> 5521999999999
      const enviarCompleto = /\+completo\b/i.test(corpoMensagem);
      // Tira a flag antes de parsear: senão ela entra nos parâmetros do
      // último comando e quebra o split.
      const corpoComandos = String(corpoMensagem).replace(/\+completo\b/gi, " ");

      const comandos = corpoComandos
        .replace(/\n/g, " ")
        .replace(/;/g, " , ")
        .replace(/\s+#/g, " , #")
        .split(/,(?=\s*#)/g)
        .map(c => c.trim())
        .filter(c => c.startsWith("#"));

      if (comandos.length === 0) {
        await sendText(destinoOperador, "⚠ Nenhum comando manual válido encontrado.");
        return;
      }

      // ======================================================
      // COMANDO ESPECIAL: #orcamentomanual — guia rápido do operador
      // Monta as listas a partir das CONSTANTES reais (comandosServicos e
      // celebracoes), então o guia nunca fica desatualizado. Não precisa de
      // cliente destino, por isso é tratado antes da resolução do cliente.
      // ======================================================
      const pedeGuia = comandos.some(c => {
        const n = c.split(" ")[0].toLowerCase();
        return n === "#orcamentomanual" || n === "#ajuda" || n === "#comandos";
      });

      if (pedeGuia) {
        const listaServicos = Object.keys(comandosServicos)
          .sort((a, b) => comandosServicos[a] - comandosServicos[b])
          .map(s => `• ${s}`)
          .join("\n");

        const listaCelebr = Object.keys(celebracoes)
          .sort((a, b) => Number(a) - Number(b))
          .map(k => `*${k}* - ${celebracoes[k]}`)
          .join("\n");

        const guia1 =
          "📋 *ORÇAMENTO MANUAL — GUIA RÁPIDO*\n\n" +
          "*MODELO:*\n" +
          "#servico  A,B,C,D,E  TELEFONE\n\n" +
          "*O QUE É CADA NÚMERO:*\n" +
          "*A* = avaliação da empresa (*1* envia / *0* não envia)\n" +
          "*B* = celebração (ver lista na próxima mensagem)\n" +
          "*C* = nº de convidados\n" +
          "*D* = horas contratadas\n" +
          "*E* = dias (só vale p/ Corporativo; nos outros é sempre 1)\n\n" +
          "*EXEMPLOS:*\n" +
          "#plataforma360 1,8,250,4,1 5521999999999\n" +
          "_360, com avaliação, Corporativo, 250 convidados, 4h, 1 dia_\n\n" +
          "#fotocabine 0,1,150,5,1 +completo 5521999999999\n" +
          "_Cabine, sem avaliação, 15 anos, 150 convidados, 5h_\n\n" +
          "*TELEFONE:* no fim, com ou sem seta\n" +
          "#fotocabine 0,1,50,4,1 5521999999999\n" +
          "#fotocabine 0,1,50,4,1 -> 5521999999999";

        const guia2 =
          "📋 *ORÇAMENTO MANUAL — LISTAS*\n\n" +
          "*SERVIÇOS:*\n" + listaServicos + "\n\n" +
          "*CELEBRAÇÕES (o número do B):*\n" + listaCelebr + "\n\n" +
          "*SÓ PREÇO x COMPLETO:*\n" +
          "• *Sem flag* (padrão): manda *só o preço* (PDF). O cliente pede as fotos no menu se quiser.\n" +
          "• *+completo*: manda a *apresentação inteira* (fotos, vídeos, pacotes) e depois o PDF. Use para cliente que *nunca viu* o serviço.\n\n" +
          "*DESLOCAMENTO:*\n" +
          "Mande o local antes (ou junto) do comando:\n" +
          "#local Califórnia, Nova Iguaçu\n" +
          "_Vale para o *próximo orçamento* e depois é apagado._\n" +
          "_Cada orçamento precisa do seu próprio #local._\n" +
          "_Só a cidade também funciona: #local Nova Iguaçu_\n\n" +
          "*DATA DO EVENTO (#data):*\n" +
          "#data 20/12/2026\n" +
          "_Mesma regra do #local: vale para o *próximo orçamento* e some._\n" +
          "_É OPCIONAL. Sem ela o PDF sai e avisa que o parcelamento_\n" +
          "_no PIX depende da data._\n\n" +
          "*ORÇAMENTO COMPLETO (serviço gerado na hora):*\n" +
          "#data 20/12/2026, #local Califórnia, Nova Iguaçu, #totemretro 0,1,150,5,1\n" +
          "_Com os dois, o PDF já sai com a data e com o deslocamento._\n" +
          "_Sem eles sai igual, só dizendo que são a combinar._\n\n" +
          "⚠️ *Não funciona em grupo* — mande daqui ou no chat do cliente.";

        await sendText(destinoOperador, guia1);
        await sendText(destinoOperador, guia2);
        return;
      }

      // ======================================================
      // #local Bairro, Cidade — define o local para o deslocamento
      // Tratado AQUI, ANTES de resolver o cliente destino: sozinho ele não
      // precisa de cliente (senão o bot responde "não consegui identificar o
      // cliente"). Fica guardado em sessions["__local_manual__"], igual ao
      // #cliente, para valer mesmo quando o serviço vier em OUTRA mensagem.
      // Lê o texto CRU: o parser de parâmetros troca espaço por vírgula e
      // quebraria nome composto ("Nova Iguaçu" -> "Nova" + "Iguaçu").
      // ======================================================
      const cmdLocal = comandos.find(c => c.split(" ")[0].toLowerCase() === "#local");
      if (cmdLocal) {
        // tira TODOS os #local da fila (o resto segue normal)
        for (let i = comandos.length - 1; i >= 0; i--) {
          if (comandos[i].split(" ")[0].toLowerCase() === "#local") comandos.splice(i, 1);
        }
        // Tira um telefone colado no fim ("#local Bairro, Cidade 5521999999999"),
        // senão ele entrava no nome da cidade e a consulta falhava.
        const bruto  = cmdLocal.slice("#local".length)
                                .replace(/[-+\d\s()]{8,}$/, "")
                                .trim();
        const partes = bruto.split(",").map(s => s.trim()).filter(Boolean);

        if (partes.length === 0) {
          delete sessions["__local_manual__"];
          await sendText(destinoOperador,
            "📍 Local apagado.\nUse: *#local Bairro, Cidade* (ou só *#local Cidade*)");
        } else {
          // USO ÚNICO + validade. Antes ficava guardado "até trocar" e grudou
          // num orçamento de OUTRO cliente 2 dias depois, com deslocamento
          // errado (22/07). Local errado é pior que local nenhum.
          sessions["__local_manual__"] = partes.length >= 2
            ? { bairro: partes[0], cidade: partes.slice(1).join(", "), em: Date.now() }
            : { bairro: "",        cidade: partes[0],                  em: Date.now() };
          const L = sessions["__local_manual__"];
          const ondeFmt = (L.bairro ? L.bairro + " — " : "") + L.cidade;
          console.log(`📍 [MANUAL] Local guardado (uso único): bairro="${L.bairro}" cidade="${L.cidade}"`);
          await sendText(destinoOperador,
            `📍 Local definido: *${ondeFmt}*\n` +
            `Vale para o *próximo orçamento* e depois é apagado.\n` +
            `_Se enviar outro orçamento, mande o #local de novo._`);
        }

        // Só o #local nesta mensagem → nada mais a fazer (não exige cliente)
        if (comandos.length === 0) return;
      }

      // ======================================================
      // #data DD/MM/AAAA — data do evento para o orçamento MANUAL
      // Irmão do #local: mesmo uso único e mesma validade de 30 min.
      // 🚨 Nasceu com o orçamento AUTOMÁTICO (Totem Retrô): o PDF gerado na
      // hora EXIGE data (o endpoint devolve `data_invalida` sem ela) e o
      // comando manual não tinha como informar. Nos PDFs estáticos isso não
      // fazia falta, então só vale para serviço automático.
      // ======================================================
      const cmdData = comandos.find(c => c.split(" ")[0].toLowerCase() === "#data");
      if (cmdData) {
        for (let i = comandos.length - 1; i >= 0; i--) {
          if (comandos[i].split(" ")[0].toLowerCase() === "#data") comandos.splice(i, 1);
        }

        // Tira um telefone colado no fim ("#data 20/12/2026 5521999999999") e a
        // vírgula do separador de comandos ("#data 20/12/2026, #totemretro ...").
        // 🚨 NÃO dá para reaproveitar o strip do #local aqui: o [-+\d\s()]{11,}
        // dele engolia o ANO junto com o telefone e a data virava "20/12/".
        // Aqui o telefone só sai quando é um bloco separado de 10 a 13 dígitos.
        const brutoData = cmdData.slice("#data".length)
                                 .replace(/\s+(?:->\s*)?\+?\d{10,13}\s*$/, "")
                                 .replace(/[,\s]+$/, "")
                                 .trim();

        if (!brutoData) {
          delete sessions["__data_manual__"];
          await sendText(destinoOperador,
            "📅 Data apagada.\nUse: *#data 20/12/2026* (aceita *20/12* e por extenso)");
        } else {
          const df = parsearDataFlex(brutoData);
          const hojeData = new Date();
          hojeData.setHours(0, 0, 0, 0);

          if (!df) {
            await sendText(destinoOperador,
              "⚠ Não entendi a data. Use *#data 20/12/2026*, *#data 20/12* ou *#data 9 de setembro*.");
          } else if (df.date < hojeData) {
            await sendText(destinoOperador,
              `⚠ A data *${df.str}* já passou. O orçamento gerado não aceita data no passado.`);
          } else {
            sessions["__data_manual__"] = { str: df.str, em: Date.now() };
            console.log(`📅 [MANUAL] Data guardada (uso único): ${df.str}`);
            await sendText(destinoOperador,
              `📅 Data do evento: *${df.str}*\n` +
              `Vale para o *próximo orçamento* e depois é apagada.\n` +
              `_Só é obrigatória nos serviços com orçamento gerado na hora (hoje: Totem Retrô)._`);
          }
        }

        // Só o #data nesta mensagem → nada mais a fazer (não exige cliente)
        if (comandos.length === 0) return;
      }

      // ======================================================
      // RESOLVER CLIENTE DESTINO (MANUAL) — PRIORIDADE + VALIDAÇÃO
      // ======================================================
      let numeroCliente = null;

      const operador = normalizarNumero(OPERADOR_TELEFONE_ID);

      // Telefones reais BR: 10 a 13 dígitos (com ou sem DDI)
      function ehTelefoneValido(num) {
        if (!num) return false;
        const n = String(num).replace(/\D+/g, "");
        return n.length >= 10 && n.length <= 13;
      }

      // ======================================================
      // CAMADA A — alvo explícito no comando: "... -> 5521999999999"
      // ======================================================
      const matchSeta = String(corpoMensagem || "").match(/->\s*([\d+\-\s()]+)/);
      if (matchSeta && matchSeta[1]) {
        const alvo = normalizarNumero(matchSeta[1]);
        if (ehTelefoneValido(alvo) && alvo !== operador) {
          numeroCliente = alvo;
          console.log("📌 Cliente via '->':", numeroCliente);
        }
      }

      // ======================================================
      // CAMADA A.1 — telefone inline no fim do comando
      // Ex: #fotocabine 1,1,50,4,1 2199999-9888
      //     #fotoeucaristia 1,1,15/06 +55 21 99999-9888
      // ======================================================
      if (!numeroCliente) {
        for (const c of comandos) {
          /* Aceita o número como o operador copia do WhatsApp, inclusive com
             parêntese no DDD. 🚨 Antes o regex começava em \d, então
             "(21) 96708-2501" casava só a partir do "96708-2501" e o DDD se
             PERDIA — o normalizador então assumia 21 e um "(11) ..." de São
             Paulo viraria número do Rio (mensagem para a pessoa errada). */
          const matchInline = c.match(/[ \t](\+?[\d(][\d\s\-().]{6,}\d)\s*$/);
          if (matchInline) {
            const rawPhone = matchInline[1].trim();
            const digits = rawPhone.replace(/\D/g, '');
            if (digits.length >= 8 && digits.length <= 15) {
              const alvo = normalizarNumero(rawPhone);
              if (alvo && ehTelefoneValido(alvo) && alvo !== operador) {
                numeroCliente = alvo;
                console.log("📌 Cliente via inline phone:", numeroCliente);
                break;
              }
            }
          }
        }
      }

      // ======================================================
      // CAMADA 0 — #cliente (manual explícito)
      // ======================================================
      if (!numeroCliente && sessions["__cliente_manual__"]) {
        const manual = normalizarNumero(sessions["__cliente_manual__"]);
        if (ehTelefoneValido(manual) && manual !== operador) {
          numeroCliente = manual;
          console.log("📌 Cliente via #cliente:", numeroCliente);
        }
      }

      // ======================================================
      // CAMADA 1 — quotedMsg
      // ======================================================
      if (!numeroCliente && message.quotedMsg?.phone) {
        const q = normalizarNumero(message.quotedMsg.phone);
        if (ehTelefoneValido(q) && q !== operador) {
          numeroCliente = q;
          console.log("📌 Cliente via quotedMsg:", numeroCliente);
        }
      }

      // ======================================================
      // CAMADA 2 — destino real do webhook (se for telefone)
      // ======================================================
      const destinoRaw = message.to || message.phone || message.chatId || null;
      const destinoNum = destinoRaw ? normalizarNumero(String(destinoRaw)) : null;

      if (!numeroCliente && ehTelefoneValido(destinoNum) && destinoNum !== operador) {
        numeroCliente = destinoNum;
        console.log("📌 Cliente via destino do webhook:", numeroCliente);
      }

      // ======================================================
      // CAMADA 3 — __ultimo_cliente__ DESATIVADO
      // Evita envio acidental quando comando é digitado em grupo
      // ou salvo em qualquer outro contexto que não o chat do cliente.
      // ======================================================

      // ======================================================
      // FALHA TOTAL — nenhuma camada identificou o cliente
      // ======================================================
      if (!numeroCliente) {
        await sendText(
          destinoOperador,
          "⚠ Não consegui identificar o cliente destino.\n\n" +
          "Escolha uma das formas abaixo:\n\n" +
          "1️⃣ *Envie o comando no chat do cliente* (método principal)\n\n" +
          "2️⃣ *Número inline no comando:*\n" +
          "   `#fotocabine 0,1,50,4,1 2199999-9888`\n" +
          "   `#fotocabine 0,1,50,4,1 +55 21 99999-9888`\n\n" +
          "3️⃣ *Seta (->):*\n" +
          "   `#fotocabine 0,1,50,4,1 -> 5521993290588`\n\n" +
          "💡 *+completo* manda as fotos junto (padrão é só o preço):\n" +
          "   `#fotocabine 0,1,50,4,1 +completo -> 5521993290588`\n\n" +
          "4️⃣ *Responda a mensagem do cliente* com o comando\n\n" +
          "5️⃣ *#cliente NUMERO* antes do comando\n\n" +
          "⚠ *Nunca envie comandos em grupos* — o bot não consegue identificar o cliente destino."
        );
        return;
      }

      const chatIdCliente = numeroCliente;

      const estavaPausado = estaPausado(chatIdCliente);
      if (estavaPausado) retomarCliente(chatIdCliente);

      if (!sessions[chatIdCliente]) {
        sessions[chatIdCliente] = {
          step: "aguardando_opcao",
          enviouAvaliacao: false,
          enviouApresentacao: false,
          primeiraRodadaFinalizada: false,
          segundaRodadaFinalizada: false,
          orcamento: { servicosEnviados: [] },
          servicosEnviados: [],
          enviandoAvaliacao: false,
          processandoServico: false,
          enviandoOrcamentos: false,
          enviandoOrcamentosManualmente: false, // 🚨 NOVO - bloquear durante envio manual
          ultimaInteracao: Date.now(),
          lembreteOrcamentoEnviado: false
        };
      }

      const session = sessions[chatIdCliente];

      // Inicializar array de serviços se não existir
      if (!session.orcamento.servicosEnviados) {
        session.orcamento.servicosEnviados = [];
      }

      // 🚨 ATIVAR FLAG DE ENVIO MANUAL - BLOQUEAR MENSAGENS DO CLIENTE
      session.enviandoOrcamentosManualmente = true;
      
      // Sem aviso de "aguarde": o cliente recebe o orçamento na hora.

      let controlaMsgManual = 0;
      let controlaMsgManual2 = 0;
      let avaliacaoEnviadaNesteLote = false; // flag local — ignora session.enviouAvaliacao do fluxo automático
      // Ids dos serviços deste lote, para o orçamento gerado sair num PDF só.
      const _servicosDoLote = [];

      /* 📅📍 DATA E LOCAL ANTES DE ENVIAR — 🚨 A ORDEM É O BUG (Mario, 17/08/2026).
         O `#data` e o `#local` eram aplicados DEPOIS do laço de envio, e para o
         serviço com orçamento GERADO na hora (Totem Retrô) isso chega tarde: o
         PDF já saiu, sem data e sem bairro, então o cliente recebia a proposta
         com "deslocamento a consultar" mesmo com o operador tendo informado o
         local. Com PDF estático não aparecia, porque lá data e bairro não entram
         no arquivo.
         Zerar antes também é mais correto: bairro velho de outro orçamento não
         vaza para dentro do PDF novo (foi o caso de 22/07).
         O CÁLCULO do deslocamento e as mensagens seguem depois do laço, onde
         sempre estiveram; aqui só resolvemos os VALORES. */
      const LOCAL_VALIDADE_MS = 30 * 60 * 1000;
      let localManual = sessions["__local_manual__"];
      if (localManual && localManual.em && (Date.now() - localManual.em) > LOCAL_VALIDADE_MS) {
        console.log(`📍 [MANUAL] #local expirado (${localManual.cidade}) — ignorado`);
        delete sessions["__local_manual__"];
        localManual = null;
      }
      // Consome já: mesmo se algo falhar adiante, não sobra para o próximo.
      if (localManual) delete sessions["__local_manual__"];

      let dataManual = sessions["__data_manual__"];
      if (dataManual && dataManual.em && (Date.now() - dataManual.em) > LOCAL_VALIDADE_MS) {
        console.log(`📅 [MANUAL] #data expirada (${dataManual.str}) — ignorada`);
        delete sessions["__data_manual__"];
        dataManual = null;
      }
      if (dataManual) delete sessions["__data_manual__"];

      if (session.orcamento) {
        if (dataManual) {
          session.orcamento.data = dataManual.str;
          console.log(`📅 [MANUAL] Data aplicada ANTES do envio: ${dataManual.str}`);
        }
        if (localManual) {
          session.orcamento.bairro = localManual.bairro;
          session.orcamento.cidade = localManual.cidade;
          console.log(`📍 [MANUAL] Local aplicado ANTES do envio: ${localManual.bairro || ''} / ${localManual.cidade}`);
        } else {
          // Sem #local nesta rodada: zera para não herdar do orçamento anterior.
          session.orcamento.deslocamento = null;
          session.orcamento.bairro = null;
          session.orcamento.cidade = null;
        }
      }

      for (const cmd of comandos) {
        controlaMsgManual++;
        await sendText(destinoOperador, `controlaMsgManual = ${controlaMsgManual}`);
      }

      for (const cmd of comandos) {
        console.log("⚙️ [MANUAL] Processando:", cmd);

        const nomeComando = cmd.split(" ")[0].toLowerCase();

        const parametrosTexto = cmd.replace(nomeComando, "")
          .trim()
          .replace(/[.;\s]+/g, ",");

        const parametros = parametrosTexto
          .split(",")
          .map(p => p.trim())
          .filter(p => p.length > 0);

        // ======================================================
        // COMANDO ESPECIAL: #tarefas — listar tarefas abertas
        // ======================================================
        if (nomeComando === "#tarefas") {
          await handleComandoTarefas(OPERADOR_TELEFONE_ID);
          controlaMsgManual2++;
          continue;
        }

        // ======================================================
        // COMANDO ESPECIAL: #ok ID — concluir tarefa
        // ======================================================
        if (nomeComando === "#ok") {
          const idTarefa = parametros[0] || cmd.split(" ")[1];
          await handleComandoOk(OPERADOR_TELEFONE_ID, idTarefa);
          controlaMsgManual2++;
          continue;
        }

        // ======================================================
        // COMANDO ESPECIAL: #fotoeucaristia paroquia,capela,data
        // ======================================================
        if (nomeComando === "#fotoeucaristia") {
          const paroquiaId = parseInt(parametros[0], 10);
          const capelaId = parseInt(parametros[1], 10);
          const dataEucaristia = parametros[2] || "a confirmar";
          try {
            await enviarEucaristiaManual(chatIdCliente, paroquiaId, capelaId, dataEucaristia);
            // Finaliza o fluxo — cliente não recebe mais nada do bot
            session.step = "aguardando_retorno";
            await sendText(destinoOperador, `✅ Informações de 1ª Eucaristia enviadas para *${chatIdCliente}*`);
          } catch (e) {
            await sendText(destinoOperador, `❌ Erro ao enviar Eucaristia: ${e.message}`);
          }
          controlaMsgManual2++;
          continue;
        }

        // ======================================================
        // COMANDO ESPECIAL: #todosorcamentos — manda TODOS os orçamentos
        // (mesma entrega enxuta do lembrete de 1h: avaliação + PDF/link de
        // cada serviço + resumo com todos os links). Serve para acionar na
        // mão os leads parados que não responderam ao follow-up.
        // Uso: #todosorcamentos            (usa o que já está na sessão)
        //      #todosorcamentos 9,200,5    (celebração, convidados, horas)
        // ======================================================
        if (nomeComando === "#todosorcamentos") {
          const clbP   = Number(parametros[0]) || null;
          const convP  = Number(parametros[1]) || null;
          const horasP = Number(parametros[2]) || null;

          session.orcamento = session.orcamento || {};
          if (clbP)   session.orcamento.celebracaoId = clbP;
          if (convP)  session.orcamento.convidados   = convP;
          if (horasP) session.orcamento.horas        = horasP;

          try {
            await enviarOrcamentosAutomaticos(chatIdCliente, session);
            await sendText(destinoOperador, `✅ Todos os orçamentos enviados para *${chatIdCliente}*`);
          } catch (e) {
            await sendText(destinoOperador, `❌ Erro ao enviar os orçamentos: ${e.message}`);
          }
          // return: `enviarOrcamentosAutomaticos` já mandou o fecho completo.
          // Com `continue`, o bloco pós-loop mandaria o fecho DE NOVO.
          return;
        }

        // ======================================================
        // COMANDO: #enviarfaltantes [HH:MM] — manda só os serviços que
        // AINDA NÃO foram enviados a este cliente. Sem hora, vai agora;
        // com hora, fica agendado para o horário de hoje (ou amanhã, se a
        // hora já passou). Nasceu do caso real das 23h40: a cliente pediu
        // todos os serviços, parte já tinha ido, e mandar o resto de
        // madrugada não faz sentido.
        // ======================================================
        if (nomeComando === "#enviarfaltantes") {
          const enviados = session.orcamento?.servicosEnviados || [];
          // Lista canônica (inclui o Totem Retrô); escrita à mão ela ficava velha
          // a cada serviço novo no menu.
          const faltantes = TODOS_SERVICOS.filter(s => !enviados.includes(s));

          if (!faltantes.length) {
            await sendText(destinoOperador, `✅ *${chatIdCliente}* já recebeu todos os serviços.`);
            return;
          }

          const hora = (parametros[0] || "").match(/^(\d{1,2}):?(\d{2})?$/);
          if (hora) {
            const h = String(hora[1]).padStart(2, "0");
            const m = String(hora[2] || "00").padStart(2, "0");

            /* Guarda o instante ABSOLUTO (ms), não o texto "HH:MM".
               Com texto, um agendamento para 22:00 nunca disparava: a
               comparação de string quebra na virada do dia. */
            const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
            let faltaMin = (Number(h) * 60 + Number(m)) - (agoraSP.getHours() * 60 + agoraSP.getMinutes());
            if (faltaMin <= 0) faltaMin += 24 * 60;   // já passou hoje → amanhã

            session.envioFaltantesEm = Date.now() + faltaMin * 60 * 1000;
            session.envioFaltantesHora = `${h}:${m}`;
            session.envioFaltantesCriadoEm = Date.now();
            // Onde confirmar quando o envio sair: no grupo, se foi agendado
            // no grupo; no DM do operador, se foi no privado.
            session.envioFaltantesDestino = destinoOperador;

            const madrugada = Number(h) >= 21 || Number(h) < 7;
            await sendText(destinoOperador,
              `⏰ Agendado: os *${faltantes.length} serviço(s)* que faltam vão para *${chatIdCliente}* às *${h}:${m}*`
              + (faltaMin > 12 * 60 ? " (amanhã)" : "") + "."
              + (madrugada ? "\n\n⚠️ Fora do horário comercial — o cliente vai receber nesse horário mesmo." : "")
            );
          } else {
            try {
              await enviarOrcamentosAutomaticos(chatIdCliente, session, faltantes);
              await sendText(destinoOperador,
                `✅ Enviados os *${faltantes.length} serviço(s)* que faltavam para *${chatIdCliente}*.`
              );
            } catch (e) {
              await sendText(destinoOperador, `❌ Erro ao enviar: ${e.message}`);
            }
          }
          /* return (e não continue): o bloco pós-loop dispara o FECHO do
             orçamento (resumo + parcelamento + vantagem + menu) quando
             controlaMsgManual === controlaMsgManual2. No teste de 11/08 isso
             fez o cliente receber o fecho na hora, mesmo com o envio AGENDADO
             para as 8h. Aqui o envio já é completo (ou nem aconteceu ainda),
             então nada deve rodar depois. */
          return;
        }

        // ======================================================
        // COMANDO: #cancelaragendamento — desmarca o envio agendado
        // pelo #enviarfaltantes (útil para testar de novo ou quando o
        // cliente responde antes da hora).
        // ======================================================
        if (nomeComando === "#cancelaragendamento" || nomeComando === "#cancelaragendamentos") {
          if (session.envioFaltantesEm) {
            const hora = session.envioFaltantesHora || "";
            delete session.envioFaltantesEm;
            delete session.envioFaltantesHora;
            delete session.envioFaltantesCriadoEm;
            await sendText(destinoOperador,
              `🚫 Agendamento das *${hora}* cancelado para *${chatIdCliente}*. Nada será enviado.`
            );
          } else {
            await sendText(destinoOperador,
              `ℹ️ *${chatIdCliente}* não tem envio agendado.`
            );
          }
          return;
        }

        if (!comandosServicos[nomeComando]) {
          await sendText(destinoOperador, `⚠ Comando não reconhecido: ${nomeComando}`);
          continue;
        }

        const servicoId = comandosServicos[nomeComando];

        // ✅ CORRETO: Primeiro parâmetro controla envio de avaliação
        const enviarAvaliacao = Number(parametros[0]) === 1;  // 1 = sim, 0 = não
        const celebracaoId = Number(parametros[1]) || 1;
        const convidados = Number(parametros[2]) || 50;
        const horas = Number(parametros[3]) || 4;
        let dias = Number(parametros[4]) || 1;

        if (celebracaoId !== 8) dias = 1;

        // Atualizar dados do evento
        session.orcamento = {
          ...session.orcamento,
          celebracaoId,
          convidados,
          horas,
          dias,
          servicosEnviados: session.orcamento.servicosEnviados || []
        };

        // ✅ Enviar avaliação UMA VEZ por lote se o operador solicitou (parâmetro 1)
        // Usa flag LOCAL para não depender do session.enviouAvaliacao do fluxo automático
        if (enviarAvaliacao && !avaliacaoEnviadaNesteLote) {
          console.log(`📊 Enviando avaliação da empresa (solicitado pelo operador)...`);
          await enviarAvaliacaoEmpresa(chatIdCliente, sessions);

          // Aguardar avaliação terminar
          while (session.enviandoAvaliacao) {
            await new Promise(r => setTimeout(r, 300));
          }

          avaliacaoEnviadaNesteLote = true;
          session.enviouAvaliacao = true;
        }

        // apenasOrcamento: manda só o preço (padrão novo). Com "+completo",
        // vai a apresentação inteira, como era antes.
        // ehUltimo/ehUltimoComMoldura ficam true = comportamento de hoje
        // (cada comando manda sua moldura); só a flag nova muda algo.
        sessions[chatIdCliente]._envioMultiplo = {
          apenasOrcamento:    !enviarCompleto,
          ehUltimo:           true,
          ehUltimoComMoldura: true,
          servicosNaLista:    [servicoId]
        };

        try {
          // ✅ IMPORTANTE: Passar modoManual=true para NÃO re-enviar avaliação
          await enviarOrcamentoUnificado(
            chatIdCliente,
            servicoId,
            celebracaoId,
            convidados,
            horas,
            dias,
            true  // modoManual=true
          );
        } finally {
          delete sessions[chatIdCliente]?._envioMultiplo;
        }

        controlaMsgManual2++;
        await sendText(destinoOperador, `controlaMsgManual2 = ${controlaMsgManual2}`);

        // 📌 REGISTRAR SERVIÇO ENVIADO
        registrarServicoEnviado(session, servicoId);
        if (!_servicosDoLote.includes(servicoId)) _servicosDoLote.push(servicoId);

        // Com "+completo" o cliente JÁ viu as fotos: marca como detalhado para
        // o menu não oferecer "mais detalhes" de algo que ele acabou de ver.
        if (enviarCompleto) registrarServicoDetalhado(session, servicoId);

        // 📌 INCREMENTAR CONTADOR        
        console.log(`📌 Processado ${controlaMsgManual} de ${comandos.length} comandos`);

        await new Promise(r => setTimeout(r, 500));

        console.log("📌 Cliente via destino do webhook:", controlaMsgManual);
        console.log("📌 Cliente via destino do webhook:", numeroCliente);
      }

      await sendText(destinoOperador, `controlaMsgManual = ${controlaMsgManual} e controlaMsgManual2 = ${controlaMsgManual2}`);

      /* 🧾 Orçamento GERADO no comando manual: também UM PDF SÓ, com todos os
         serviços migrados do lote (`#fotocabine ..., #totemretro ...` numa
         mensagem = 1 PDF com os dois). Roda depois do laço, quando a lista
         inteira já é conhecida, e depois do bloco de data/local acima, que é o
         que garante data e bairro DENTRO do PDF. */
      if (_servicosDoLote.length > 0) {
        await enviarOrcamentoGerado(chatIdCliente, session, _servicosDoLote);
      }

      // 🚗 Deslocamento do orçamento MANUAL (#local): consultado ANTES da
      // decisão do resumo, para valer nos dois caminhos.
      // O cliente PRECISA receber o deslocamento junto do orçamento, mesmo que
      // o resumo não rode (foi o que aconteceu: o fluxo parou no PDF e o valor
      // teve que ir na mão). Se o resumo for sair, ele já mostra o bloco; se
      // não, mandamos o deslocamento como mensagem própria — sem duplicar.
      // USO ÚNICO + validade de 30 min: o #local vale só para o orçamento
      // seguinte. Sem isso ele vazava para o próximo cliente (aconteceu em
      // 22/07: orçamento de Casamento saiu com o bairro do orçamento anterior).
      // 📌 A data e o local já foram resolvidos e consumidos ANTES do laço de
      // envio (ver o bloco no começo do bloco manual). Aqui só resta CALCULAR o
      // deslocamento e montar as mensagens.
      let textoDeslocManual = null;

      if (localManual) {
        await consultarDeslocamento(session);
        const d = session.orcamento.deslocamento;

        if (d && d.gratis) {
          textoDeslocManual =
            "\n🚗 *Deslocamento GRÁTIS!* 🎉\n" +
            `Este mês estamos com uma *condição super especial* para eventos em *${d.cidade}*: ` +
            "o deslocamento está saindo *Grátis*!";
        } else if (d && d.estimado && d.valor > 0) {
          const v = Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          textoDeslocManual =
            "\n🚗 *Deslocamento*\n" +
            `Para *${d.cidade || d.bairro}*, o deslocamento fica em torno de *R$ ${v}*.\n` +
            "É um valor aproximado, a gente confirma certinho no fechamento do seu orçamento! 😊";
        } else if (d && d.valor > 0) {
          const v = Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          textoDeslocManual =
            "\n🚗 *Deslocamento*\n" +
            `Deslocamento para *${d.bairro ? d.bairro + " — " : ""}${d.cidade}*: ` +
            `Valor do Pacote Escolhido + *R$ ${v}*`;
        }

        await sendText(
          destinoOperador,
          d
            ? `🚗 Deslocamento aplicado: *${d.gratis ? "GRÁTIS" : "R$ " + d.valor}*` +
              `${d.estimado ? ` (estimado por distância, ${d.km} km)` : " (tabela)"}`
            : `⚠ Não consegui calcular o deslocamento para *${localManual.cidade}*. O orçamento vai sem o valor.`
        );
      }

      const vaiTerResumo = (controlaMsgManual === controlaMsgManual2 && session.orcamento.servicosEnviados.length > 0);

      // Rede de segurança: sem resumo, o deslocamento vai sozinho ao cliente.
      if (textoDeslocManual && !vaiTerResumo) {
        await sendTyping(chatIdCliente);
        await sendText(chatIdCliente, textoDeslocManual.trim());
      }

      if (vaiTerResumo) {
        // 📌 AGUARDAR UM POUCO ANTES DO RESUMO
        await new Promise(r => setTimeout(r, 800));

        // 📌 ENVIAR RESUMO DO EVENTO PARA O CLIENTE (já inclui o deslocamento)
        await enviarResumoCliente(chatIdCliente, session);

        // 📌 MENSAGENS FINAIS PARA O CLIENTE
        await new Promise(r => setTimeout(r, 500));
        await sendTyping(chatIdCliente);
        await sendText(chatIdCliente, "Perfeito! Qualquer dúvida estou por aqui 😊");

        await new Promise(r => setTimeout(r, 300));

        await sendTyping(chatIdCliente);
        await sendText(chatIdCliente, "Deus abençoe você e sua família, grandiosamente!!!");

        // Menu pós-orçamento, igual ao fluxo automático (antes o manual
        // terminava sem menu e o cliente ficava sem caminho). O menu é
        // dinâmico: com "+completo" ele não oferece detalhes do que o cliente
        // acabou de ver.
        await perguntarPosOrcamento(chatIdCliente, session);

        // 📌 ENVIAR RESUMO PARA O OPERADOR
        await new Promise(r => setTimeout(r, 500));
        await enviarResumoOperador(chatIdCliente, session, nomeOperador(remetenteReal));

        // 📌 REPAUSAR SE ESTAVA PAUSADO
        if (estavaPausado) pausarCliente(chatIdCliente);

        await sendText(
          destinoOperador,
          `✅ Orçamento manual enviado para *${chatIdCliente}*`
        );
      }

      // 🚨 DESATIVAR FLAG DE ENVIO MANUAL - ACEITAR MENSAGENS DO CLIENTE NOVAMENTE
      session.enviandoOrcamentosManualmente = false;

      return;
    }
  }  

  // ======================================================
  // ✅ VERIFICAR PAUSA ESPECIAL (BLOQUEIA FLUXO NORMAL)
  // ======================================================
  if (!isOperador && estaPausadoEspecial(chatId)) {
    console.log(`🔒 Cliente em pausa especial permanente: ${chatId}`);
    return;  // Bloqueia fluxo normal APENAS para cliente
  }

  // ======================================================
  // 🛡️ ANTI-LOOP — para o ping-pong com outro chatbot
  // ======================================================
  if (!isOperador) {
    const veredito = registrarMensagemAntiLoop(chatId, corpoMensagem);
    if (veredito.bloquear) {
      pausarCliente(chatId);
      console.log(`🛑 ANTI-LOOP: ${chatId} pausado automaticamente (${veredito.motivo})`);
      try {
        await sendText(
          OPERADOR_TELEFONE_ID,
          `🛑 *Anti-loop acionado*\n\n` +
          `Pausei automaticamente o número *${chatId}*.\n` +
          `Motivo: ${veredito.motivo}.\n\n` +
          `Isso costuma ser outro chatbot respondendo sozinho. ` +
          `Se for cliente de verdade, libere com:\n*retomar ${chatId}*`
        );
      } catch (e) {
        console.error(`⚠️ Falha ao avisar operador do anti-loop: ${e.message}`);
      }
      return; // bot fica mudo a partir daqui
    }
  }

  // ======================================================
  // IMPEDIR QUE O OPERADOR CAIA NO FLUXO DO CLIENTE
  // ======================================================
  if (isOperador) {
    console.log("👨‍💼 Mensagem do operador ignorada após comandos.");
    return;
  }

  // ======================================================
  // 📸 ATALHO DA FOTO POR CÓDIGO (Lumen Capture)
  // Roda ANTES da máquina de estados: quem escaneia o QR na cabine já vem
  // com "Código: XXXXXX" e recebe o link na hora, mesmo com o menu aberto.
  // ======================================================
  try {
    if (await tratarCodigoFoto(chatId, corpoMensagem, sessions[chatId])) return;
  } catch (e) {
    console.error("❌ Falha no atalho da foto por código:", e.message);
    // A mensagem TEM código de foto: se falhar, avisa o convidado em vez de
    // deixar a mensagem cair no menu (foi o que aconteceu no teste de 30/07).
    if (temCodigoFoto(corpoMensagem)) {
      await sendText(chatId, "Tive um problema para buscar suas fotos 😕 Chame o nosso operador no evento, por favor.");
      return;
    }
  }

  // ======================================================
  // CONTROLE DE MENSAGENS DUPLICADAS
  // ======================================================

  // tenta pegar um identificador estável da Z-API
  const stableId =
    message.messageId ||
    message.id ||
    message.data?.messageId ||
    message.data?.id ||
    message.timestamp ||
    message.messageTimestamp ||
    message.data?.timestamp ||
    null;

  // monta chave única
  const chaveUnica = stableId
    ? `${chatId}-${stableId}`
    : `${chatId}-${corpoNormalizado}`;

  // evita bloquear eventos sem texto quando não houver id
  if (!stableId && !corpoNormalizado) return;

  if (mensagensProcessadas.has(chaveUnica)) {
    console.log(`⚠️ Mensagem duplicada ignorada: ${chaveUnica}`);
    return;
  }

  mensagensProcessadas.add(chaveUnica);
  setTimeout(() => mensagensProcessadas.delete(chaveUnica), 60000);

  // ======================================================
  // IGNORAR GRUPOS E NEWSLETTERS
  // ======================================================
  if (message.isGroup === true) {
    console.log("⚠️ Ignorando mensagem de grupo:", chatId);
    return;
  }

  if (message.isNewsletter === true) {
    console.log("⚠️ Ignorando newsletter:", chatId);
    return;
  }

  // ======================================================
  // BLOQUEIO DO CLIENTE PAUSADO
  // ======================================================
  if (estaPausado(chatIdNormalizado)) {
    console.log(`⏸ Cliente ${chatIdNormalizado} está pausado. Mensagem ignorada.`);
    return;
  }

  // ======================================================
  // BLOQUEAR MENSAGENS DURANTE ENVIO MANUAL DE ORÇAMENTOS
  // ======================================================
  if (sessions[chatId] && sessions[chatId].enviandoOrcamentosManualmente) {
    console.log(`🚫 Cliente ${chatId} enviou mensagem durante envio manual. Ignorando até completar.`);
    return; // ✅ Apenas ignora, sem enviar mensagem
  }

  // ======================================================
  // CRIAÇÃO DE SESSÃO
  // ======================================================
  if (!sessions[chatId]) {
    console.log(`🆕 Criando sessão para cliente ${chatId}`);

    sessions[chatId] = {
      step: "aguardando_opcao",
      menuInicialEnviado: false,

      enviouAvaliacao: false,
      enviouApresentacao: false,
      primeiraRodadaFinalizada: false,
      segundaRodadaFinalizada: false,
      orcamento: { servicosEnviados: [] },
      servicosEnviados: [],
      enviandoAvaliacao: false,
      processandoServico: false,
      enviandoOrcamentos: false,
      ultimaInteracao: Date.now(),
      lembreteOrcamentoEnviado: false,
      ultimaPerguntaNaoRespondida: null
    };

    await mostrarMenuInicial(chatId);
    return;
  }

  // ======================================================
  // SESSÃO FINALIZADA — ignora silenciosamente
  // (evita reenvio do menu inicial após término do orçamento)
  // ======================================================
  if (sessions[chatId]?.step === "finalizado") {
    // O cliente escolheu ENCERRAR (opção "por enquanto é só"), mas os botões do
    // menu pós-orçamento continuam na tela dele. Se depois ele clicar/enviar
    // "1" (mais detalhes) ou "2" (mais orçamento), REABRE o fluxo em vez de
    // ficar mudo (pedido do Mario 26/07). Qualquer outra coisa segue ignorada.
    const sFin   = sessions[chatId];
    const optsFin = sFin._menuPos || [];
    const escFin  = optsFin.find(o => o.id === String(corpoMensagem).trim());
    if (escFin && (escFin.acao === "detalhes" || escFin.acao === "orcamento")) {
      sFin.step = "orcamento_pos";
      sFin.tentativasInvalidasPos = 0;
      sFin.ultimaInteracao = Date.now();
      console.log(`🔄 Reativando pós-orçamento p/ ${chatId} (escolheu "${escFin.acao}" após encerrar).`);
      await processarOrcamentoPos(chatId, sFin, corpoMensagem);
      return;
    }
    console.log(`ℹ️ Sessão finalizada para ${chatId}. Mensagem ignorada.`);
    return;
  }

  const session = sessions[chatId];
  session.ultimaInteracao = Date.now();

  // ======================================================
  // FALLBACK: se step estiver vazio/inválido, reabre o menu
  // (evita o "Nenhum fluxo correspondente..." quando sessão foi criada por envio manual)
  // ======================================================
  if (!session.step) {
    console.log(`🧭 Step vazio para ${chatId}. Reenviando menu inicial.`);
    await mostrarMenuInicial(chatId);
    return;
  }

  // ======================================================
  // GUARD — fluxo encerrado por follow-up (Camada A)
  // O cliente não finalizou, o follow-up chegou e encerrou o fluxo
  // antigo para a resposta não colidir. Bot fica quieto e avisa o
  // operador na 1ª resposta do cliente, para ele assumir.
  // ======================================================
  if (session.step === "pausado_followup") {
    if (!session.avisouOperadorFollowup) {
      session.avisouOperadorFollowup = true;
      try {
        await sendText(
          OPERADOR_TELEFONE_ID,
          `📩 *Cliente respondeu após follow-up*\n` +
          `${chatId}\n` +
          `_"${corpoMensagem}"_\n\n` +
          `O fluxo automático foi encerrado — *assuma o atendimento* por aqui.`
        );
      } catch (e) { console.warn(`⚠️ aviso operador follow-up: ${e.message}`); }
    }
    console.log(`🔒 ${chatId} em pausado_followup. Operador avisado, bot não responde.`);
    return;
  }

  // ======================================================
  // GUARD — fluxo pausado por excesso de erros (Etapa 2)
  // O operador já foi avisado no momento da pausa; bot fica mudo.
  // ======================================================
  if (session.step === "pausado_fluxo") {
    console.log(`🔒 ${chatId} em pausado_fluxo. Operador já avisado, bot não responde.`);
    return;
  }

  // ======================================================
  // GUARD — fluxo finalizado, não processar mais mensagens
  // ======================================================
  if (session.step === "aguardando_retorno") {
    console.log(`🔒 ${chatId} em aguardando_retorno. Mensagem ignorada.`);
    return;
  }

  // ======================================================
  // MENU INICIAL
  // ======================================================
  if (session.step === "aguardando_opcao") {
  const texto = (corpoMensagem || "").trim();
  const opcaoMenu = texto.replace(/\D+/g, ""); // pega só números

  // ✅ PRIMEIRO CONTATO REAL:
  // se o menu ainda não foi enviado, a primeira mensagem do cliente SEMPRE recebe boas-vindas.
  // - Se ele mandou texto (sem número): envia menu e para.
  // - Se ele mandou "1..7": envia menu e já processa a opção na mesma mensagem (sem exigir repetir).
  if (!session.menuInicialEnviado) {
    await mostrarMenuInicial(chatId);

    // se veio número junto (ex.: "1"), continua e processa abaixo
    if (opcaoMenu === "") return;
  }

  // ✅ CONFIRMAÇÃO DA OPÇÃO: antes de entrar no fluxo, o cliente confirma
  // que escolheu mesmo aquela opção (evita digitar 2 em vez de 1 e cair
  // no fluxo errado, precisando resetar a sessão).
  if (["1","2","3","4","5","6","7"].includes(opcaoMenu)) {
    session.opcaoMenuPendente = opcaoMenu;
    session.step = "confirmar_opcao_menu";
    await sendTyping(chatId);
    await sendButtonList(
      chatId,
      `Só pra confirmar 😊 você escolheu:\n\n*${LABELS_MENU[opcaoMenu]}*\n\nEstá certo?`,
      [
        { id: "1", label: "Sim, é isso" },
        { id: "2", label: "Quero outra opção" }
      ]
    );
    return;
  }

  // Texto puro (ex.: "oi") → reenvia boas-vindas; número inválido → avisa
  if (opcaoMenu === "") {
    session.menuInicialEnviado = false;
    await mostrarMenuInicial(chatId);
  } else {
    await sendText(
      chatId,
      "*⚠ Opção inválida!* Escolha uma das opções do menu digitando apenas o número: *(Digite somente número)*\n\n" +
      mensagemBoasVindas3.split("\n").slice(2).join("\n")
    );
  }
  return;
  }

  // ======================================================
  // CONFIRMAÇÃO DA OPÇÃO DO MENU
  // ======================================================
  if (session.step === "confirmar_opcao_menu") {
    const resp = (corpoMensagem || "").replace(/\D+/g, "");

    if (resp === "1") {
      const op = session.opcaoMenuPendente;
      session.opcaoMenuPendente = null;
      await executarOpcaoMenu(chatId, session, op, chatIdNormalizado);
      return;
    }

    if (resp === "2") {
      session.opcaoMenuPendente = null;
      session.step = "aguardando_opcao";
      session.menuInicialEnviado = true;
      await sendTyping(chatId);
      await sendText(chatId, "Sem problema! 😊 Escolha a opção desejada:");
      await sendTyping(chatId);
      await sendText(chatId, mensagemBoasVindas3);
      return;
    }

    // resposta inválida na confirmação
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Por favor, responda apenas *1* (Sim, é isso) ou *2* (Não, escolher outra opção). 😊"
    );
    return;
  }

  // ======================================================
  // SELEÇÃO DE EVENTO
  // ======================================================
  if (session.step === "aguardando_numero_evento") {
    const numero = corpoMensagem.trim();
    const evento = session.eventosLista?.find(e => e.numero === numero);

    if (!evento) {
      let mensagemErro = "⚠️ Opção inválida! Digite apenas o número do evento:\n\n";
      (session.eventosLista || []).forEach((e) => {
        mensagemErro += `*${e.numero}* - ${e.nome}\n`;
      });
      await sendTyping(chatId);
      await sendText(chatId, mensagemErro);
      return;
    }

    await sendTyping(chatId);
    await sendText(chatId, await apresentarEvento(numero, chatId));

    // ✅ “Encerra” o atendimento do convidado:
    // volta pro menu, mas força que a PRÓXIMA mensagem dispare boas-vindas novamente
    session.step = "aguardando_opcao";
    session.eventosLista = null;
    session.menuInicialEnviado = false; // ✅ chave da correção
    return;
  }

// ======================================================
// EUCARISTIA — NOME RESPONSÁVEL
// ======================================================
if (session.step === "eucaristia_nome") {
  const nome = capitalizarPalavras(corpoMensagem);
  if (!nome || nome.length < 2) {
    await sendText(chatId, "*⚠ Informe um nome válido.*");
    return;
  }

  session.eucaristia.nomeResponsavel = nome;
  session.step = "eucaristia_paroquia";

  await sendTyping(chatId);
  // 🧪 TESTE DE BOTÕES (2026-07-15): a 1ª Eucaristia é o laboratório porque o
  // fluxo está parado até 2027 — se a lista falhar, ninguém perde venda.
  // O público aqui é o mesmo da paróquia (pais, avós, catequistas), e o
  // sendOptionList já leva o menu numerado no texto: quem não vir a lista
  // digita o número como sempre.
  await sendOptionList(
    chatId,
    "Por favor, escolha a Paróquia que seu filho faz catequese:",
    Object.keys(paroquiasEucaristia).map(k => ({
      id: String(k),
      title: paroquiasEucaristia[k].nome
    })),
    { title: "Paróquias", buttonLabel: "Ver paróquias" }
  );
  return;
}

// ======================================================
// EUCARISTIA — PARÓQUIA
// ======================================================
if (session.step === "eucaristia_paroquia") {
  const opcao = parseInt(corpoMensagem.replace(/\D+/g, ""), 10);

  if (![1, 2].includes(opcao)) {
    await sendText(chatId, "*⚠ Opção inválida! Digite 1 ou 2.*");
    return;
  }

  session.eucaristia.paroquiaId = opcao;
  session.eucaristia.paroquiaNome = paroquiasEucaristia[opcao].nome;
  session.step = "eucaristia_capela";

  const capelas = paroquiasEucaristia[opcao].capelas;

  await sendTyping(chatId);
  // Lista montada dinamicamente (5 capelas na São José, 3 na São Sebastião).
  // É o mesmo padrão que o menu da paróquia vai usar — por isso este passo é
  // o mais valioso do teste.
  await sendOptionList(
    chatId,
    "Qual a Capela?",
    Object.keys(capelas).map(k => ({ id: String(k), title: capelas[k] })),
    { title: "Capelas", buttonLabel: "Ver capelas" }
  );
  return;
}

// ======================================================
// EUCARISTIA — CAPELA
// ======================================================
if (session.step === "eucaristia_capela") {
  const paroquiaId = session.eucaristia?.paroquiaId;
  const capelas = paroquiasEucaristia[paroquiaId]?.capelas || {};

  const opcao = parseInt(corpoMensagem.replace(/\D+/g, ""), 10);

  if (!capelas[opcao]) {
    await sendText(chatId, "*⚠ Capela inválida! Digite um número da lista.*");
    return;
  }

  session.eucaristia.capelaId = opcao;
  session.eucaristia.capelaNome = capelas[opcao];
  session.step = "eucaristia_qtd_criancas";

  await sendTyping(chatId);
  await sendText(chatId, "Você tem quantas crianças na catequese? (*Digite somente número*)");
  return;
}

// ======================================================
// EUCARISTIA — QUANTIDADE DE CRIANÇAS
// ======================================================
if (session.step === "eucaristia_qtd_criancas") {
  const qtd = parseInt(corpoMensagem.replace(/\D+/g, ""), 10);

  if (isNaN(qtd) || qtd <= 0) {
    await sendText(chatId, "*⚠ Digite apenas um número válido.*");
    return;
  }

  session.eucaristia.qtdCriancas = qtd;

  if (qtd === 1) {
    session.step = "eucaristia_nome_crianca";
    await sendTyping(chatId);
    await sendText(chatId, "Qual o nome da Criança?");
    return;
  }

  session.step = "eucaristia_nomes_criancas";
  await sendTyping(chatId);
  await sendText(chatId, "Quais os nomes das Crianças? (*Separe por vírgula*)");
  return;
}

// ======================================================
// EUCARISTIA — NOME DA CRIANÇA (1)
// ======================================================
if (session.step === "eucaristia_nome_crianca") {
  const nomeCrianca = capitalizarPalavras(corpoMensagem);

  if (!nomeCrianca || nomeCrianca.length < 2) {
    await sendText(chatId, "*⚠ Informe um nome válido.*");
    return;
  }

  session.eucaristia.nomesCriancas = [nomeCrianca];
  session.step = "eucaristia_catequista";

  await sendTyping(chatId);
  await sendText(chatId, "Qual o nome do(a) Catequista?");
  return;
}

// ======================================================
// EUCARISTIA — NOMES DAS CRIANÇAS (2+)
// ======================================================
if (session.step === "eucaristia_nomes_criancas") {
  const nomes = corpoMensagem
    .split(",")
    .map(n => capitalizarPalavras(n.trim()))
    .filter(n => n.length >= 2);

  if (nomes.length === 0) {
    await sendText(chatId, "*⚠ Informe pelo menos um nome válido (separe por vírgula).*");
    return;
  }

  session.eucaristia.nomesCriancas = nomes;
  session.step = "eucaristia_catequista";

  await sendTyping(chatId);
  await sendText(chatId, "Qual o nome do(a) Catequista?");
  return;
}

// ======================================================
// EUCARISTIA — CATEQUISTA + ENVIO FINAL
// ======================================================
if (session.step === "eucaristia_catequista") {
  const catequista = capitalizarPalavras(corpoMensagem);

  if (!catequista || catequista.length < 2) {
    await sendText(chatId, "*⚠ Informe um nome válido.*");
    return;
  }

  session.eucaristia.catequista = catequista;

  // ======================================================
  // EUCARISTIA — RESUMO (para conferência)
  // ======================================================
  const nomesCriancas = Array.isArray(session.eucaristia.nomesCriancas)
    ? session.eucaristia.nomesCriancas.join(", ")
    : "";

  // define singular ou plural automaticamente
const labelCriancas =
  session.eucaristia.qtdCriancas === 1
    ? "Criança na catequese"
    : "Crianças na catequese";

const resumoEucaristia =
  `*${session.eucaristia.nomeResponsavel || "Cliente"}*, aqui está o resumo da sua solicitação:\n\n` +
  `* Responsável: *${session.eucaristia.nomeResponsavel || "-"}*\n` +
  `* Paróquia: *${session.eucaristia.paroquiaNome || "-"}*\n` +
  `* Capela: *${session.eucaristia.capelaNome || "-"}*\n` +
  `* ${labelCriancas}: *${session.eucaristia.qtdCriancas || "-"}*\n` +
  `* Nome(s) da(s) criança(s): *${nomesCriancas || "-"}*\n` +
  `* Catequista: *${session.eucaristia.catequista || "-"}*`;

  await sendTyping(chatId);
  await sendText(chatId, resumoEucaristia);

  await sendTyping(chatId);
  await sendText(chatId, "💰 Segue o arquivo com o orçamento da *Cobertura Fotográfica* 📸✨");

  // tenta enviar como arquivo, e se não der, segue com o link
  try {
    await sendTyping(chatId);
    await sendFileByUrl(chatId, EUCARISTIA_PDF_URL, "DOCUMENT", "");
  } catch (e) {
    console.log("⚠️ Falha ao enviar PDF como arquivo, enviando apenas link:", e?.message || e);
  }

  await sendTyping(chatId);
  await sendText(
    chatId,
    "🔗 Caso tenha dificuldade para baixar o PDF, aqui está o link direto:\n" +
    EUCARISTIA_PDF_URL
  );

  await sendTyping(chatId);
  await sendText(
    chatId,
    "Segue o link do formulário com os dados para preencher contrato do Serviço de Cobertura Fotográfica:\n" +
    EUCARISTIA_FORM_URL
  );
  
  await sendTyping(chatId);
  await sendText(
    chatId,
    "💚 Segue o link para pagamento via *PIX* para o Serviço de Cobertura Fotográfica:\n" +
    EUCARISTIA_PIX_URL
  );

  await sendTyping(chatId);
  await sendText(
    chatId,
    "💳 Segue o link para pagamento via *Cartão de Crédito* para o Serviço de Cobertura Fotográfica:\n" +
    EUCARISTIA_CARTAO_URL
  );

  await sendTyping(chatId);
  await sendText(chatId, "Por favor, pedimos para informe quando o formulário estiver preenchido.");

  await sendTyping(chatId);
  await sendText(chatId, "Enviaremos o contrato assinado com a forma de pagamento escolhida.");

  // =========================
  // PRAZOS DE PAGAMENTO POR PARÓQUIA
  // =========================
  if (session.eucaristia.paroquiaId === 2) {
    // Paróquia São Sebastião
    await sendTyping(chatId);
    await sendText(chatId, "⚠️ Informamos que o pagamento do serviço deverá estar quitado até a data da 1ª Eucaristia.");
  }

  if (session.eucaristia.paroquiaId === 1) {
    // Paróquia São José
    await sendTyping(chatId);
    await sendText(chatId, "⚠️ Informamos que o pagamento do serviço deverá estar quitado até o dia *05/05/2026*.");
  }

  await sendTyping(chatId);
  await sendText(chatId, "Perfeito! Qualquer dúvida estou por aqui 😊");

  await sendTyping(chatId);
  await sendText(chatId, "Deus abençoe você e sua família, grandiosamente!!!");

  // Finaliza o fluxo — bot não responde mais mensagens deste cliente
  session.step = "aguardando_retorno";
  return;
}

  // ======================================================
  // ORÇAMENTO — NOME
  // ======================================================
  if (session.step === "orcamento_nome") {
    const nome = capitalizarPalavras(corpoMensagem);

    if (!nome || nome.length < 2) {
      await sendText(chatId, "*⚠ Informe um nome válido.*");
      return;
    }

    session.orcamento.nome = nome;
    session.step = "orcamento_nome_confirmar";

    await sendTyping(chatId);
    await sendButtonList(
      chatId,
      `Seu nome é *${nome}*?`,
      [
        { id: "1", label: "Sim" },
        { id: "2", label: "Não" }
      ]
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — CONFIRMAÇÃO DO NOME
  // ======================================================
  // ======================================================
  // RETOMADA APÓS O ENVIO AUTOMÁTICO DOS ORÇAMENTOS
  // (lembrete de 1h mandou tudo e perguntou se quer personalizar)
  // ======================================================
  if (session.step === "lembrete_retomar") {
    const r = (corpoMensagem || "").trim().toLowerCase();

    if (r === "1" || r.startsWith("sim")) {
      session.step = session.lembreteRetomarStep || "orcamento_nome";
      const perg = session.lembreteRetomarPergunta;
      await sendTyping(chatId);
      await sendText(chatId, "Que bom! ❤️ Vamos continuar de onde paramos.");
      if (perg) {
        await sendTyping(chatId);
        await sendText(chatId, perg);
        session.ultimaPerguntaNaoRespondida = perg;
      }
      return;
    }

    if (r === "2" || r.startsWith("nao") || r.startsWith("não") || r.startsWith("agora")) {
      session.step = "aguardando_opcao";
      await sendTyping(chatId);
      await sendText(chatId,
        "Tudo bem! 😊 Os orçamentos ficam aí com você, sem pressa e sem compromisso.\n\n" +
        "Quando quiser, é só me chamar que eu monto um do seu jeitinho. ❤️"
      );
      return;
    }

    await sendButtonList(
      chatId,
      "Só me diz: quer um orçamento *personalizado* para o seu evento?",
      [{ id: "1", label: "Sim, quero" }, { id: "2", label: "Agora não" }]
    );
    return;
  }

  if (session.step === "orcamento_nome_confirmar") {
    const respNome = corpoMensagem.trim();

    if (respNome !== "1" && respNome !== "2") {
      await sendText(chatId, "*⚠ Responda com o número da opção:*\n*1* - Sim\n*2* - Não");
      return;
    }

    if (respNome === "2") {
      session.orcamento.nome = null;
      session.step = "orcamento_nome";
      await sendTyping(chatId);
      await sendText(chatId, "Sem problemas! Qual o seu nome?");
      return;
    }

    session.step = "orcamento_celebracao";

    // Apresentação da empresa (2026-08-05, pedido do Mario): saiu da abertura
    // (que virou 1 msg só com o menu) e passou p/ DEPOIS da confirmação do nome,
    // já chamando a pessoa pelo nome. É onde o cliente demonstrou interesse real.
    await sendTyping(chatId);
    await sendText(chatId, `*${session.orcamento.nome}*, somos uma família que atende famílias ❤️`);

    await sendTyping(chatId);
    await sendText(chatId, "Temos o compromisso de atender aos nossos clientes e a cada convidado do seu evento, com muito amor, carinho e atenção.");

    await sendTyping(chatId);
    await sendText(chatId, "A *PhotoMusic Produções* está há 15 anos transformando eventos em memórias inesquecíveis.");

    await sendTyping(chatId);
    await sendText(chatId, "Agora, me fale um pouco sobre o seu evento");

    await sendTyping(chatId);
    // 9 opções: cabe na lista (limite 10). O menu numerado vai no corpo pelo
    // sendOptionList, então quem não vê a lista digita como sempre.
    await sendOptionList(
      chatId,
      "O que vai celebrar?",
      CELEBRACOES.map(c => ({ id: String(c.id), title: c.label })),
      { title: "Celebrações", buttonLabel: "Ver opções" }
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — CELEBRAÇÃO
  // ======================================================
  if (session.step === "orcamento_celebracao") {
    const opcao = parseInt(corpoMensagem, 10);

    if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(opcao)) {
      await sendText(chatId, "*⚠ Opção inválida! Digite um número válido.*");
      return;
    }

    if (opcao === 9) {
      session.step = "orcamento_celebracao_outros";
      await sendTyping(chatId);
      await sendText(chatId, "Por favor, descreva o que você vai celebrar:");
      return;
    }

    session.orcamento.celebracao = celebracoes[opcao];
    session.orcamento.celebracaoId = opcao;

    /* 🚨 CORPORATIVO PERGUNTA O NOME DA EMPRESA (Mario, 19/08/2026).
       Sem isso a proposta de evento de empresa saía no nome da PESSOA que
       pediu (caso CIS Brasil: "Proposta-Liz-Santiago" para um orçamento do
       setor de Compras). O fluxo do bot nunca coletava esse dado, então
       corporativo pelo WhatsApp caía sempre no "Evento-Corporativo".
       É a ÚNICA celebração que ganha pergunta a mais, de propósito: em evento
       social não existe empresa e a pergunta só atrapalharia. */
    if (opcao === 8) {
      session.step = "orcamento_empresa";
      await enviarPerguntaESalvar(chatId, session, "Qual o *nome da empresa*? (se preferir não informar, digite *pular*)");
      return;
    }

    session.step = "orcamento_convidados";

    await enviarPerguntaESalvar(chatId, session, "Quantos convidados?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — CELEBRAÇÃO OUTROS
  // ======================================================
  // ======================================================
  // ORÇAMENTO — NOME DA EMPRESA (só no corporativo)
  // ======================================================
  if (session.step === "orcamento_empresa") {
    const txt   = String(corpoMensagem || "").trim();
    const pulou = txt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === "pular";

    /* Nome de empresa curto demais quase sempre é erro de digitação, e o nome
       vai para o ARQUIVO da proposta que o cliente recebe. Melhor perguntar de
       novo do que mandar "Proposta-PhotoMusic-Producoes-X.pdf". */
    if (!pulou && txt.length < 2) {
      await sendText(chatId, "*⚠ Não entendi o nome da empresa.* Digite o nome, ou *pular* se preferir não informar.");
      return;
    }

    session.orcamento.empresa = pulou ? "" : capitalizarPalavras(txt);
    session.step = "orcamento_convidados";

    await enviarPerguntaESalvar(chatId, session, "Quantos convidados? (*Digite somente número*)");
    return;
  }

  if (session.step === "orcamento_celebracao_outros") {
    session.orcamento.celebracao = corpoMensagem;
    session.orcamento.celebracaoId = 9;
    session.step = "orcamento_convidados";

    await enviarPerguntaESalvar(chatId, session, "Quantos convidados? (*Digite somente número*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — CONVIDADOS
  // ======================================================
  if (session.step === "orcamento_convidados") {
    const convidados = parseInt(corpoMensagem.replace(/\D+/g, ""), 10);

    if (isNaN(convidados) || convidados <= 0) {
      await sendText(chatId, "*⚠ Digite apenas números válidos.*");
      return;
    }

    session.orcamento.convidados = convidados;

    // Corporativo (8) e Outros (9) → perguntar dias ANTES da data
    const clbConv = session.orcamento.celebracaoId;
    if (clbConv === 8 || clbConv === 9) {
      session.step = "orcamento_dias";
      await enviarPerguntaESalvar(chatId, session,
        "Quantos dias de evento? *(Digite somente o número)*"
      );
      return;
    }

    session.step = "orcamento_data";
    await enviarPerguntaESalvar(chatId, session, "Qual a data do evento? (Ex: *01/02/2026* ou *9 de setembro*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — QUANTOS DIAS (corporativo/outros, antes da data)
  // ======================================================
  if (session.step === "orcamento_dias") {
    const txtDias = corpoMensagem.trim();

    // Aceita somente dígitos — "20/01" (data) ou texto são rejeitados
    if (!/^\d+$/.test(txtDias)) {
      await sendText(chatId, "*⚠ Digite apenas o número de dias.* (Ex: *2*)");
      return;
    }

    const dias = parseInt(txtDias, 10);

    if (dias <= 0 || dias > 90) {
      await sendText(chatId, "*⚠ Quantidade de dias inválida!* Digite um número entre *1* e *90*.");
      return;
    }

    session.orcamento.dias = dias;

    if (dias === 1) {
      // 1 dia → fluxo normal de data/horário
      session.step = "orcamento_data";
      await enviarPerguntaESalvar(chatId, session, "Qual a data do evento? (Ex: *01/06/2026* ou *9 de setembro*)");
      return;
    }

    // Mais de 1 dia → verificar se horários são iguais
    session.step = "orcamento_horarios_iguais";
    await sendTyping(chatId);
    await sendButtonList(
      chatId,
      `Seu evento terá *${dias} dias*. 📅\n\n` +
      `Os horários de início e término serão os *mesmos em todos os dias*?`,
      [
        { id: "1", label: "Sim, são iguais" },
        { id: "2", label: "Variam por dia" }
      ]
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORÁRIOS IGUAIS PARA TODOS OS DIAS?
  // ======================================================
  if (session.step === "orcamento_horarios_iguais") {
    const resp = interpretarSimNao(corpoMensagem);

    if (!resp) {
      await sendText(chatId,
        "*⚠ Responda com o número da opção:*\n*1* - Sim\n*2* - Não"
      );
      return;
    }

    if (resp === "1") {
      // Mesmos horários → pedir todas as datas e depois horário padrão
      session.step = "orcamento_datas_multiplas";
      await sendTyping(chatId);
      await sendText(
        chatId,
        `📅 Seu evento tem *${session.orcamento.dias} dias*. Você *não precisa digitar data por data* 😊\n\n` +
        `Pode me mandar de um jeito só:\n\n` +
        `• *Datas seguidas (intervalo):*\n   01/08/2026 a 08/08/2026\n` +
        `• *Datas separadas:*\n   01/08/2026, 03/08/2026, 05/08/2026\n` +
        `• *Misturando as duas:*\n   01 a 03/08/2026, 07/08/2026\n\n` +
        `Pode abreviar também: *30/8 a 6/9/26*.`
      );
      return;
    }

    // Horários diferentes → coletar data+hora por dia
    session.orcamento.diasDetalhes = [];
    session.orcamento.diaAtual    = 1;
    session.step = "orcamento_dia_data";
    await sendTyping(chatId);
    await sendText(
      chatId,
      `📅 *Dia 1 de ${session.orcamento.dias}*\n` +
      `Qual a data? *(Ex: 01/06/2026)*`
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — DATAS MÚLTIPLAS (mesmos horários)
  // ======================================================
  if (session.step === "orcamento_datas_multiplas") {
    const datas = extrairDatasCorporativas(corpoMensagem);

    if (!datas.length) {
      await sendText(chatId,
        "*⚠ Não consegui entender as datas.*\n\n" +
        "Você pode mandar um *intervalo* (ex: *01/08/2026 a 08/08/2026*), " +
        "*datas separadas* por vírgula (ex: *01/08/2026, 03/08/2026*) " +
        "ou *misturar* (ex: *01 a 03/08/2026, 07/08/2026*)."
      );
      return;
    }

    session.orcamento.datasCorporativo = datas;
    session.orcamento.data             = datas[0]; // primeira como referência

    // As DATAS mandam: ajusta o nº de dias ao que foi informado, em vez de
    // re-perguntar (re-perguntar é justamente o que faz o cliente desistir).
    const aviso_dias = (datas.length !== session.orcamento.dias)
      ? `\n\n_Ajustei para *${datas.length} dias*, conforme as datas._`
      : "";
    session.orcamento.dias = datas.length;

    session.step = "orcamento_hora_inicio";
    await enviarPerguntaESalvar(chatId, session,
      `✅ Entendi *${datas.length} data(s)*: ${datas.join(", ")}.${aviso_dias}\n\n` +
      "Qual o *horário de início* (válido para todos os dias)? *(Ex: 08:00 ou 8h)*"
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — DATA DE CADA DIA (horários diferentes)
  // ======================================================
  if (session.step === "orcamento_dia_data") {
    const dataFlex = parsearDataFlex(corpoMensagem);

    if (!dataFlex) {
      await sendText(chatId, "*⚠ Data inválida!* Use *01/06/2026*, *01/06* ou por extenso, *9 de setembro*.");
      return;
    }

    const hojeDia = new Date();
    hojeDia.setHours(0, 0, 0, 0);

    if (dataFlex.date < hojeDia) {
      await sendText(chatId, "*⚠ A data do evento não pode estar no passado!*");
      return;
    }

    const diaIdx = (session.orcamento.diaAtual || 1) - 1;

    if (!session.orcamento.diasDetalhes) session.orcamento.diasDetalhes = [];
    session.orcamento.diasDetalhes[diaIdx] = { data: dataFlex.str };

    session.step = "orcamento_dia_hora_inicio";
    await sendTyping(chatId);
    await sendText(
      chatId,
      `⏰ *Dia ${session.orcamento.diaAtual}* — Qual o *horário de início*? *(Ex: 08:00 ou 8h)*`
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORA INÍCIO DE CADA DIA
  // ======================================================
  if (session.step === "orcamento_dia_hora_inicio") {
    const diaIdxIni = (session.orcamento.diaAtual || 1) - 1;

    // respondeu o intervalo inteiro ("19h as 23h")? salva os dois e segue
    const intervaloDia = normalizarIntervaloHorario(corpoMensagem);
    if (intervaloDia) {
      const detalhes = session.orcamento.diasDetalhes[diaIdxIni];
      detalhes.horaInicio = intervaloDia.inicio;
      detalhes.horaFim    = intervaloDia.fim;
      await sendTyping(chatId);
      await sendText(chatId, `⏰ *Dia ${session.orcamento.diaAtual}*: das *${intervaloDia.inicio}* às *${intervaloDia.fim}*.`);
      await avancarAposHoraFimDoDia(chatId, session);
      return;
    }

    const horario = normalizarHorario(corpoMensagem);

    if (!horario) {
      await sendText(chatId, "*⚠ Horário inválido!* Use o formato *08:00*.");
      return;
    }

    const diaIdx = diaIdxIni;
    session.orcamento.diasDetalhes[diaIdx].horaInicio = horario;
    session.step = "orcamento_dia_hora_fim";

    await sendTyping(chatId);
    await sendText(
      chatId,
      `⏰ *Dia ${session.orcamento.diaAtual}* — Qual o *horário de término*? *(Ex: 18:00 ou 18h)*`
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORA FIM DE CADA DIA
  // ======================================================
  if (session.step === "orcamento_dia_hora_fim") {
    // Se repetir o intervalo aqui ("19h as 23h"), o término é a SEGUNDA hora.
    const intervaloFimDia = normalizarIntervaloHorario(corpoMensagem);
    const horario = intervaloFimDia ? intervaloFimDia.fim : normalizarHorario(corpoMensagem);

    if (!horario) {
      await sendText(chatId, "*⚠ Horário inválido!* Use o formato *18:00*.");
      return;
    }

    const diaIdx    = (session.orcamento.diaAtual || 1) - 1;
    const totalDias = session.orcamento.dias || 1;

    // Hora igual à de início não é aceita (ex: 17h e 17:00)
    if (session.orcamento.diasDetalhes[diaIdx].horaInicio === horario) {
      await sendText(chatId, "*⚠ O horário de término não pode ser igual ao de início!* Informe o horário em que o evento termina.");
      return;
    }

    session.orcamento.diasDetalhes[diaIdx].horaFim = horario;
    await avancarAposHoraFimDoDia(chatId, session);
    return;
  }

  // ======================================================
  // ORÇAMENTO — DATA
  // ======================================================
  if (session.step === "orcamento_data") {
    const dataFlex = parsearDataFlex(corpoMensagem);

    if (!dataFlex) {
      await sendText(chatId, "*⚠ Data inválida!* Use *01/02/2026*, *01/02* ou por extenso, *9 de setembro*.");
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataFlex.date < hoje) {
      await sendText(chatId, "*⚠ A data do evento não pode estar no passado!*");
      return;
    }

    session.orcamento.data = dataFlex.str;
    session.step = "orcamento_hora_inicio";

    await enviarPerguntaESalvar(chatId, session, "Qual o horário de início? (*Ex: 18:00 ou 18h*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORA INÍCIO
  // ======================================================
  if (session.step === "orcamento_hora_inicio") {
    // Muita gente responde o intervalo inteiro ("19h as 23h"). Nesse caso
    // salvamos início E término de uma vez e pulamos a próxima pergunta.
    const intervalo = normalizarIntervaloHorario(corpoMensagem);
    if (intervalo) {
      session.orcamento.horaInicio = intervalo.inicio;
      session.orcamento.horaFim    = intervalo.fim;
      // mesmo cálculo do passo "orcamento_hora_fim"
      session.orcamento.duracao = calcularDuracaoEvento(intervalo.inicio, intervalo.fim);
      session.orcamento.horas   = Number.parseInt(session.orcamento.duracao, 10) || 2;

      await sendTyping(chatId);
      await sendText(chatId, `⏰ Anotado: das *${intervalo.inicio}* às *${intervalo.fim}*.`);

      session.step = "orcamento_bairro";
      await enviarPerguntaESalvar(chatId, session, "Qual o *bairro* do evento?");
      return;
    }

    const horarioNormalizado = normalizarHorario(corpoMensagem);

    if (!horarioNormalizado) {
      await sendText(chatId, "*⚠ Horário inválido!* Use o formato *18:00*.");
      return;
    }

    session.orcamento.horaInicio = horarioNormalizado;
    session.step = "orcamento_hora_fim";

    await enviarPerguntaESalvar(chatId, session, "Qual o horário de término? (*Ex: 23:00 ou 23h*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORA FIM
  // ======================================================
  if (session.step === "orcamento_hora_fim") {
    // Se repetir o intervalo aqui ("19h as 23h"), o término é a SEGUNDA hora.
    const intervaloFim = normalizarIntervaloHorario(corpoMensagem);
    const horarioNormalizado = intervaloFim ? intervaloFim.fim : normalizarHorario(corpoMensagem);

    if (!horarioNormalizado) {
      await sendText(chatId, "*⚠ Horário inválido!* Use o formato *23:00*");
      return;
    }

    const [horaInicio, minInicio] = session.orcamento.horaInicio.split(":").map(Number);
    const [horaFim, minFim] = horarioNormalizado.split(":").map(Number);

    let minutosInicio = horaInicio * 60 + minInicio;
    let minutosFim = horaFim * 60 + minFim;

    // Hora igual à de início não é aceita (ex: 17h e 17:00)
    if (minutosFim === minutosInicio) {
      await sendText(chatId, "*⚠ O horário de término não pode ser igual ao de início!* Informe o horário em que o evento termina.");
      return;
    }

    if (minutosFim < minutosInicio) {
      minutosFim += 24 * 60; // evento vira a madrugada
    }

    session.orcamento.horaFim = horarioNormalizado;
    session.orcamento.duracao = calcularDuracaoEvento(
      session.orcamento.horaInicio,
      session.orcamento.horaFim
    );

    // FIX: garantir horas numéricas para os serviços
    session.orcamento.horas = Number.parseInt(session.orcamento.duracao, 10) || 2;

    session.step = "orcamento_bairro";

    await enviarPerguntaESalvar(chatId, session, "Qual o *bairro* do evento?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — BAIRRO
  // ======================================================
  if (session.step === "orcamento_bairro") {
    const txtBairro = (corpoMensagem || "").trim();
    // Bairro precisa ter pelo menos uma letra — evita que um número solto
    // (ex: "13" digitado por engano) seja aceito e desloque todo o fluxo.
    if (txtBairro.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(txtBairro)) {
      await sendText(chatId, "*⚠ Informe o nome do bairro* (ex: *Recreio*). Não use apenas números.");
      return;
    }

    session.orcamento.bairro = capitalizarPalavras(txtBairro);
    session.step = "orcamento_cidade";
    await enviarPerguntaESalvar(chatId, session, "Qual a *cidade* do evento?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — CIDADE
  // ======================================================
  if (session.step === "orcamento_cidade") {
    const txtCidade = (corpoMensagem || "").trim();
    if (txtCidade.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(txtCidade)) {
      await sendText(chatId, "*⚠ Informe o nome da cidade* (ex: *Rio de Janeiro*). Não use apenas números.");
      return;
    }

    session.orcamento.cidade = capitalizarPalavras(txtCidade);
    session.step = "orcamento_salao";
    await enviarPerguntaESalvar(
      chatId,
      session,
      "Qual o nome do *salão/local* do evento?\nSe ainda não tiver definido, responda *pular*."
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — SALÃO
  // ======================================================
  if (session.step === "orcamento_salao") {
    const txtSalao = corpoMensagem.trim();
    const pulou = txtSalao.toLowerCase()
      .normalize("NFD").replace(/[0300-036f]/g, "") === "pular";

    if (!pulou && txtSalao.length < 2) {
      await sendText(chatId, "*⚠ Informe o nome do salão* ou responda *pular*.");
      return;
    }

    session.orcamento.salao = pulou ? null : capitalizarPalavras(txtSalao);

    // Consulta o valor de deslocamento e corrige o bairro (fuzzy) ANTES
    // de compor orc.local, para o nome corrigido entrar no resumo
    await consultarDeslocamento(session);

    // Mantém orc.local composto para o resumo e demais etapas do fluxo
    session.orcamento.local = [
      session.orcamento.salao,
      session.orcamento.bairro,
      session.orcamento.cidade
    ].filter(Boolean).join(", ");

    session.step = "orcamento_onde_encontrou";
    await enviarPerguntaESalvar(chatId, session, "Onde nos encontrou?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — ONDE ENCONTROU
  // ======================================================
  if (session.step === "orcamento_onde_encontrou") {
    session.orcamento.ondeEncontrou = capitalizarPalavras(corpoMensagem);
    session.step = "orcamento_detalhes";

    await sendTyping(chatId);
    await sendButtonList(
      chatId,
      "Deseja informar mais detalhes do seu evento?",
      [
        { id: "1", label: "Sim" },
        { id: "2", label: "Não" }
      ]
    );
    session.ultimaPerguntaNaoRespondida = "Deseja informar mais detalhes do seu evento?\n*1* - Sim\n*2* - Não";
    return;
  }

  // ======================================================
  // GARANTIR OBJETO CLIENTE
  // ======================================================
  if (!session.cliente) {
    session.cliente = {
      email: null,
      dataNascimento: null
    };
  }

  // ======================================================
  // ======================================================
  // ORÇAMENTO — DETALHES
  // ======================================================
  if (session.step === "orcamento_detalhes") {
    const respDetalhes = interpretarSimNao(corpoMensagem);
    if (!respDetalhes) {
      await sendText(chatId, "*⚠ Responda com o número da opção:*\n*1* - Sim\n*2* - Não");
      return;
    }

    if (respDetalhes === "1") {
      session.step = "orcamento_detalhes_texto";
      await enviarPerguntaESalvar(chatId, session, "*Digite os detalhes adicionais:*");
      return;
    }

    session.orcamento.detalhes = null;

    await sendTyping(chatId);
    await sendText(
      chatId,
      "*Para deixar seu orçamento ainda mais completo, posso te pedir duas informações rápidas?*"
    );

    await perguntarEmailOpcional(chatId, session);
    return;
  }

  // ======================================================
  // ORÇAMENTO — DETALHES TEXTO
  // ======================================================
  if (session.step === "orcamento_detalhes_texto") {
    session.orcamento.detalhes = capitalizarPalavras(corpoMensagem);

    await sendTyping(chatId);
    await sendText(
      chatId,
      "*Para deixar seu orçamento ainda mais completo, posso te pedir duas informações rápidas?*"
    );

    await perguntarEmailOpcional(chatId, session);
    return;
  }

  // ======================================================
  // COLETAR E-MAIL OPCIONAL (NÃO BLOQUEANTE)
  // ======================================================
  if (session.step === "coletar_email_opcional") {
    const r = String(corpoMensagem || "").trim();

    if (r === "1") {
      session.step = "coletar_email_valor";
      const p = "Perfeito! Qual o seu *e-mail*?";
      await sendTyping(chatId);
      await sendText(chatId, p);
      session.ultimaPerguntaNaoRespondida = p;
      return;
    }

    // "2" (Não) ou qualquer outra coisa: segue sem e-mail. O campo é opcional,
    // não pode travar a entrega do orçamento (caso Rayane, 26/06).
    session.orcamento.email = null;
    await perguntarNascimentoOpcional(chatId, session);
    return;
  }

  // ======================================================
  // E-MAIL — RECEBER O VALOR
  // ======================================================
  if (session.step === "coletar_email_valor") {

    // Remove asteriscos/formatação do WhatsApp e espaços — "*email@x.com" vira "email@x.com"
    const texto = corpoMensagem.trim().replace(/[*_~`'"<>()\[\]\s]/g, "");

    // Valida com caracteres reais de e-mail (letras, números, . _ % + -)
    const regexEmail = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

    if (regexEmail.test(texto)) {
      session.orcamento.email = texto.toLowerCase();
    } else {
      // E-mail inválido: avisa UMA vez e segue. Nunca travar o orçamento por
      // causa de um campo opcional.
      session.orcamento.email = null;
      await sendTyping(chatId);
      await sendText(chatId, "Não consegui ler esse e-mail, mas sem problema: seu orçamento vai pelo WhatsApp mesmo 😉");
    }

    await perguntarNascimentoOpcional(chatId, session);
    return;
  }

  // ======================================================
  // COLETAR NASCIMENTO OPCIONAL (NÃO BLOQUEANTE)
  // ======================================================
  if (session.step === "coletar_nascimento_opcional") {
    const r = String(corpoMensagem || "").trim();

    if (r === "1") {
      session.step = "coletar_nascimento_valor";
      const p = "Informe sua *data de nascimento* *(exemplo: 01/02/1985)*.";
      await sendTyping(chatId);
      await sendText(chatId, p);
      session.ultimaPerguntaNaoRespondida = p;
      return;
    }

    // "2" (Não) ou qualquer outra coisa: segue sem a data.
    session.orcamento.dataNascimento = null;
    await mostrarConfirmacaoOrcamento(chatId, session);
    return;
  }

  // ======================================================
  // NASCIMENTO — RECEBER O VALOR
  // ======================================================
  if (session.step === "coletar_nascimento_valor") {

    const texto = corpoMensagem.trim();
    const regexData = /^(0[1-9]|[12][0-9]|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](\d{2}|\d{4})$/;

    // Palavras aceitas para pular (case-insensitive, ignora acentos)
    const textoNorm = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPular = ["pular", "nao", "n", "nao tenho", "nao quero", "nao sei",
                     "sem data", "nenhuma", "ok", "pass", "skip"].includes(textoNorm)
                  || textoNorm.startsWith("nao ");

    if (isPular) {
      session.orcamento.dataNascimento = null;
      await sendTyping(chatId);
    } else if (regexData.test(texto)) {
      session.orcamento.dataNascimento = texto;
      await sendTyping(chatId);
    } else {
      // Entrada inválida → solicitar novamente
      await sendTyping(chatId);
      await sendText(chatId, "*⚠ Formato inválido.* Use o formato DD/MM/AAAA (ex: 01/02/1985) ou responda *pular*.");
      return;
    }

    // Antes de escolher serviços, mostra a confirmação dos dados do evento
    await mostrarConfirmacaoOrcamento(chatId, session);
    return;
  }

  // ======================================================
  // ORÇAMENTO — CONFIRMAÇÃO DOS DADOS (revisão antes do orçamento)
  // ======================================================
  if (session.step === "orcamento_confirmar") {
    const r = (corpoMensagem || "").trim();
    if (r !== "1" && r !== "2") {
      await sendText(chatId, "*⚠ Responda:* *1* para confirmar ou *2* para corrigir.");
      return;
    }
    if (r === "1") {
      // Confirmado → segue para escolher serviços
      session.correcaoFila = null;
      session.correcaoAtual = null;
      session.step = "orcamento_escolher_servico";
      await enviarPerguntaESalvar(chatId, session, textoMenuServicos());
      return;
    }
    // r === "2" → pede os números dos campos a corrigir
    session.step = "orcamento_corrigir_escolher";
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Digite os *números* dos itens que deseja corrigir (para mais de um, separe por vírgula, ex: *3,4*):\n\n" +
      CAMPOS_CORRIGIVEIS.map(c => `*${c.id}* - ${c.label}`).join("\n")
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — ESCOLHER O QUE CORRIGIR
  // ======================================================
  if (session.step === "orcamento_corrigir_escolher") {
    const unicos = extrairNumerosCampos(corpoMensagem, CAMPOS_CORRIGIVEIS.length);
    if (unicos.length === 0) {
      await sendText(chatId, "*⚠ Digite os números dos itens a corrigir, separados por vírgula* (ex: *3,4*).");
      return;
    }
    // Monta a fila na ordem dos campos
    session.correcaoFila = CAMPOS_CORRIGIVEIS.filter(c => unicos.includes(c.id));
    await pedirProximaCorrecao(chatId, session);
    return;
  }

  // ======================================================
  // ORÇAMENTO — APLICAR CORREÇÃO DE UM CAMPO
  // ======================================================
  if (session.step === "orcamento_corrigir_valor") {
    const campo = session.correcaoAtual || {};
    const orc = session.orcamento;
    const txt = (corpoMensagem || "").trim();
    let ok = false;

    switch (campo.tipo) {
      case "celebracao": {
        const op = parseInt(txt, 10);
        if ([1,2,3,4,5,6,7,8,9].includes(op)) {
          orc.celebracaoId = op;
          orc.celebracao = celebracoes[op];
          /* Saiu de corporativo: a empresa não faz mais sentido e ficaria
             nomeando a proposta de um evento social. */
          if (op !== 8) orc.empresa = "";
          ok = true;
        }
        break;
      }
      /* 🚨 A EMPRESA NÃO ENTRA em CAMPOS_CORRIGIVEIS: a lista é limitada a 10
         de propósito (limite da lista clicável do WhatsApp), e passar disso
         reabre o bug dos números de 2 dígitos. Quem quiser corrigir a empresa
         corrige a "Celebração", escolhe 8 de novo e o bot repergunta - por
         isso este `case` existe, mesmo sem id na lista. */
      case "empresa": {
        const pulou = txt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === "pular";
        if (pulou) { orc.empresa = ""; ok = true; }
        else if (txt.length >= 2) { orc.empresa = capitalizarPalavras(txt); ok = true; }
        break;
      }
      case "numero": {
        const n = parseInt(txt.replace(/\D+/g, ""), 10);
        if (!isNaN(n) && n > 0) { orc.convidados = n; ok = true; }
        break;
      }
      case "data": {
        const d = parsearDataFlex(txt);
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        if (d && d.date >= hoje) { orc.data = d.str; ok = true; }
        break;
      }
      case "hora_ini": {
        const h = normalizarHorario(txt);
        if (h) { orc.horaInicio = h; ok = true; }
        break;
      }
      case "hora_fim": {
        const h = normalizarHorario(txt);
        if (h) { orc.horaFim = h; ok = true; }
        break;
      }
      case "bairro": {
        if (txt.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(txt)) { orc.bairro = capitalizarPalavras(txt); ok = true; }
        break;
      }
      case "cidade": {
        if (txt.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(txt)) { orc.cidade = capitalizarPalavras(txt); ok = true; }
        break;
      }
      case "salao": {
        const pulou = txt.toLowerCase().normalize("NFD").replace(/[0300-036f]/g, "") === "pular";
        orc.salao = pulou ? null : capitalizarPalavras(txt);
        ok = true;
        break;
      }
      case "onde": {
        if (txt.length >= 2) { orc.ondeEncontrou = capitalizarPalavras(txt); ok = true; }
        break;
      }
      case "detalhes": {
        const pulou = txt.toLowerCase().normalize("NFD").replace(/[0300-036f]/g, "") === "pular";
        orc.detalhes = pulou ? null : capitalizarPalavras(txt);
        ok = true;
        break;
      }
      case "email": {
        const limpo = txt.replace(/[*_~`'"<>()\[\]\s]/g, "");
        const pulou = limpo.toLowerCase() === "pular";
        if (pulou) { orc.email = null; ok = true; }
        else if (/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(limpo)) {
          orc.email = limpo.toLowerCase(); ok = true;
        }
        break;
      }
      case "nascimento": {
        const pulou = txt.toLowerCase().normalize("NFD").replace(/[0300-036f]/g, "") === "pular";
        const regexNasc = /^(0[1-9]|[12][0-9]|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](\d{2}|\d{4})$/;
        if (pulou) { orc.dataNascimento = null; ok = true; }
        else if (regexNasc.test(txt)) { orc.dataNascimento = txt; ok = true; }
        break;
      }
    }

    if (!ok) {
      await sendText(chatId, "*⚠ Valor inválido.* Tente novamente.");
      return; // permanece no mesmo campo
    }

    // Campo corrigido → remove da fila e vai ao próximo (ou reconfirma)
    if (session.correcaoFila) session.correcaoFila.shift();

    /* Corrigiu para CORPORATIVO: pergunta a empresa em seguida, senão a
       proposta sairia no nome da pessoa. Entra na FRENTE da fila para o
       cliente responder enquanto ainda está no assunto. */
    if (campo.tipo === "celebracao" && orc.celebracaoId === 8 && !orc.empresa) {
      session.correcaoFila = session.correcaoFila || [];
      session.correcaoFila.unshift({ id: 0, label: "Empresa", tipo: "empresa" });
    }
    await pedirProximaCorrecao(chatId, session);
    return;
  }


  // ======================================================
  // ORÇAMENTO — PRIMEIRA RODADA DE SERVIÇOS
  // ======================================================
  if (session.step === "orcamento_escolher_servico") {
    const servicos = extrairServicosDaMensagem(corpoMensagem);

    if (servicos.length === 0) {
      // Após 3 tentativas inválidas → auto-pausa e chama o operador
      session.tentativasInvalidasEscolher = (session.tentativasInvalidasEscolher || 0) + 1;
      if (session.tentativasInvalidasEscolher >= 3) {
        await autoPausarFluxo(chatId, session, "respostas inválidas na escolha de serviços");
        return;
      }
      await sendText(chatId, "*⚠ Digite pelo menos um número válido entre 1 e 9* (9 = todos os serviços).");
      return;
    }
    // Reseta o contador ao acertar
    session.tentativasInvalidasEscolher = 0;

    // ======================================================
    // REGRA ESPECIAL — ILUMINAÇÃO (8) NÃO PODE SER SOZINHA
    // MAS APENAS NA PRIMEIRA RODADA
    // ======================================================
    if (!session.primeiraRodadaFinalizada) {

      if (servicos.includes(8)) {

        // Iluminação sozinha → bloquear
        if (servicos.length === 1) {
          await sendTyping(chatId);
          await sendText(
            chatId,
            "⚠️ A *Iluminação de Pista de Dança* não pode ser contratada sozinha.\n\n" +
            "Ela só pode ser contratada junto com outro serviço da PhotoMusic.\n\n" +
            "👉 *Exceto quando você contrata o Som Completo com DJ*, pois nesse caso a iluminação já está inclusa."
          );

          // Voltar ao menu de escolha de serviços
          await sendTyping(chatId);
          await sendText(
            chatId,
            "Escolha novamente os serviços desejados (ex: 0,3,5):\n\n" +
            linhasMenuServicos(TODOS_SERVICOS)
          );

          return;
        }

        // Se DJ (7) estiver junto, remover iluminação duplicada
        if (servicos.includes(7)) {
          await sendTyping(chatId);
          await sendText(
            chatId,
            "✨ A Iluminação de Pista de Dança já está *inclusa* no serviço de Som Completo com DJ.\n" +
            "Não é necessário contratar separadamente."
          );

          const filtrados = servicos.filter(s => s !== 8);
          servicos.length = 0;
          servicos.push(...filtrados);
        }
      }
    }

    // Sem "aguarde": o orçamento sai na hora, o aviso só somava ruído
    // (decisão do Mario, 11/08/2026).
    await enviarMultiplosOrcamentos(chatId, servicos);

    session.primeiraRodadaFinalizada = true;
    // ⚠️ NÃO definir step aqui: quem manda é o perguntarPosOrcamento(), chamado
    // no fim do enviarMultiplosOrcamentos. Havia um `step = "orcamento_mais_servicos"`
    // nesta linha que SOBRESCREVIA o "orcamento_pos" recém-definido — o cliente
    // via o menu novo (Quero mais detalhes) mas a resposta era processada pelo
    // menu ANTIGO, onde "1" = "sim, quero mais orçamentos". Bug pego pelo Mario
    // no teste de 16/07: clicou em "Quero mais detalhes" e caiu na lista de
    // serviços. A captura de aniversário também já é feita lá dentro.
    return;
  }

  // ======================================================
  // ORÇAMENTO — MAIS SERVIÇOS (SEGUNDA RODADA)
  // ======================================================
  // ======================================================
  // MENU PÓS-ORÇAMENTO (dinâmico) — detalhes / mais orçamento / é só
  // ======================================================
  if (session.step === "orcamento_pos") {
    await processarOrcamentoPos(chatId, session, corpoMensagem);
    return;
  }

  // ======================================================
  // ESCOLHER QUAL SERVIÇO DETALHAR
  // ======================================================
  // Aceita VÁRIOS serviços de uma vez, no formato do menu de orçamento
  // ("1,3,4", "134", "9" = todos) — Mario, 17/08/2026.
  if (session.step === "orcamento_escolher_detalhe") {

    const paraDetalhar = servicosParaDetalhar(session);
    const escolhidos   = extrairServicosDetalhe(corpoMensagem, paraDetalhar);

    if (escolhidos.length === 0) {
      session.tentativasInvalidasDetalhe = (session.tentativasInvalidasDetalhe || 0) + 1;
      if (session.tentativasInvalidasDetalhe >= 3) {
        await autoPausarFluxo(chatId, session, "respostas inválidas ao escolher o detalhe");
        return;
      }
      await sendTyping(chatId);
      await sendText(
        chatId,
        "*⚠ Não entendi.* " + textoMenuDetalhes(paraDetalhar)
      );
      return;
    }

    session.tentativasInvalidasDetalhe = 0;
    await enviarDetalhesEmLote(chatId, session, escolhidos);
    await perguntarPosOrcamento(chatId, session);
    return;
  }

  if (session.step === "orcamento_mais_servicos") {

    if (corpoMensagem !== "1" && corpoMensagem !== "2") {
      // Conta tentativas inválidas — após 3 auto-pausa e chama o operador
      session.tentativasInvalidasMaisServicos = (session.tentativasInvalidasMaisServicos || 0) + 1;
      if (session.tentativasInvalidasMaisServicos >= 3) {
        await autoPausarFluxo(chatId, session, "respostas inválidas em 'deseja mais serviços'");
        return;
      }
      await sendTyping(chatId);
      await sendText(chatId, "Por favor, responda apenas *1* para mais orçamentos ou *2* para encerrar.");
      return;
    }

    // Reseta contador ao responder corretamente
    session.tentativasInvalidasMaisServicos = 0;

    // Cliente NÃO quer mais orçamentos — sessão permanece ativa (step finalizado)
    if (corpoMensagem === "2") {
      await sendTyping(chatId);
      await sendText(chatId, "Perfeito! Qualquer dúvida é só me chamar 😊");
      session.step = "finalizado";
      return;
    }

    // Cliente quer mais orçamentos → gerar lista atualizada
    // Lista canônica: com a lista à mão o Totem Retrô nunca era oferecido aqui.
    const restantes = TODOS_SERVICOS.filter(
      s => !session.orcamento.servicosEnviados.includes(s)
    );

    if (restantes.length === 0) {
      await sendTyping(chatId);
      await sendText(chatId, "Você já recebeu orçamento de todos os serviços disponíveis 😊");
      session.step = "finalizado";
      return;
    }

    session.step = "orcamento_escolher_servico";

    await sendTyping(chatId);
    await sendText(
      chatId,
      "Certo! Me diga de quais *outros serviços* você deseja orçamento (digite apenas os números):\n\n" +
      // Sai do mesmo lugar do menu principal, então o Totem Retrô aparece aqui
      // também (era o que faltava: ele não entrava no "mais orçamento").
      linhasMenuServicos(restantes)
    );

    return;
  }

  console.log("ℹ️ Nenhum fluxo correspondente ao step atual, mensagem ignorada.");
}

// ======================================================
// EXPORTAÇÃO
// ======================================================
module.exports = {
  handleIncomingMessage,
  // 🚨 Lista canônica dos serviços do menu, na ordem do menu. Os jobs
  // (envio agendado, lembrete) precisam dela: cada cópia escrita à mão
  // envelhecia e deixava serviço novo de fora.
  TODOS_SERVICOS,
  // usados pelo jobs/lembreteOrcamento no lembrete de 1h (entrega enxuta
  // de todos os orçamentos + captura do lead p/ o follow-up assumir).
  capturarClienteOrcamento,
  enviarOrcamentosAutomaticos
};

// ======================================================
// RESUMO DO CLIENTE (OPERADOR)
// ===================================================

/**
 * ENVIO AUTOMÁTICO DE TODOS OS ORÇAMENTOS (lembrete de 1h).
 * Versão ENXUTA: usa apenasOrcamento (avaliação + nome do serviço + PDF/link),
 * sem o fluxo de fotos e vídeos — senão viram ~80 mensagens e o cliente se perde.
 * Fecha com o RESUMO de todos os links (enviarResumoCliente).
 * Fallbacks: sem horário → 4h5h (horas=5); sem celebração → Outros (9) e 200
 * convidados; corporativo → avisa que o valor atende até 200 pessoas.
 */
async function enviarOrcamentosAutomaticos(chatId, session, listaServicos = null) {
  if (!session) return;
  const passoOriginal = session.step;

  session.orcamento = session.orcamento || {};
  const orc = session.orcamento;

  if (!orc.celebracaoId) orc.celebracaoId = 9;   // Outros
  if (!orc.horas)        orc.horas = 5;          // 5 => tabela "4h5h"
  if (!orc.convidados)   orc.convidados = 200;   // até 200 pessoas
  if (!Array.isArray(orc.servicosEnviados)) orc.servicosEnviados = [];

  const clb   = Number(orc.celebracaoId);
  const conv  = Number(orc.convidados);
  const horas = Number(orc.horas) || 5;
  const dias  = orc.dias || 1;
  const nome  = orc.nome ? String(orc.nome).split(" ")[0] : "";
  // Saudação pela hora do envio (no agendado, a hora marcada pelo operador)
  const saud  = saudacaoPorHora();
  const ola   = nome ? `${saud}, *${nome}*!` : `${saud}!`;

  await sendTyping(chatId);
  await sendText(chatId,
    `${ola} ❤️\n\n` +
    `Vi que a gente não terminou o seu orçamento e não quero te deixar esperando.\n\n` +
    `Então já vou te enviar *todos os nossos serviços*, pra você ver com calma e sem compromisso. 😊`
  );

  try { await enviarAvaliacaoEmpresa(chatId, sessions); } catch (e) {
    console.error("⚠️ avaliações não enviadas:", e.message);
  }

  if (clb === 8) {
    await sendText(chatId,
      "ℹ️ Os valores a seguir atendem eventos de *até 200 pessoas*. " +
      "Se o seu for maior, me avisa que eu faço um orçamento sob medida. 😉"
    );
  }

  // listaServicos: permite mandar SÓ os que faltam (comando #enviarfaltantes)
  /* 🚨 Lista PADRÃO = TODOS_SERVICOS, não uma lista escrita à mão. Com o Totem
     Retrô no menu são 9 serviços, e a lista fixa de 8 deixaria ele de fora
     justamente no envio que se chama "todos os nossos serviços". */
  const lista = (Array.isArray(listaServicos) && listaServicos.length)
    ? listaServicos
    : [...TODOS_SERVICOS];

  /* Lotes de 3 com 15s entre eles (anti-bloqueio da Meta). 🚨 Antes era um
     array fixo [3,3,2], que comportava 8 e SILENCIOSAMENTE descartava o 9º
     serviço. Agora fatia a lista, seja qual for o tamanho dela. */
  const POR_LOTE = 3;
  for (let i = 0; i < lista.length; i++) {
    const servico = lista[i];
    sessions[chatId]._envioMultiplo = {
      apenasOrcamento:    true,
      ehUltimo:           i === lista.length - 1,
      ehUltimoComMoldura: false,
      servicosNaLista:    lista
    };
    try {
      await enviarOrcamentoUnificado(chatId, servico, clb, conv, horas, dias, true);
      registrarServicoEnviado(session, servico);
    } catch (e) {
      console.error(`⚠️ falha no serviço ${servico}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 600));
    // Respiro entre lotes, menos depois do último serviço
    const fimDeLote = (i + 1) % POR_LOTE === 0;
    if (fimDeLote && i < lista.length - 1) await new Promise(r => setTimeout(r, 15000));
  }
  delete sessions[chatId]._envioMultiplo;

  /* 🧾 O ORÇAMENTO EM SI (bug pego pelo Mario em 17/08/2026).
     Este envio saía SEM ARQUIVO: o laço acima manda a apresentação de cada
     serviço com `apenasOrcamento`, e o PDF vinha de dentro de cada service.
     Quando os 9 migraram para o orçamento GERADO, o PDF saiu de lá e passou a
     vir do `orcamentoGerado.js`, chamado UMA vez com a lista inteira - e este
     job, que é um TERCEIRO chamador, ficou para trás. O cliente que parou de
     responder recebia "segue o orçamento" e nenhum arquivo.
     🚨 Todo caminho que envia serviço precisa desta chamada: fluxo automático,
     comando manual do operador e este envio do lembrete. */
  try {
    await enviarOrcamentoGerado(chatId, session, lista);
  } catch (e) {
    console.error("⚠️ orçamento gerado não saiu:", e.message);
  }

  // Resumo final com TODOS os links (é o que amarra tudo pro cliente)
  try { await enviarResumoCliente(chatId, session); } catch (e) {
    console.error("⚠️ resumo não enviado:", e.message);
  }

  // Captura o lead: é o que faz o follow-up assumir daqui em diante
  try { await capturarClienteOrcamento(chatId, session); } catch (e) {
    console.error("⚠️ captura do lead falhou:", e.message);
  }

  // Convite para personalizar, retomando de onde parou
  session.lembreteRetomarStep = passoOriginal;
  session.step = "lembrete_retomar";
  await sendTyping(chatId);
  await sendButtonList(
    chatId,
    "Quer um orçamento *personalizado* para o seu evento? É rapidinho, continuamos de onde paramos.",
    [{ id: "1", label: "Sim, quero" }, { id: "2", label: "Agora não" }]
  );
}

/**
 * Quantas parcelas no PIX o cliente tem até a data do evento.
 * Conta o MÊS ATUAL (em que ele fecha o contrato) até o mês do evento,
 * com teto de 10. Sem data informada, devolve null (mensagem genérica).
 */
/**
 * "Bom dia" / "Boa tarde" / "Boa noite" pela hora de Brasília no momento do
 * envio — que, no envio AGENDADO, é exatamente a hora marcada pelo operador.
 */
function saudacaoPorHora() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const h = d.getHours();
  if (h >= 5 && h < 12)  return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Quantas parcelas no PIX o cliente tem até a data do evento.
 * Conta o MÊS ATUAL (em que ele fecha o contrato) até o mês do evento,
 * com teto de 6, a mesma regra do gerador (PhotoMusic_Orcamentos::PIX_MAX_PARCELAS,
 * ver pix_parcelas()). Sem data informada, devolve null (mensagem genérica).
 *
 * 🐛 CORRIGIDO 2026-08 (Mario): desde a migração para o orçamento GERADO pelo
 * PhotoMusic Pro (9 de 9 serviços, 18/08/2026), o cartão já é 10x sem juros
 * para todo mundo e o PIX é o parcelamento de 3 a 6x pela data do evento.
 * Este teto ficou esquecido em 10 (herança do tempo dos PDFs prontos de 3x) e
 * o bot chegou a prometer PIX em 10x, quando o correto era 6x.
 */
function parcelasPixAteEvento(dataStr) {
  const m = String(dataStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const mesEvento = Number(m[2]);
  const anoEvento = Number(m[3]);

  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const meses = (anoEvento - hoje.getFullYear()) * 12
              + (mesEvento - (hoje.getMonth() + 1))
              + 1; // +1 = inclui o mês atual

  if (!Number.isFinite(meses) || meses < 1) return 1;
  return Math.min(6, meses);
}

async function enviarResumoCliente(chatId, session) {
  try {
    const orc = session.orcamento || {};
    
    // Se não há serviços nem dados de celebração, não envia
    if (!orc.servicosEnviados || orc.servicosEnviados.length === 0) {
      if (!orc.nome && !orc.celebracaoId) {
        return;
      }
    }

    const linhas = [];
    linhas.push("*RESUMO DO EVENTO — ORÇAMENTO ENVIADO*\n");

    let index = 1;

    // ✅ Corrigido: usar `orc.nome` em vez de `orc.cliente`
    if (orc.nome) linhas.push(`${index++}. Nome: *${orc.nome}*`);
    // Empresa logo depois do nome: em corporativo é ela que assina a proposta.
    if (orc.empresa) linhas.push(`${index++}. Empresa: *${orc.empresa}*`);
    if (orc.email) linhas.push(`${index++}. E-mail: ${orc.email}`);
    if (orc.dataNascimento) linhas.push(`${index++}. Data de Nascimento: *${orc.dataNascimento}*`);

    if (orc.celebracaoId) {
      linhas.push(`${index++}. Celebração: *${textoCelebracao(orc)}*`);
    }
    
    if (orc.convidados) {
      linhas.push(`${index++}. Convidados: *${orc.convidados}*`);
    }
    
    // Multi-dias: mostrar cronograma por dia se disponível
    if (orc.diasDetalhes?.length) {
      linhas.push(`${index++}. Dias de Evento: *${orc.dias}*`);
      orc.diasDetalhes.forEach((d, i) => {
        linhas.push(`   📅 Dia ${i + 1}: *${d.data}* — ${d.horaInicio} às ${d.horaFim}`);
      });
    } else if (orc.datasCorporativo?.length) {
      // Mesmos horários, múltiplas datas
      linhas.push(`${index++}. Dias de Evento: *${orc.dias}*`);
      linhas.push(`   📅 Datas: *${orc.datasCorporativo.join(", ")}*`);
      if (orc.horaInicio) linhas.push(`   ⏰ Início: *${orc.horaInicio}*  Término: *${orc.horaFim || "—"}*`);
    } else {
      // 1 dia — exibição normal
      if (orc.data)      linhas.push(`${index++}. Data do Evento: *${orc.data}*`);
      if (orc.horaInicio) linhas.push(`${index++}. Horário de Início: *${orc.horaInicio}*`);
      if (orc.horaFim)   linhas.push(`${index++}. Horário de Término: *${orc.horaFim}*`);
      if (orc.horas)     linhas.push(`${index++}. Duração: *${orc.horas} horas*`);
    }

    // ✅ Corrigido: usar `orc.local` (já estava correto)
    if (orc.local) linhas.push(`${index++}. Local do Evento: *${orc.local}*`);
    if (orc.origemLead) linhas.push(`${index++}. Onde nos encontrou: *${orc.origemLead}*`);
    
    // ✅ Corrigido: usar `orc.detalhes` em vez de `orc.observacoes`
    if (orc.detalhes) linhas.push(`${index++}. Detalhes do Evento: *${orc.detalhes}*`);

    // 🎯 MOSTRAR SERVIÇOS ENVIADOS COM LINKS DOS ORÇAMENTOS
    const servicosMap = {
      1: "Foto Cabine",
      2: "Totem Fotográfico",
      3: "Plataforma 360",
      4: "Foto Paparazzi Digital",
      5: "Foto Lembrança",
      6: "Cobertura Fotográfica",
      7: "Som Completo com DJ",
      8: "Iluminação para Pista de Dança",
      13: "Totem Retrô"
    };

    const linksOrcamento = orc.linksOrcamento || {};
    const servicosIds = orc.servicosEnviados || [];

    if (servicosIds.length > 0) {
      linhas.push(`\n${index++}. Serviço(s) Contratado(s):`);
      /* 🚨 AGRUPA OS SERVIÇOS QUE DIVIDEM O MESMO PDF (18/08/2026).
         Desde que o orçamento virou 1 PDF para N serviços, o MESMO link fica
         gravado em `linksOrcamento` para cada id, e o resumo repetia o arquivo
         uma vez por serviço: "Totem Retrô 🔗 link" e "Plataforma 360 🔗 link".
         O cliente lê como se fossem 2 propostas. Agora sai
         "Totem Retrô e Plataforma 360 🔗 link": uma linha por ARQUIVO.
         Serviço sem link fica em linha própria, sem inventar arquivo. */
      const porLink = new Map();
      const semLink = [];

      for (const id of servicosIds) {
        const nome = servicosMap[id];
        if (!nome) continue;
        const link = linksOrcamento[id];
        if (!link) { semLink.push(nome); continue; }
        if (!porLink.has(link)) porLink.set(link, []);
        porLink.get(link).push(nome);
      }

      // "A", "A e B", "A, B e C": o "e" antes do último, como se fala.
      const juntarNomes = (ns) => ns.length <= 1
        ? (ns[0] || "")
        : ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1];

      for (const [link, nomes] of porLink) {
        linhas.push(`   • *${juntarNomes(nomes)}*`);
        linhas.push(`     🔗 ${link}`);
      }
      for (const nome of semLink) {
        linhas.push(`   • *${nome}*`);
      }
    }

    // Contagem de serviços p/ a Vantagem (regra do Mario):
    // Grupo Foto (Cabine 1, Totem 2, Paparazzi 4, Foto Lembrança 5) conta como 1
    // serviço só (o cliente escolhe apenas um deles). Iluminação (8) é add-on/
    // brinde (vai junto do Som/DJ) e NÃO conta na contagem.
    const SERVICOS_SIMILARES = [1, 2, 4, 5];
    const ID_ILUMINACAO = 8;
    const distintos = new Set(
      servicosIds
        .filter(id => id !== ID_ILUMINACAO)
        .map(id => (SERVICOS_SIMILARES.includes(id) ? "similar" : id))
    );
    const nServicos = distintos.size;

    // 🚗 Deslocamento — após todos os serviços
    if (orc.deslocamento?.gratis) {
      linhas.push(
        "\n🚗 *Deslocamento GRÁTIS!* 🎉\n" +
        `Este mês estamos com uma *condição super especial* para eventos em *${orc.deslocamento.cidade}*: ` +
        "o deslocamento está saindo *Grátis*!"
      );
    } else if (orc.deslocamento?.estimado && orc.deslocamento?.valor > 0) {
      // Cidade sem valor na tabela: valor calculado por distância (Google Maps).
      // O cliente NÃO sabe da composição (nem que o de longe inclui hospedagem);
      // recebe um valor aproximado, confirmado no fechamento.
      const valorFmt = Number(orc.deslocamento.valor)
        .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const ondeFmt = orc.deslocamento.cidade || orc.deslocamento.bairro || "o local informado";
      linhas.push(
        "\n🚗 *Deslocamento*\n" +
        `Para *${ondeFmt}*, o deslocamento fica em torno de *R$ ${valorFmt}*.\n` +
        "É um valor aproximado, a gente confirma certinho no fechamento do seu orçamento! 😊"
      );
    } else if (orc.deslocamento?.valor != null && !isNaN(orc.deslocamento.valor) && orc.deslocamento.valor > 0) {
      const valorFmt = Number(orc.deslocamento.valor)
        .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      linhas.push(
        "\n🚗 *Deslocamento*\n" +
        `Deslocamento para *${orc.deslocamento.bairro} — ${orc.deslocamento.cidade}*: ` +
        `Custo do Pacote Escolhido + *R$ ${valorFmt}*`
      );
    } else {
      linhas.push(
        "\n🚗 *Observação importante sobre deslocamento*\n" +
        "O custo de deslocamento *não está incluso* neste orçamento.\n" +
        "Ele será calculado e enviado posteriormente de acordo com o local informado."
      );
    }

    // 🎁 A Vantagem Exclusiva saiu daqui: agora vai como MENSAGEM SEPARADA,
    // logo depois do resumo, e em TODOS os orçamentos (ver mais abaixo).

    // Multi-dia: nota de orçamento personalizado em preparo
    if ((orc.dias || 1) > 1 && (orc.diasDetalhes?.length || orc.datasCorporativo?.length)) {
      linhas.push(
        "\n📋 *Orçamento:*\n" +
        "Nossa equipe está analisando os detalhes de cada dia e enviará o orçamento *personalizado e completo* em breve.\n" +
        "⏱️ *Prazo estimado:* até *24 horas úteis.*"
      );
    }

    linhas.push(`\n${index++}. Origem: *PhotoMusic Produções*`);
    linhas.push(`${index++}. Enviado em: *${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}*`);

    await sendTyping(chatId);
    await sendText(chatId, linhas.join("\n"));

    // 💠 PARCELAMENTO NO PIX — mensagem separada, em destaque, logo após o
    // resumo. Vale para social e "outros"; NÃO vai em evento corporativo.
    // Quando o cliente já informou a data, dizemos quantas parcelas ele tem
    // de fato (do mês atual até o mês do evento, teto de 6).
    if (Number(orc.celebracaoId) !== 8) {
      const nParc = parcelasPixAteEvento(orc.data);
      const txtPix = nParc
        ? `💠 *Parcelamento no PIX*\n\n` +
          `Você pode dividir o valor no PIX *até a data do seu evento*, em até *6x*.\n\n` +
          `Como o seu evento é em *${orc.data}*, dá para parcelar em até *${nParc}x no PIX*. 🙌`
        : `💠 *Parcelamento no PIX*\n\n` +
          `Você pode dividir o valor no PIX *até a data do seu evento*, em até *6x*. 🙌\n\n` +
          `Me conta a data que eu já te digo em quantas vezes dá para parcelar.`;

      await new Promise(r => setTimeout(r, 600));
      await sendTyping(chatId);
      await sendText(chatId, txtPix);
    }

    // 🎁 Vantagem Exclusiva — mensagem SEPARADA, logo após o resumo, em TODOS
    // os orçamentos (mesmo com 1 serviço, como isca p/ incluir mais um).
    await new Promise(r => setTimeout(r, 600));
    await sendTyping(chatId);
    await sendText(chatId, montarVantagemExclusiva(nServicos, orc.deslocamento));

    // 📝 Como contratar (informação de contratação, sempre após o resumo)
    await new Promise(r => setTimeout(r, 600));
    await sendTyping(chatId);
    await sendText(chatId, MSG_COMO_CONTRATAR);

  } catch (erro) {
    console.error("Erro ao enviar resumo para o cliente:", erro);
  }
}

// 🎁 Vantagem Exclusiva — enviada como mensagem própria, após o resumo, em TODOS
// os orçamentos. R$ 100 de desconto a partir do 2º serviço (quando há 2+).
//
// 🐛 CORRIGIDO 2026-08 (Mario): a escada antiga oferecia "6x/9x sem juros no
// cartão" como se fosse exclusividade de quem fechasse 2 ou 3 serviços. Desde
// a migração para o orçamento GERADO pelo PhotoMusic Pro (18/08/2026), o
// cartão já é *10x sem juros* para QUALQUER orçamento, com 1 serviço só.
// Oferecer 6x/9x como "vantagem exclusiva" virou pior que o padrão e perdeu o
// sentido — a vantagem real de fechar 2+ serviços é só o desconto em R$.
function montarVantagemExclusiva(nServicos, deslocamento) {
  const gratis = !!(deslocamento && deslocamento.gratis);
  const fimDesloc = gratis
    ? ", e o seu deslocamento continua *totalmente grátis*! 🚗🎉"
    : "!";

  let corpo;
  if (nServicos >= 2) {
    corpo =
      "Contratando *2 ou mais serviços*, você garante *R$ 100,00 de desconto* " +
      "a partir do segundo serviço";
  } else {
    // 1 serviço — isca p/ o cliente incluir mais um
    corpo =
      "Incluindo *mais um serviço*, você garante *R$ 100,00 de desconto* a partir do segundo";
  }

  return "🎁 *Vantagem exclusiva!*\n" + corpo + fimDesloc;
}

// Texto padrão "como contratar" — usado no WhatsApp (resumo) e no e-mail do orçamento.
const MSG_COMO_CONTRATAR =
  "📝 *Para contratar nossos serviços*, é só nos enviar:\n\n" +
  "• O(s) *serviço(s)* desejado(s)\n" +
  "• O *pacote* e o *tempo* de cada serviço\n" +
  "• A *forma de pagamento*\n\n" +
  "Com essas informações, enviamos o *link do formulário* já com os seus dados para gerar o contrato. " +
  "Todo o processo de assinatura é *100% digital*, feito aqui no nosso sistema. ✍️";

// ======================================================
// RESUMO PARA O OPERADOR (APÓS ENVIO MANUAL)
// ======================================================
async function enviarResumoOperador(chatIdCliente, session, quemEnviou = "") {
  try {
    const orc = session.orcamento || {};

    const linhas = [];
    linhas.push("📊 *RESUMO DO ENVIO MANUAL*\n");

    if (quemEnviou) linhas.push(`- Comando enviado por: *${quemEnviou}*`);
    linhas.push(`- Cliente: *${chatIdCliente}*`);
    
    if (orc.celebracaoId) {
      linhas.push(`- Celebração: *${textoCelebracao(orc)}*`);
    }

    if (orc.empresa) linhas.push(`- Empresa: *${orc.empresa}*`);

    if (orc.convidados) {
      linhas.push(`- Convidados: *${orc.convidados}*`);
    }
    
    if (orc.horas) linhas.push(`- Tempo do evento: *${orc.horas} horas*`);

    if (orc.dias && orc.dias > 1) {
      linhas.push(`- Dias: *${orc.dias}*`);
    }

    if (orc.local) linhas.push(`- Local: *${orc.local}*`);
    if (orc.deslocamento?.gratis) {
      linhas.push(`- Deslocamento: *GRÁTIS — promoção* (${orc.deslocamento.cidade})`);
    } else if (orc.deslocamento?.valor != null && orc.deslocamento.valor > 0) {
      const valorDesloc = Number(orc.deslocamento.valor)
        .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      linhas.push(`- Deslocamento: *R$ ${valorDesloc}* (${orc.deslocamento.bairro}/${orc.deslocamento.cidade})`);
    }

    const servicos = (orc.servicosEnviados || [])
      .map(id => ({
        1: "Foto Cabine",
        2: "Totem Fotográfico",
        3: "Plataforma 360",
        4: "Paparazzi",
        5: "Foto Lembrança",
        6: "Cobertura Fotográfica",
        7: "Som DJ",
        8: "Iluminação",
        13: "Totem Retrô"
      }[id]))
      .filter(Boolean)
      .join(", ");

    if (servicos) {
      linhas.push(`- Serviço(s): *${servicos}*`);
    }

    linhas.push(`- Enviado em: *${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}*`);

    await sendTyping(OPERADOR_TELEFONE_ID);
    await sendText(OPERADOR_TELEFONE_ID, linhas.join("\n"));

  } catch (erro) {
    console.error("Erro ao enviar resumo para o operador:", erro);
  }
}

