// index.js — Raiz do projeto Chatbot PhotoMusic (Z-API)
// VERSÃO CORRIGIDA — 22/02/2026

// ======================================================
// IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
// ======================================================
const { fluxoEventos, apresentarEvento } = require("./services/eventos.js");
const { INSTANCE_ID, TOKEN, API_URL, PM_API_BASE, PM_API_KEY } = require("./utils/config.js");
const axios = require("axios");

const {
  sendText,
  sendTyping,
  sendFileByUrl,
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
  enviarPlataforma360,
  enviarFotoPaparazzi,
  enviarFotoLembranca,
  enviarFotografia,
  enviarSomDJ,
  enviarIluminacao,
  enviarAvaliacaoEmpresa,
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
  calcularDuracaoEvento
} = require("./services/fluxoOrcamento");

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
function normalizarNumero(numero) {
  if (!numero) return null;

  numero = String(numero); // garante string mesmo se vier número/objeto
  numero = numero.replace("@c.us", "");
  numero = numero.replace(/\D+/g, ""); // remove +, espaços, hífen, parênteses etc.
  numero = numero.replace(/^0+/, "");

  if (numero.startsWith("55") && numero.length === 13) return numero;
  if (numero.startsWith("55") && numero.length === 12) return numero;

  if (numero.startsWith("21") && (numero.length === 10 || numero.length === 11))
    return "55" + numero;

  if (numero.length === 9 && numero.startsWith("9"))
    return "5521" + numero;

  if (numero.length === 8)
    return "55219" + numero;

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

  if (numero.length === 10)
    return "55" + numero;

  return numero;
}

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
 * do PhotoMusic Pro. Se tiver data de nascimento válida, sincroniza também
 * com pm_comemoracao_contatos.
 * Fire-and-forget: não bloqueia o fluxo do bot.
 *
 * Dispara quando o cliente forneceu ao menos e-mail OU data de nascimento.
 */
async function capturarClienteOrcamento(chatId, session) {
  try {
    const orc = session.orcamento;
    // Exige ao menos e-mail ou data de nascimento para salvar
    if (!orc || (!orc.dataNascimento && !orc.email)) return;

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

    const payload = {
      telefone:       tel,
      nome:           orc.nome       || "",
      email:          orc.email      || "",
      dia,
      mes,
      ano,
      dataEvento:     orc.data       || "",
      tipoCelebracao: orc.celebracao || "",
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

// ======================================================
// CONTROLE DE PAUSA  (estado persistido em utils/pauseControl.js)
// ======================================================

// ======================================================
// CONFIGURAÇÃO DO OPERADOR
// ======================================================
const OPERADOR_TELEFONE_ID = "5521964428172@c.us";

const comandosServicos = {
  "#fotocabine": 1,
  "#totemfotografico": 2,
  "#plataforma360": 3,
  "#fotopaparazzi": 4,
  "#fotolembranca": 5,
  "#fotografia": 6,
  "#somdj": 7,
  "#iluminacao": 8
};

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

const mensagemBoasVindas =
  "*Olá! Seja bem-vindo(a) à PhotoMusic Produções!* 🎉🎊😍\n" +
  "*É um prazer falar com você!*\n\n" +
  "Por favor, escolha a opção que melhor descreve o motivo do seu contato: *(Digite somente número)*\n" +
  "*1* - Solicitar um orçamento\n" +
  "*2* - Fotografia 1ª Eucaristia\n" +
  "*3* - Estou em processo de contratação\n" +
  "*4* - Tenho um serviço contratado e preciso de suporte\n" +
  "*5* - Outros assuntos\n" +
  "*6* - Não sou cliente, mas preciso falar com você\n" +
  "*7* - Estou em um evento e desejo baixar minha foto";

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
  const numeros = texto.replace(/\D+/g, "").split("");
  const unicos = [...new Set(numeros)];
  return unicos
    .map(n => parseInt(n, 10))
    .filter(n => n >= 1 && n <= 8);
}

function extrairDatasCorporativas(texto) {
  const partes = texto
    .split(/[\s,;]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const datasValidas = [];

  for (const parte of partes) {
    const regex = /^(0[1-9]|[12][0-9]|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](\d{2}|\d{4})$/;
    if (!regex.test(parte)) continue;

    const sep = parte.includes("/") ? "/" : parte.includes(".") ? "." : "-";
    const [dia, mes, ano] = parte.split(sep);
    const anoCompleto = ano.length === 2 ? `20${ano}` : ano;

    const data = new Date(`${anoCompleto}-${mes}-${dia}`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (data >= hoje) {
      datasValidas.push(`${dia}/${mes}/${anoCompleto}`);
    }
  }

  return datasValidas;
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
// FUNÇÃO — MOSTRAR MENU INICIAL
// ======================================================
async function mostrarMenuInicial(chatId) {
  await sendTyping(chatId);
  await sendText(chatId, mensagemBoasVindas);

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
// ======================================================


// ======================================================
// ENVIO DE MÚLTIPLOS ORÇAMENTOS — VERSÃO ATUALIZADA
// ======================================================
async function enviarMultiplosOrcamentos(chatId, listaServicos) {
  const session = sessions[chatId];
  if (!session) return true;

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
    for (const servico of listaServicos) {

      while (session.processandoServico) {
        await new Promise(r => setTimeout(r, 300));
      }

      const celebracaoId = session.orcamento.celebracaoId;
      const convidados = session.orcamento.convidados;
      const horas = Number.parseInt(session.orcamento.duracao, 10) || session.orcamento.horas || 4;
      const dias = session.orcamento.dias || 1;

      console.log(`📤 Enviando orçamento do serviço ${servico} para ${chatId}`);

      // ✅ IMPORTANTE: Passar modoManual=true para NÃO enviar avaliação novamente
      await enviarOrcamentoUnificado(
        chatId,
        servico,
        celebracaoId,
        convidados,
        horas,
        dias,
        true  // ✅ modoManual=true previne re-envio de avaliação
      );

      registrarServicoEnviado(session, servico);

      await new Promise(resolve => setTimeout(resolve, 600));
    }    
    
      // 📌 RESUMO FINAL DO EVENTO PARA O CLIENTE (UMA VEZ)
      await enviarResumoCliente(chatId, session);

      await sendTyping(chatId);
      await sendText(chatId, "Perfeito! Qualquer dúvida estou por aqui 😊");

      await sendTyping(chatId);
      await sendText(chatId, "Deus abençoe você e sua família, grandiosamente!!!");

      session.step = "orcamento_mais_servicos";
      // Captura aniversário do cliente para sistema de comemorações (fire and forget)
      if (!session.orcamento?.capturado) {
        session.orcamento = session.orcamento || {};
        session.orcamento.capturado = true;
        capturarClienteOrcamento(chatId, session).catch(() => {});
      }
      await perguntarMaisOrcamentos(chatId);

    return;

  } finally {
    session.enviandoOrcamentos = false;
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
// HELPER — SALVAR ÚLTIMA PERGUNTA NÃO RESPONDIDA
// ======================================================
async function enviarPerguntaESalvar(chatId, session, pergunta) {
  await sendTyping(chatId);
  await sendText(chatId, pergunta);
  session.ultimaPerguntaNaoRespondida = pergunta; // 📌 Guardar pergunta
}

// ======================================================
// HELPER — MENSAGEM DE AGUARDE (SINGULAR/PLURAL)
// ======================================================
async function enviarMsgAguardeOrcamento(chatId, quantidade) {
  if (quantidade === 1) {
    await sendText(chatId, "⏳ Aguarde, estou enviando seu orçamento!");
  } else {
    await sendText(chatId, "⏳ Aguarde, estou enviando seus orçamentos!");
  }
  await new Promise(r => setTimeout(r, 500));
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
  const isOperador = message.fromMe === true && message.fromApi !== true;
  const isBot = message.fromApi === true;

  // ignora mensagens enviadas pelo próprio bot
  if (isBot) {
    console.log("⏭ Ignorando mensagem enviada pelo próprio bot.");
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
          OPERADOR_TELEFONE_ID,
          "⚠ Você precisa informar um número.\nExemplo:\n#cliente 5521993290588"
        );
        return;
      }

      const numeroNormalizado = normalizarNumero(numeroBruto);

      if (!numeroNormalizado || numeroNormalizado.length < 11) {
        await sendText(
          OPERADOR_TELEFONE_ID,
          "⚠ Número inválido. Informe no formato:\n#cliente 5521993290588"
        );
        return;
      }

      sessions["__cliente_manual__"] = numeroNormalizado;

      console.log("📌 [MANUAL] Cliente definido manualmente:", numeroNormalizado);

      await sendText(
        OPERADOR_TELEFONE_ID,
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
        OPERADOR_TELEFONE_ID,
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

        await sendText(OPERADOR_TELEFONE_ID, `✅ Cliente PAUSADO!`);
      } else {
        await sendText(OPERADOR_TELEFONE_ID, `❌ Falha ao pausar — verifique a conexão com o servidor`);
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

        await sendText(OPERADOR_TELEFONE_ID, `✅ Cliente RETOMADO!`);
      } else {
        await sendText(OPERADOR_TELEFONE_ID, `❌ Número não encontrado (JSON nem DB)`);
      }
      return;
    }

    // ======================================================
    // LISTAR PAUSA ESPECIAL
    // COMANDO: listarpausas
    // ======================================================
    if (corpoNormalizado === "listarpausas") {
      listarPausadosEspeciais();
      await sendText(OPERADOR_TELEFONE_ID, `📋 Lista enviada ao console`);
      return;
    }

    // ======================================================
    // PAUSAR (pausa normal - só de operador)
    // COMANDO: pausar 21 99999-8888
    // ======================================================
    if (corpoNormalizado.startsWith("pausar")) {
      const normalizado = normalizarNumero(numero);
      pausarCliente(normalizado);
      await sendText(OPERADOR_TELEFONE_ID, `⏸ Atendimento pausado para ${normalizado}`);
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
        await sendText(OPERADOR_TELEFONE_ID, `▶ Atendimento retomado para ${normalizado} (estava em: ${session.step})`);
        
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
        await sendText(OPERADOR_TELEFONE_ID, `▶ Atendimento retomado para ${normalizado} (sem contexto anterior)`);
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
      await sendText(OPERADOR_TELEFONE_ID, `🔄 Atendimento resetado para ${normalizado}`);
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
      const partesCmd = primeiraLinha.split(/\s+/);
      const numeroRaw = partesCmd[1] || "";
      const corpoConversa = linhasCmd.slice(1).join("\n");

      if (!numeroRaw) {
        await sendText(OPERADOR_TELEFONE_ID,
          "⚠ Formato:\n*respondercliente NUMERO*\n[cole a conversa exportada do WhatsApp abaixo]"
        );
        return;
      }

      const numeroCliente = normalizarNumero(numeroRaw);
      if (!numeroCliente || numeroCliente.length < 10) {
        await sendText(OPERADOR_TELEFONE_ID,
          `⚠ Número inválido: *${numeroRaw}*\n\n` +
          "Formatos aceitos:\n" +
          "  +5521995021656\n  5521995021656\n  21995021656\n  995021656"
        );
        return;
      }

      // --- Detectar se veio conversa para replay ---
      const temConversa = /\[[\d:,\/ ]+\]/.test(corpoConversa);

      if (!temConversa) {
        await sendText(OPERADOR_TELEFONE_ID,
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
          if (speakerDigits.length < 6) continue; // nome do bot sem números
          const isCliente =
            speakerDigits === clienteDigits ||
            clienteDigits.endsWith(speakerDigits.slice(-10)) ||
            speakerDigits.endsWith(clienteDigits.slice(-10));
          if (isCliente) msgs.push(conteudo);
        }
        return msgs;
      }

      const mensagensCliente = parsearConversa(corpoConversa, numeroCliente);

      if (mensagensCliente.length === 0) {
        await sendText(OPERADOR_TELEFONE_ID,
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

      await sendText(OPERADOR_TELEFONE_ID,
        `🔄 Reconstruindo sessão de *${numeroCliente}*...\n` +
        `📋 ${mensagensCliente.length} mensagens encontradas:\n` +
        mensagensCliente.map((m, i) => `${i + 1}. "${m}"`).join("\n")
      );

      // --- Replay silencioso (N-1 mensagens) ---
      ativarModoSilencioso(numeroCliente);
      let replayOk = true;
      try {
        for (let i = 0; i < mensagensCliente.length - 1; i++) {
          const msg = mensagensCliente[i];
          const stepAntes = sessions[numeroCliente]?.step;
          console.log(`🔇 [Replay ${i + 1}/${mensagensCliente.length - 1}] step=${stepAntes} msg="${msg}"`);
          await handleIncomingMessage(criarSimulada(numeroCliente, msg));
          await new Promise(r => setTimeout(r, 80)); // pequena pausa anti-race
        }
      } catch (e) {
        replayOk = false;
        console.error("🚨 [Replay] Erro durante replay silencioso:", e.message);
        await sendText(OPERADOR_TELEFONE_ID, `❌ Erro no replay: ${e.message}`);
      } finally {
        desativarModoSilencioso(numeroCliente);
      }

      if (!replayOk) return;

      // --- Última mensagem em modo normal (cliente recebe a próxima pergunta) ---
      const ultima = mensagensCliente[mensagensCliente.length - 1];
      const stepFinal = sessions[numeroCliente]?.step || "?";
      console.log(`▶️ [Replay FINAL] step=${stepFinal} msg="${ultima}"`);

      await handleIncomingMessage(criarSimulada(numeroCliente, ultima));

      await sendText(OPERADOR_TELEFONE_ID,
        `✅ Sessão reconstruída com sucesso!\n\n` +
        `👤 Cliente: *${numeroCliente}*\n` +
        `📩 Última resposta reproduzida: *"${ultima}"*\n` +
        `📍 Step final: *${sessions[numeroCliente]?.step || "?"}*\n\n` +
        `O cliente acabou de receber a próxima pergunta e pode continuar normalmente.`
      );
      return;
    }

    // ======================================================
    // RESPONDER NO LUGAR DO CLIENTE
    // COMANDO: responder NUMERO RESPOSTA
    // Ex: responder 5521995021656 pular
    //     responder 5521995021656 2
    // ======================================================
    if (corpoNormalizado.startsWith("responder")) {
      // Extrai as partes: ["responder", "NUMERO", "resposta", "texto", ...]
      const partes = corpoMensagem.trim().split(/\s+/);
      const numeroRaw  = partes[1] || "";
      const respostaTexto = partes.slice(2).join(" ").trim();

      if (!numeroRaw || !respostaTexto) {
        await sendText(
          OPERADOR_TELEFONE_ID,
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
        await sendText(OPERADOR_TELEFONE_ID,
          `⚠ Número inválido: *${numeroRaw}*\n\n` +
          "Formatos aceitos:\n" +
          "  +5521995021656\n  5521995021656\n  21995021656\n  995021656"
        );
        return;
      }

      const sessaoCliente = sessions[numeroCliente];
      if (!sessaoCliente) {
        await sendText(
          OPERADOR_TELEFONE_ID,
          `⚠ Nenhuma sessão ativa para *${numeroCliente}*.\n` +
          `Use *resetar ${numeroCliente}* para reiniciar o atendimento.`
        );
        return;
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
        OPERADOR_TELEFONE_ID,
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

      const comandos = corpoMensagem
        .replace(/\n/g, " ")
        .replace(/;/g, " , ")
        .replace(/\s+#/g, " , #")
        .split(/,(?=\s*#)/g)
        .map(c => c.trim())
        .filter(c => c.startsWith("#"));

      if (comandos.length === 0) {
        await sendText(OPERADOR_TELEFONE_ID, "⚠ Nenhum comando manual válido encontrado.");
        return;
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
          const matchInline = c.match(/[ \t](\+?\d[\d\s\-()]{6,}\d)\s*$/);
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
          OPERADOR_TELEFONE_ID,
          "⚠ Não consegui identificar o cliente destino.\n\n" +
          "Escolha uma das formas abaixo:\n\n" +
          "1️⃣ *Envie o comando no chat do cliente* (método principal)\n\n" +
          "2️⃣ *Número inline no comando:*\n" +
          "   `#fotocabine 0,1,50,4,1 2199999-9888`\n" +
          "   `#fotocabine 0,1,50,4,1 +55 21 99999-9888`\n\n" +
          "3️⃣ *Seta (->):*\n" +
          "   `#fotocabine 0,1,50,4,1 -> 5521993290588`\n\n" +
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
      
      // 📌 AVISAR CLIENTE QUE ESTÁ ENVIANDO (SINGULAR/PLURAL)
      await enviarMsgAguardeOrcamento(chatIdCliente, comandos.length);

      let controlaMsgManual = 0;
      let controlaMsgManual2 = 0;

      for (const cmd of comandos) {
        controlaMsgManual++;
        await sendText(OPERADOR_TELEFONE_ID, `controlaMsgManual = ${controlaMsgManual}`);
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
            await sendText(OPERADOR_TELEFONE_ID, `✅ Informações de 1ª Eucaristia enviadas para *${chatIdCliente}*`);
          } catch (e) {
            await sendText(OPERADOR_TELEFONE_ID, `❌ Erro ao enviar Eucaristia: ${e.message}`);
          }
          controlaMsgManual2++;
          continue;
        }

        if (!comandosServicos[nomeComando]) {
          await sendText(OPERADOR_TELEFONE_ID, `⚠ Comando não reconhecido: ${nomeComando}`);
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

        // ✅ NOVO: Enviar avaliação UMA VEZ se solicitado
        if (enviarAvaliacao && !session.enviouAvaliacao) {
          console.log(`📊 Enviando avaliação da empresa (solicitado)...`);
          await enviarAvaliacaoEmpresa(chatIdCliente, sessions);
          
          // Aguardar avaliação terminar
          while (session.enviandoAvaliacao) {
            await new Promise(r => setTimeout(r, 300));
          }
          
          session.enviouAvaliacao = true;
        }

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

        controlaMsgManual2++;
        await sendText(OPERADOR_TELEFONE_ID, `controlaMsgManual2 = ${controlaMsgManual2}`);

        // 📌 REGISTRAR SERVIÇO ENVIADO
        registrarServicoEnviado(session, servicoId);

        // 📌 INCREMENTAR CONTADOR        
        console.log(`📌 Processado ${controlaMsgManual} de ${comandos.length} comandos`);

        await new Promise(r => setTimeout(r, 500));

        console.log("📌 Cliente via destino do webhook:", controlaMsgManual);
        console.log("📌 Cliente via destino do webhook:", numeroCliente);
      }

      await sendText(OPERADOR_TELEFONE_ID, `controlaMsgManual = ${controlaMsgManual} e controlaMsgManual2 = ${controlaMsgManual2}`);

      if(controlaMsgManual === controlaMsgManual2 && session.orcamento.servicosEnviados.length > 0){
        // 📌 AGUARDAR UM POUCO ANTES DO RESUMO
        await new Promise(r => setTimeout(r, 800));

        // 📌 ENVIAR RESUMO DO EVENTO PARA O CLIENTE
        await enviarResumoCliente(chatIdCliente, session);

        // 📌 MENSAGENS FINAIS PARA O CLIENTE
        await new Promise(r => setTimeout(r, 500));
        await sendTyping(chatIdCliente);
        await sendText(chatIdCliente, "Perfeito! Qualquer dúvida estou por aqui 😊");

        await new Promise(r => setTimeout(r, 300));

        await sendTyping(chatIdCliente);
        await sendText(chatIdCliente, "Deus abençoe você e sua família, grandiosamente!!!");

        // 📌 ENVIAR RESUMO PARA O OPERADOR
        await new Promise(r => setTimeout(r, 500));
        await enviarResumoOperador(OPERADOR_TELEFONE_ID, session);

        // 📌 REPAUSAR SE ESTAVA PAUSADO
        if (estavaPausado) pausarCliente(chatIdCliente);

        await sendText(
          OPERADOR_TELEFONE_ID,
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
  // IMPEDIR QUE O OPERADOR CAIA NO FLUXO DO CLIENTE
  // ======================================================
  if (isOperador) {
    console.log("👨‍💼 Mensagem do operador ignorada após comandos.");
    return;
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

      default:
        // Se o cliente mandou texto puro (ex.: "oi", "olá", "tudo bem") em vez de número,
        // reenvia o menu de boas-vindas em vez de mostrar "opção inválida"
        if (opcaoMenu === "") {
          session.menuInicialEnviado = false;
          await mostrarMenuInicial(chatId);
        } else {
          await sendText(
            chatId,
            "*⚠ Opção inválida!* Escolha uma das opções do menu digitando apenas o número: *(Digite somente número)*\n\n" +
            "*1* - Solicitar um orçamento\n" +
            "*2* - Fotografia 1ª Eucaristia\n" +
            "*3* - Estou em processo de contratação\n" +
            "*4* - Tenho um serviço contratado e preciso de suporte\n" +
            "*5* - Outros assuntos\n" +
            "*6* - Não sou cliente, mas preciso falar com você\n" +
            "*7* - Estou em um evento e desejo baixar minha foto"
          );
        }
        return;
    }
  }

  // ======================================================
  // SELEÇÃO DE EVENTO
  // ======================================================
  if (session.step === "aguardando_numero_evento") {
    const numero = corpoMensagem.trim();
    const evento = session.eventosLista?.find(e => e.numero === numero);

    if (!evento) {
      await sendText(chatId, "⚠ Evento não encontrado! Digite novamente o número correto.");
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
  await sendText(
    chatId,
    "Por favor, escolha a Paróquia que seu filho faz catequese: *(Digite somente número)*\n\n" +
    "*1* - Paróquia São José\n" +
    "*2* - Paróquia São Sebastião"
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
  const listaCapelas = Object.keys(capelas)
    .map(k => `*${k}* - ${capelas[k]}`)
    .join("\n");

  await sendTyping(chatId);
  await sendText(chatId, "Qual a Capela? *(Digite somente número)*\n\n" + listaCapelas);
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
    session.orcamento.nome = nome;
    session.step = "orcamento_celebracao";

    await sendTyping(chatId);
    await sendText(chatId, `Olá, *${nome}*! \nAgora, me fale um pouco sobre o seu evento`);

    await sendTyping(chatId);
    await sendText(
      chatId,
      "O que vai celebrar? (*Digite somente o número*)\n\n" +
      "*1* - Aniversário de 15 anos\n" +
      "*2* - Casamento\n" +
      "*3* - Aniversário Infantil\n" +
      "*4* - Aniversário Adolescente\n" +
      "*5* - Aniversário Adulto\n" +
      "*6* - Bodas\n" +
      "*7* - Formatura\n" +
      "*8* - Evento Corporativo\n" +
      "*9* - Outros"
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
    session.step = "orcamento_convidados";

    await enviarPerguntaESalvar(chatId, session, "Quantos convidados?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — CELEBRAÇÃO OUTROS
  // ======================================================
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
    session.step = "orcamento_data";

    await enviarPerguntaESalvar(chatId, session, "Qual a data do evento? (Ex: *01/02/2026*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — DATA
  // ======================================================
  if (session.step === "orcamento_data") {
    const regexData =
      /^(0[1-9]|[12][0-9]|3[01])[\/.\-](0[1-9]|1[0-2])[\/.\-](\d{2}|\d{4})$/;

    if (!regexData.test(corpoMensagem)) {
      await sendText(chatId, "*⚠ Data inválida!* Use o formato: *01/02/2026*");
      return;
    }

    const separador = corpoMensagem.includes("/")
      ? "/"
      : corpoMensagem.includes(".")
      ? "."
      : "-";

    const [dia, mes, ano] = corpoMensagem.split(separador);
    const anoCompleto = ano.length === 2 ? `20${ano}` : ano;

    const dataEvento = new Date(`${anoCompleto}-${mes}-${dia}`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataEvento < hoje) {
      await sendText(chatId, "*⚠ A data do evento não pode estar no passado!*");
      return;
    }

    session.orcamento.data = `${dia}/${mes}/${anoCompleto}`;
    session.step = "orcamento_hora_inicio";

    await enviarPerguntaESalvar(chatId, session, "Qual o horário de início? (*Ex: 18:00*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORA INÍCIO
  // ======================================================
  if (session.step === "orcamento_hora_inicio") {
    const horarioNormalizado = normalizarHorario(corpoMensagem);

    if (!horarioNormalizado) {
      await sendText(chatId, "*⚠ Horário inválido!* Use o formato *18:00*.");
      return;
    }

    session.orcamento.horaInicio = horarioNormalizado;
    session.step = "orcamento_hora_fim";

    await enviarPerguntaESalvar(chatId, session, "Qual o horário de término? (*Ex: 23:00*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — HORA FIM
  // ======================================================
  if (session.step === "orcamento_hora_fim") {
    const horarioNormalizado = normalizarHorario(corpoMensagem);

    if (!horarioNormalizado) {
      await sendText(chatId, "*⚠ Horário inválido!* Use o formato *23:00*");
      return;
    }

    const [horaInicio, minInicio] = session.orcamento.horaInicio.split(":").map(Number);
    const [horaFim, minFim] = horarioNormalizado.split(":").map(Number);

    let minutosInicio = horaInicio * 60 + minInicio;
    let minutosFim = horaFim * 60 + minFim;

    if (minutosFim <= minutosInicio) {
      minutosFim += 24 * 60;
    }

    if (minutosFim - minutosInicio <= 0) {
      await sendText(chatId, "*⚠ O horário de término deve ser diferente do início.*");
      return;
    }

    session.orcamento.horaFim = horarioNormalizado;
    session.orcamento.duracao = calcularDuracaoEvento(
      session.orcamento.horaInicio,
      session.orcamento.horaFim
    );

    // FIX: garantir horas numéricas para os serviços
    session.orcamento.horas = Number.parseInt(session.orcamento.duracao, 10) || 2;

    session.step = "orcamento_local";

    await sendTyping(chatId);
    await sendText(chatId, "Qual o local do evento? (*bairro/cidade/salão*)");
    return;
  }

  // ======================================================
  // ORÇAMENTO — LOCAL
  // ======================================================
  if (session.step === "orcamento_local") {
    if (!corpoMensagem || corpoMensagem.length < 2) {
      await sendText(chatId, "*⚠ Informe um local válido.*");
      return;
    }

    session.orcamento.local = capitalizarPalavras(corpoMensagem);

    if (session.orcamento.celebracaoId === 8) {
      session.step = "orcamento_corporativo_dias";
      await sendTyping(chatId);
      await sendText(chatId, "Quantos dias de evento? (*Digite somente número*)");
      return;
    }

    session.step = "orcamento_onde_encontrou";
    await sendTyping(chatId);
    await sendText(chatId, "Onde nos encontrou?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — CORPORATIVO DIAS
  // ======================================================
  if (session.step === "orcamento_corporativo_dias") {
    const dias = parseInt(corpoMensagem.replace(/\D+/g, ""), 10);

    if (isNaN(dias) || dias <= 0) {
      await sendText(chatId, "*⚠ Digite apenas números válidos.*");
      return;
    }

    session.orcamento.dias = dias;

    if (dias > 1) {
      session.step = "orcamento_corporativo_datas";
      await sendTyping(chatId);
      await sendText(
        chatId,
        "Informe as datas do evento.\nUse o formato DD/MM/AAAA.\nExemplo: *01/02/2026, 02/02/2026*"
      );
      return;
    }

    session.step = "orcamento_onde_encontrou";
    await sendTyping(chatId);
    await sendText(chatId, "Onde nos encontrou?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — CORPORATIVO DATAS
  // ======================================================
  if (session.step === "orcamento_corporativo_datas") {
    const datas = extrairDatasCorporativas(corpoMensagem);

    if (!datas.length) {
      await sendText(chatId, "*⚠ Nenhuma data válida encontrada!*");
      return;
    }

    session.orcamento.datasCorporativo = datas;

    session.step = "orcamento_onde_encontrou";
    await sendTyping(chatId);
    await sendText(chatId, "Onde nos encontrou?");
    return;
  }

  // ======================================================
  // ORÇAMENTO — ONDE ENCONTROU
  // ======================================================
  if (session.step === "orcamento_onde_encontrou") {
    session.orcamento.ondeEncontrou = capitalizarPalavras(corpoMensagem);
    session.step = "orcamento_detalhes";

    await sendTyping(chatId);
    await sendText(
      chatId,
      "Deseja informar mais detalhes do seu evento?\n*1* - Sim\n*2* - Não"
    );
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
    if (corpoMensagem !== "1" && corpoMensagem !== "2") {
      await sendText(chatId, "*⚠ Escolha apenas 1 (Sim) ou 2 (Não).*");
      return;
    }

    if (corpoMensagem === "1") {
      session.step = "orcamento_detalhes_texto";
      await sendTyping(chatId);
      await sendText(chatId, "*Digite os detalhes adicionais:*");
      return;
    }

    session.orcamento.detalhes = null;
    session.step = "coletar_email_opcional";

    await sendTyping(chatId);
    await sendText(
      chatId,
      "*Para deixar seu orçamento ainda mais completo, posso te pedir duas informações rápidas?*"      
    );

    await sendTyping(chatId);
    await sendText(
      chatId,      
      "Um *e-mail* para enviar o *orçamento em PDF* também, caso tenha dificuldade pelo *WhatsApp*.\n" +
      "Ou responda *pular*."
    );
    return;
  }

  // ======================================================
  // ORÇAMENTO — DETALHES TEXTO
  // ======================================================
  if (session.step === "orcamento_detalhes_texto") {
    session.orcamento.detalhes = capitalizarPalavras(corpoMensagem);

    session.step = "coletar_email_opcional";

    await sendTyping(chatId);
    await sendText(
      chatId,
      "*Para deixar seu orçamento ainda mais completo, posso te pedir duas informações rápidas?*"      
    );

    await sendTyping(chatId);
    await sendText(
      chatId,      
      "Um *e-mail* para enviar o *orçamento em PDF* também, caso tenha dificuldade pelo *WhatsApp*.\n" +
      "Ou responda *pular*."
    );
    return;
  }

  // ======================================================
  // COLETAR E-MAIL OPCIONAL (NÃO BLOQUEANTE)
  // ======================================================
  if (session.step === "coletar_email_opcional") {

    const texto = corpoMensagem.trim();

    // regex simples e segura de e-mail
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (texto.toLowerCase() === "pular") {
      session.orcamento.email = null;
    } else if (regexEmail.test(texto)) {
      session.orcamento.email = texto;
    } else {
      // qualquer outra coisa → ignora silenciosamente
      session.orcamento.email = null;
    }

    session.step = "coletar_nascimento_opcional";

    await sendTyping(chatId);
    await sendText(
      chatId,
      "Sua data de nascimento *(exemplo: 01/02/1985)*.\n" +
      "Ou responda *pular*."
    );

    return;
  }

  // ======================================================
  // COLETAR NASCIMENTO OPCIONAL (NÃO BLOQUEANTE)
  // ======================================================
  if (session.step === "coletar_nascimento_opcional") {

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

    // Avança para o próximo step
    session.step = "orcamento_escolher_servico";

    await sendTyping(chatId);
    await sendText(
      chatId,
      "Agora escolha os serviços que deseja orçamento (para mais de um, digite os números separados por vírgula, ex: *1,3,5 ou 124*):\n\n" +
      "*1* - Foto Cabine\n" +
      "*2* - Totem Fotográfico\n" +
      "*3* - Plataforma 360º\n" +
      "*4* - Foto Paparazzi Digital\n" +
      "*5* - Foto Lembrança\n" +
      "*6* - Cobertura Fotográfica\n" +
      "*7* - Som Completo com DJ\n" +
      "*8* - Iluminação para Pista de Dança"
    );

    return;
  }


  // ======================================================
  // ORÇAMENTO — PRIMEIRA RODADA DE SERVIÇOS
  // ======================================================
  if (session.step === "orcamento_escolher_servico") {
    const servicos = extrairServicosDaMensagem(corpoMensagem);

    if (servicos.length === 0) {
      await sendText(chatId, "*⚠ Digite pelo menos um número válido entre 1 e 8.*");
      return;
    }

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
            "Escolha novamente os serviços desejados (ex: 1,3,5):\n\n" +
            "*1* - Foto Cabine\n" +
            "*2* - Totem Fotográfico\n" +
            "*3* - Plataforma 360º\n" +
            "*4* - Foto Paparazzi Digital\n" +
            "*5* - Foto Lembrança\n" +
            "*6* - Cobertura Fotográfica\n" +
            "*7* - Som Completo com DJ\n" +
            "*8* - Iluminação para Pista de Dança"
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

    // 📌 AVISAR CLIENTE QUE ESTÁ ENVIANDO ORÇAMENTOS (SINGULAR/PLURAL)
    await enviarMsgAguardeOrcamento(chatId, servicos.length);
    
    await enviarMultiplosOrcamentos(chatId, servicos);

    session.primeiraRodadaFinalizada = true;
    session.step = "orcamento_mais_servicos";
    // Captura aniversário do cliente para sistema de comemorações (fire and forget)
    if (!session.orcamento?.capturado) {
      session.orcamento = session.orcamento || {};
      session.orcamento.capturado = true;
      capturarClienteOrcamento(chatId, session).catch(() => {});
    }
    return;
  }

  // ======================================================
  // ORÇAMENTO — MAIS SERVIÇOS (SEGUNDA RODADA)
  // ======================================================
  if (session.step === "orcamento_mais_servicos") {

    if (corpoMensagem !== "1" && corpoMensagem !== "2") {
      // Conta tentativas inválidas — após 3 ignora silenciosamente (sem pausar)
      session.tentativasInvalidasMaisServicos = (session.tentativasInvalidasMaisServicos || 0) + 1;
      if (session.tentativasInvalidasMaisServicos >= 3) {
        console.log(`ℹ️ ${chatId} excedeu tentativas em orcamento_mais_servicos. Ignorando.`);
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
    const todosServicos = [1, 2, 3, 4, 5, 6, 7, 8];

    const restantes = todosServicos.filter(
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
      (restantes.includes(1) ? "*1* - Foto Cabine\n" : "") +
      (restantes.includes(2) ? "*2* - Totem Fotográfico\n" : "") +
      (restantes.includes(3) ? "*3* - Plataforma 360º\n" : "") +
      (restantes.includes(4) ? "*4* - Foto Paparazzi Digital\n" : "") +
      (restantes.includes(5) ? "*5* - Foto Lembrança\n" : "") +
      (restantes.includes(6) ? "*6* - Cobertura Fotográfica\n" : "") +
      (restantes.includes(7) ? "*7* - Som Completo com DJ\n" : "") +
      (restantes.includes(8) ? "*8* - Iluminação para Pista de Dança" : "")
    );

    return;
  }

  console.log("ℹ️ Nenhum fluxo correspondente ao step atual, mensagem ignorada.");
}

// ======================================================
// EXPORTAÇÃO
// ======================================================
module.exports = {
  handleIncomingMessage
};

// ======================================================
// RESUMO DO CLIENTE (OPERADOR)
// ===================================================

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
    if (orc.email) linhas.push(`${index++}. E-mail: *${orc.email}*`);
    if (orc.dataNascimento) linhas.push(`${index++}. Data de Nascimento: *${orc.dataNascimento}*`);

    if (orc.celebracaoId) {
      linhas.push(`${index++}. Celebração: *${celebracoes[orc.celebracaoId] || "Não especificada"}*`);
    }
    
    if (orc.convidados) {
      linhas.push(`${index++}. Convidados: *${orc.convidados}*`);
    }
    
    // ✅ Corrigido: usar `orc.data` em vez de `orc.data`
    if (orc.data) linhas.push(`${index++}. Data do Evento: *${orc.data}*`);
    
    // ✅ Corrigido: usar `orc.horaInicio` em vez de `orc.horario`
    if (orc.horaInicio) linhas.push(`${index++}. Horário de Início: *${orc.horaInicio}*`);
    
    // ✅ Novo: adicionar `orc.horaFim` (hora de término)
    if (orc.horaFim) linhas.push(`${index++}. Horário de Término: *${orc.horaFim}*`);
    
    if (orc.horas) linhas.push(`${index++}. Duração: *${orc.horas} horas*`);

    if (orc.dias && orc.dias > 1) {
      linhas.push(`${index++}. Dias: *${orc.dias}*`);
    }

    // ✅ Corrigido: usar `orc.local` (já estava correto)
    if (orc.local) linhas.push(`${index++}. Local do Evento: *${orc.local}*`);
    if (orc.origemLead) linhas.push(`${index++}. Onde nos encontrou: *${orc.origemLead}*`);
    
    // ✅ Corrigido: usar `orc.detalhes` em vez de `orc.observacoes`
    if (orc.detalhes) linhas.push(`${index++}. Detalhes do Evento: *${orc.detalhes}*`);

    // 🎯 MOSTRAR SERVIÇOS ENVIADOS
    const servicosMap = {
      1: "Foto Cabine",
      2: "Totem Fotográfico",
      3: "Plataforma 360",
      4: "Foto Paparazzi Digital",
      5: "Foto Lembrança",
      6: "Cobertura Fotográfica",
      7: "Som Completo com DJ",
      8: "Iluminação para Pista de Dança"
    };

    const servicos = (orc.servicosEnviados || [])
      .map(id => servicosMap[id])
      .filter(Boolean)
      .map(s => `*${s}*`)
      .join("\n   • ");

    if (servicos) {
      linhas.push(`\n${index++}. Serviço(s) Contratado(s):`);
      linhas.push(`   • ${servicos}`);
    }

    linhas.push(`\n${index++}. Origem: *PhotoMusic Produções*`);
    linhas.push(`${index++}. Enviado em: *${new Date().toLocaleString("pt-BR")}*`);

    await sendTyping(chatId);
    await sendText(chatId, linhas.join("\n"));

  } catch (erro) {
    console.error("Erro ao enviar resumo para o cliente:", erro);
  }
}

// ======================================================
// RESUMO PARA O OPERADOR (APÓS ENVIO MANUAL)
// ======================================================
async function enviarResumoOperador(chatIdCliente, session) {
  try {
    const orc = session.orcamento || {};

    const linhas = [];
    linhas.push("📊 *RESUMO DO ENVIO MANUAL*\n");

    linhas.push(`- Cliente: *${chatIdCliente}*`);
    
    if (orc.celebracaoId) {
      linhas.push(`- Celebração: *${celebracoes[orc.celebracaoId] || "Não especificada"}*`);
    }
    
    if (orc.convidados) {
      linhas.push(`- Convidados: *${orc.convidados}*`);
    }
    
    if (orc.horas) linhas.push(`- Tempo do evento: *${orc.horas} horas*`);

    if (orc.dias && orc.dias > 1) {
      linhas.push(`- Dias: *${orc.dias}*`);
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
        8: "Iluminação"
      }[id]))
      .filter(Boolean)
      .join(", ");

    if (servicos) {
      linhas.push(`- Serviço(s): *${servicos}*`);
    }

    linhas.push(`- Enviado em: *${new Date().toLocaleString("pt-BR")}*`);

    await sendTyping(OPERADOR_TELEFONE_ID);
    await sendText(OPERADOR_TELEFONE_ID, linhas.join("\n"));

  } catch (erro) {
    console.error("Erro ao enviar resumo para o operador:", erro);
  }
}

