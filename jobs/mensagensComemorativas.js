// jobs/mensagensComemorativas.js — Sistema de Mensagens Comemorativas

const axios = require("axios");
const cron = require("node-cron");
const { esperaEntreEnvios } = require("../utils/intervaloEnvio.js");
const { sendText } = require("../utils/index.js");

// ================= NORMALIZAÇÃO DE NÚMEROS (VERSÃO COMPLETA DO CHATBOT) =================
function normalizarNumero(numero) {
  if (!numero) return null;

  numero = String(numero);
  numero = numero.replace("@c.us", "");
  numero = numero.replace(/\D+/g, "");
  numero = numero.replace(/^0+/, "");

  if (numero.startsWith("55") && numero.length === 13) return numero;
  if (numero.startsWith("55") && numero.length === 12) return numero;

  if (numero.startsWith("21") && (numero.length === 10 || numero.length === 11))
    return "55" + numero;

  if (numero.length === 9 && numero.startsWith("9"))
    return "5521" + numero;

  if (numero.length === 8)
    return "55219" + numero;

  // 13 dígitos sem prefixo 55 = número internacional completo
  // (ex: Alemanha 4917112345678) — NÃO adicionar 55, senão vira número inválido
  if (numero.length === 13 && !numero.startsWith("55"))
    return numero;

  // 11 dígitos: celular brasileiro tem o 3º dígito (índice 2) = '9'
  // (DDD 2 dígitos + dígito 9 + 8 dígitos do número)
  // Se o 3º dígito NÃO for '9', é número internacional sem prefixo +
  // Exemplo EUA: +1 (561) 710-1530 → 15617101530 → [2]='6' → não adiciona 55
  if (numero.length === 11) {
    if (numero[2] === '9') return "55" + numero; // celular BR confirmado
    return numero; // internacional — retorna como veio, sem adicionar 55
  }

  if (numero.length === 10)
    return "55" + numero;

  return numero;
}

// ================= CONFIGURAÇÕES =================
// Endpoint unificado: DB + pm_eventos + pm_eucaristia_catequizandos
const URL_ENDPOINT = "https://photomusic.com.br/wp-json/photomusic/v1/comemoracao-contatos";
const URL_CONFIG   = "https://photomusic.com.br/wp-content/dados/comemoracoes-config.json";

// Timezone padrão para fallback
const TIMEZONE_PADRAO = "America/Sao_Paulo";

// ✅ NOVO: Rastrear mensagens já enviadas HOJE (por telefone + tipo)
const mensagensEnviadas = new Map();

// Variáveis globais - carregadas do arquivo de configuração
let cronTask = null;
let configAtual = null;
let taskLimpeza = null;

// ================= CARREGAR CONFIGURAÇÃO =================
async function carregarConfiguracao() {
  try {
    console.log(`\n📥 Carregando configuração de: ${URL_CONFIG}`);
    const resposta = await axios.get(URL_CONFIG);
    const novaConfig = resposta.data;

    console.log(`✅ Configuração carregada:`, novaConfig);
    return novaConfig;
  } catch (erro) {
    console.error(`⚠️  Erro ao carregar configuração:`, erro.message);
    // Fallback apenas se arquivo não existir
    console.log(`⚠️  Usando fallback padrão`);
    return {
      horario: "0 10 * * *",
      timezone: TIMEZONE_PADRAO,
      ativo: true
    };
  }
}

// ================= FUNÇÕES AUXILIARES =================
function hoje() {
  const agora = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: configAtual.timezone || TIMEZONE_PADRAO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const partes = formatter.format(agora).split("/");
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);

  console.log(`📅 Data atual (${configAtual.timezone}): ${dia}/${mes}`);

  return { dia, mes };
}

// ✅ NOVO: Gerar chave única para cada mensagem (telefone + tipo)
function gerarChaveUnica(telefone, tipo, destinatario) {
  return `${telefone}|${tipo}|${destinatario || "padrao"}`;
}

// ✅ NOVO: Verificar se mensagem já foi enviada hoje
function jaFoiEnviada(chave) {
  return mensagensEnviadas.has(chave);
}

// ✅ NOVO: Marcar mensagem como enviada
function marcarComoEnviada(chave) {
  mensagensEnviadas.set(chave, new Date());
  console.log(`   ✔️  Marcado como enviado: ${chave}`);
}

// ✅ NOVO: Limpar rastreador a meia-noite
function inicializarLimpadorDiario() {
  // Executar a meia-noite (00:00) do horário configurado
  const taskLimpeza = cron.schedule("0 0 * * *", () => {
    console.log(`\n🧹 Limpando rastreador de mensagens comemorativas...`);
    mensagensEnviadas.clear();
    console.log(`✅ Rastreador limpo! Pronto para novo dia.\n`);
  }, {
    timezone: configAtual.timezone || TIMEZONE_PADRAO
  });

  return taskLimpeza;
}

// ================= MENSAGEM 1: ANIVERSÁRIO PESSOAL - RESPONSÁVEL =================
function montarMensagemAniversarioPessoalParaResponsavel(registro) {
  const genero = registro.generoCelebrado;
  const pronome = genero === "feminino" ? "dela" : "dele";

  return (
    `Bom dia, *${registro.nomeResponsavel}*.\n\n` +
    `Hoje é um dia especial: o aniversário🥳🎉🎂 do seu *${registro.relacao} ${registro.nomeCelebrado}*.\n` +
    `Agradecemos a Deus pela vida ${pronome} e pedimos que Ele continue derramando bênçãos, saúde, paz, alegria e felicidade sobre toda a sua família. 🙏\n\n` +
    `Com carinho,🥰🥰\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 2: ANIVERSÁRIO PESSOAL - CELEBRADO =================
function montarMensagemAniversarioPessoalParaCelebrado(registro) {
  return (
    `Bom dia, *${registro.nomeCelebrado}*.\n\n` +
    `Hoje é um dia muito especial, e nós da *PhotoMusic Produções* queremos agradecer a Deus pela sua vida.\n` +
    `Parabéns!🥳🎉 Que Deus derrame muitas bênçãos, saúde, paz, alegria e felicidade sobre você e sua família. 🙏\n\n` +
    `Com carinho,🥰🥰\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 3: ANIVERSÁRIO DE CASAMENTO - CASAL =================
function montarMensagemAniversarioCasamentoParaCasal(registro) {
  return (
    `Bom dia, *${registro.nomeNoiva} e ${registro.nomeNoivo}*.\n\n` +
    `Hoje é um dia muito especial: celebramos mais um ano da linda união de vocês.🥳🎉\n` +
    `Que Deus continue sendo o alicerce desse casamento, fortalecendo o amor, a fé, a cumplicidade e concedendo muita paz, alegria e prosperidade ao lar de vocês. 🙏\n\n` +
    `Com carinho,🥰🥰\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 4: ANIVERSÁRIO DE CASAMENTO - RESPONSÁVEL =================
function montarMensagemAniversarioCasamentoParaResponsavel(registro) {
  return (
    `Bom dia, *${registro.nomeResponsavel}*.\n\n` +
    `Hoje é um dia muito especial: celebramos mais um ano de união de *${registro.nomeNoiva} e ${registro.nomeNoivo}*.🥳🎉\n` +
    `Que Deus continue sendo o alicerce desse casamento, fortalecendo o amor, a fé e a cumplicidade desse lar, e concedendo muita prosperidade ao casal. 🙏\n\n` +
    `Com carinho,🥰🥰\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 5: DIA DO CASAMENTO - CASAL =================
// Celebração do grande dia do enlace matrimonial. Foco na bênção, alicerce da fé e novo começo.
// Sem mencionar serviço específico. Tom cristão católico celebrativo.
function montarMensagemDiaCasamentoCasal(registro) {
  return (
    `Bom dia, *${registro.nomeNoiva} e ${registro.nomeNoivo}*. 💍✨\n\n` +
    `Chegou o grande dia do enlace matrimonial de vocês! 🥳🎉\n\n` +
    `É um privilégio imenso estar ao lado de vocês neste dia super especial!\n\n` +
    `Que Deus seja o alicerce desse casamento, fortalecendo cada dia o amor, a fé, a cumplicidade e a fidelidade entre vocês. Que Ele derrame muitas bênçãos, saúde, paz, alegria e prosperidade na vida de vocês. 🙏💕\n\n` +
    `Hoje vocês estarão dando um lindo e abençoado passo para a construção de uma família abençoada por Deus.\n\n` +
    `Que a graça de Deus acompanhe vocês sempre!\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 6: DIA DO CASAMENTO - RESPONSÁVEL =================
// Celebração do grande dia do enlace matrimonial para quem contratou. Foco na bênção de Deus sobre a família.
// Sem mencionar serviço específico. Tom cristão católico celebrativo.
function montarMensagemDiaCasamentoResponsavel(registro) {
  return (
    `Bom dia, *${registro.nomeResponsavel}*. 👋\n\n` +
    `Chegou o grande dia do enlace matrimonial de *${registro.nomeNoiva} e ${registro.nomeNoivo}*! 💍✨\n\n` +
    `É um privilégio imenso estar ao lado de vocês neste dia super especial!\n\n` +
    `Que Deus abençoe abundantemente este casal, sendo o alicerce desse casamento. Que Ele fortaleça cada dia o amor, a fé, a cumplicidade e a fidelidade entre eles. Que Ele derrame muitas bênçãos, saúde, paz, alegria e prosperidade na vida de vocês e de toda a família. 🙏💕\n\n` +
    `Hoje eles estarão dando um lindo e abençoado passo para a construção de uma família abençoada por Deus.\n\n` +
    `Que a graça de Deus acompanhe vocês sempre!\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 7: DIA DOS 15 ANOS - DEBUTANTE =================
// Celebração do grande dia dos 15 anos. Foco na bênção, sabedoria e proteção divina.
// Sem mencionar serviço específico. Tom cristão católico.
function montarMensagem15AnosDebutante(registro) {
  return (
    `Bom dia, *${registro.nomeCelebrado}*. 💎✨\n\n` +
    `Hoje é um dia muito especial! 🥳🎉\n\n` +
    `Que privilégio imenso estar ao seu lado celebrando este grande dia de seus 15 anos!\n\n` +
    `Agradecemos a Deus por você e pedimos que Ele continue derramando sobre sua vida muitas bênçãos, saúde, sabedoria, paz, alegria, sucesso nos estudos e felicidade. Que a fé e a graça divina guiem sempre seus caminhos. 🙏💕\n\n` +
    `Você é tão especial e tão amada!\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 8: DIA DOS 15 ANOS - PAIS =================
// Celebração do grande dia dos 15 anos para os pais. Foco na bênção da família e fé.
// Sem mencionar serviço específico. Tom cristão católico.
function montarMensagem15AnosPais(registro) {
  return (
    `Bom dia, *${registro.nomeResponsavel}*. 👋\n\n` +
    `Hoje é um dia muito especial! 💎✨\n\n` +
    `Que privilégio imenso estar ao lado de vocês celebrando este grande dia dos 15 anos de *${registro.nomeCelebrado}*!\n\n` +
    `Agradecemos a Deus por esta menina tão especial e pedimos que Ele continue abençoando abundantemente a família de vocês. Que derrame sobre *${registro.nomeCelebrado}* sabedoria, saúde, paz, alegria, sucesso e uma vida repleta de boas bênçãos. Que a fé guie cada passo da jornada dela. 🙏💕\n\n` +
    `Que Deus proteja sempre esta bela família!\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 9: DIA DAS BODAS - CASAL =================
// Celebração do grande dia das bodas. Foco na fidelidade, amor duradouro e bênção divina.
// Sem mencionar serviço específico. Tom cristão católico.
function montarMensagemBodasCasal(registro) {
  return (
    `Bom dia, *${registro.nomeNoiva} e ${registro.nomeNoivo}*. 💍✨\n\n` +
    `Hoje é um dia muito especial! 🥳🎉\n\n` +
    `Que privilégio imenso estar ao lado de vocês celebrando as *${registro.nome_bodas}*!\n\n` +
    `Quantos anos de amor, fidelidade, cumplicidade e fé! Que testemunho poderoso de um casamento abençoado por Deus! Que Ele continue derramando sobre vocês muitas bênçãos, saúde, paz, alegria e ainda muitos anos juntos, fortalecendo cada dia a graça que une vocês. 🙏💕\n\n` +
    `Que Deus continue guardando este casamento!\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 10: DIA DAS BODAS - RESPONSÁVEL =================
// Celebração do grande dia das bodas para quem contratou. Foco na bênção e testemunho de fé.
// Sem mencionar serviço específico. Tom cristão católico.
function montarMensagemBodasResponsavel(registro) {
  return (
    `Bom dia, *${registro.nomeResponsavel}*. 👋\n\n` +
    `Hoje é um dia muito especial! 💍✨\n\n` +
    `Que privilégio imenso estar ao lado de vocês celebrando as *${registro.nome_bodas}* de *${registro.nomeNoiva} e ${registro.nomeNoivo}*!\n\n` +
    `Que testemunho lindo de um casamento abençoado por Deus, cheio de amor, fidelidade e cumplicidade! Que Ele continue derramando sobre este casal extraordinário muitas bênçãos, saúde, paz, alegria, fidelidade e a proteção divina em todas as fases da vida. 🙏💕\n\n` +
    `Vocês são inspiração de fé e amor!\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 11: DIA DA FESTA - CELEBRADO =================
// Parabeniza pelo grande dia da festa de aniversário (mesmo que a data de
// nascimento seja outra). Tom cristão católico celebrativo.
function montarMensagemDiaFestaCelebrado(registro) {
  return (
    `Bom dia, *${registro.nomeCelebrado}*. 🎉✨\n\n` +
    `Chegou o grande dia da sua festa! 🥳🎂\n\n` +
    `É um privilégio imenso estar ao seu lado celebrando este dia tão especial!\n\n` +
    `Agradecemos a Deus pela sua vida e pedimos que Ele derrame sobre você muitas bênçãos, saúde, paz, alegria e felicidade. Que a festa seja maravilhosa e inesquecível! 🙏💕\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= MENSAGEM 12: DIA DA FESTA - RESPONSÁVEL =================
function montarMensagemDiaFestaResponsavel(registro) {
  const genero  = registro.generoCelebrado;
  const artigo  = genero === "feminino" ? "da" : "do";
  const relacao = registro.relacao ? `${registro.relacao} ` : "";

  return (
    `Bom dia, *${registro.nomeResponsavel}*. 🎉✨\n\n` +
    `Chegou o grande dia da festa ${artigo} ${relacao}*${registro.nomeCelebrado}*! 🥳🎂\n\n` +
    `É um privilégio imenso estar ao lado de vocês celebrando este dia tão especial!\n\n` +
    `Agradecemos a Deus por este momento e pedimos que Ele derrame muitas bênçãos, saúde, paz, alegria e felicidade sobre toda a família. Que a festa seja maravilhosa e inesquecível! 🙏💕\n\n` +
    `Com muito carinho,🥰🥰\n\n` +
    `*Adriana e Mario*\n` +
    `*PhotoMusic Produções*\n\n` +
    `✨ *Instagram PhotoMusic*\n` +
    `https://instagram.com/photomusicproducoes\n` +
    `https://photomusic.com.br/`
  );
}

// ================= EXECUÇÃO PRINCIPAL =================
async function executarEnvioComemoracoes() {
  console.log("\n🎉 ========== INICIANDO VERIFICAÇÃO DE COMEMORAÇÕES ==========");
  console.log(`⏰ Horário: ${new Date().toLocaleString("pt-BR", { timeZone: configAtual.timezone })}`);

  try {
    // ── Busca endpoint unificado (DB + pm_eventos + pm_eucaristia) ──────────
    let registrosEndpoint = [];
    try {
      console.log(`📥 Buscando endpoint: ${URL_ENDPOINT}`);
      const respEndpoint = await axios.get(URL_ENDPOINT, { timeout: 8000 });
      if (Array.isArray(respEndpoint.data)) {
        registrosEndpoint = respEndpoint.data;
        console.log(`✅ Endpoint: ${registrosEndpoint.length} registro(s)`);
      } else {
        console.warn("⚠️ Endpoint retornou estrutura inválida — ignorado");
      }
    } catch (errEndpoint) {
      console.warn(`⚠️ Endpoint indisponível (${errEndpoint.message}) — usando apenas JSON legado`);
    }

    const registros = registrosEndpoint;

    if (registros.length === 0) {
      console.warn("⚠️ Endpoint sem registros ou indisponível. Encerrando sem envios.");
      return;
    }

    console.log(`📊 Total de registros: ${registros.length}`);

    const { dia, mes } = hoje();
    const anoAtual = new Date().getFullYear();
    
    let enviadas = 0;
    let erros = 0;
    let duplicadas = 0;
    let idxEnvio = 0; // p/ o intervalo anti-bloqueio entre envios (vale p/ os 2 loops do ciclo)
    let bloqueadas_por_prioridade = 0; // NOVO: Contador de bloqueios por prioridade

    // ✅ NOVO: Separar registros em 2 grupos
    const TIPOS_COM_ANO = ["dia_casamento", "quinze_anos", "bodas", "dia_festa"];
    const registrosComAno = registros.filter(r =>
      r.ano !== undefined && r.ano !== null && TIPOS_COM_ANO.includes(r.tipo)
    );
    const registrosSemAno = registros.filter(r =>
      r.ano === undefined || r.ano === null || !TIPOS_COM_ANO.includes(r.tipo)
    );

    // ✅ NOVO: Rastrear telefones/datas já processados (com ano)
    const processadosComAno = new Set();

    console.log(`\n📌 Processando ${registrosComAno.length} registros COM ANO (PRIORIDADE)...`);
    
    // ==================== PASSO 1: PROCESSAR REGISTROS COM ANO ====================
    for (const registro of registrosComAno) {
      console.log(`\n📋 ${registro.categoria || "sem categoria"}`);

      // Verificar data
      if (registro.dia !== dia || registro.mes !== mes) {
        console.log(`   ⏭️  Data não corresponde (${registro.dia}/${registro.mes})`);
        continue;
      }
      
      // Verificar ano (CRÍTICO para celebrações com ano)
      if (registro.ano !== anoAtual) {
        console.log(`   ⏭️  Ano não corresponde (${registro.ano} vs ${anoAtual})`);
        continue;
      }
      
      console.log(`   ✅ Data e ano coincidem! (${registro.dia}/${registro.mes}/${anoAtual})`);

      let mensagem = null;
      let tipoMensagem = "";

      // ==================== PROCESSAR TIPOS COM ANO ====================
      
      if (registro.tipo === "dia_casamento") {
        const destinatario = (registro.destinatario || "responsavel").toLowerCase();

        if (destinatario === "casal") {
          if (!registro.nomeNoiva || !registro.nomeNoivo) {
            console.log(`   ❌ Faltam nomeNoiva ou nomeNoivo`);
            erros++;
            continue;
          }
          mensagem = montarMensagemDiaCasamentoCasal(registro);
          tipoMensagem = "💍 DIA DO CASAMENTO (Casal)";
        } else {
          if (!registro.nomeResponsavel || !registro.nomeNoiva || !registro.nomeNoivo) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagemDiaCasamentoResponsavel(registro);
          tipoMensagem = "💍 DIA DO CASAMENTO (Responsável)";
        }
      } 
      else if (registro.tipo === "quinze_anos") {
        const destinatario = (registro.destinatario || "pais").toLowerCase();

        if (destinatario === "debutante") {
          if (!registro.nomeCelebrado) {
            console.log(`   ❌ Falta 'nomeCelebrado'`);
            erros++;
            continue;
          }
          mensagem = montarMensagem15AnosDebutante(registro);
          tipoMensagem = "💎 15 ANOS (Debutante)";
        } else {
          if (!registro.nomeResponsavel || !registro.nomeCelebrado) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagem15AnosPais(registro);
          tipoMensagem = "💎 15 ANOS (Pais)";
        }
      } 
      else if (registro.tipo === "bodas") {
        const destinatario = (registro.destinatario || "responsavel").toLowerCase();

        if (destinatario === "casal") {
          if (!registro.nomeNoiva || !registro.nomeNoivo || !registro.nome_bodas) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagemBodasCasal(registro);
          tipoMensagem = `👰 ${registro.nome_bodas} (Casal)`;
        } else {
          if (!registro.nomeResponsavel || !registro.nomeNoiva || !registro.nomeNoivo || !registro.nome_bodas) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagemBodasResponsavel(registro);
          tipoMensagem = `👰 ${registro.nome_bodas} (Responsável)`;
        }
      }
      else if (registro.tipo === "dia_festa") {
        const destinatario = (registro.destinatario || "responsavel").toLowerCase();

        if (destinatario === "celebrado") {
          if (!registro.nomeCelebrado) {
            console.log(`   ❌ Falta 'nomeCelebrado'`);
            erros++;
            continue;
          }
          mensagem = montarMensagemDiaFestaCelebrado(registro);
          tipoMensagem = "🎂 DIA DA FESTA (Celebrado)";
        } else {
          if (!registro.nomeResponsavel || !registro.nomeCelebrado) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagemDiaFestaResponsavel(registro);
          tipoMensagem = "🎂 DIA DA FESTA (Responsável)";
        }
      }

      if (!mensagem) {
        console.log(`   ❌ Tipo desconhecido: ${registro.tipo}`);
        erros++;
        continue;
      }

      const telefone = normalizarNumero(registro.telefone);
      if (!telefone) {
        console.log(`   ❌ Telefone inválido: ${registro.telefone}`);
        erros++;
        continue;
      }

      // ✅ NOVO: Verificar duplicata em memória
      const chaveUnica = gerarChaveUnica(telefone, registro.tipo, registro.destinatario);
      if (jaFoiEnviada(chaveUnica)) {
        console.log(`   ⚠️  DUPLICADA! Já enviada hoje para ${telefone}`);
        duplicadas++;
        continue;
      }

      try {
        console.log(`   📱 Enviando para: ${telefone}`);
        await sendText(telefone, mensagem);
        console.log(`   ✅ Mensagem enviada com sucesso! (${tipoMensagem})`);
        
        marcarComoEnviada(chaveUnica);
        
        // ✅ NOVO: Registrar este telefone/data como processado
        processadosComAno.add(`${telefone}|${dia}|${mes}`);
        
        enviadas++;
      } catch (erroEnvio) {
        console.error(`   ❌ Erro ao enviar: ${erroEnvio.message}`);
        erros++;
      }

      // Intervalo anti-bloqueio da Meta: o 1º envio do ciclo sai em ~3s e,
      // a partir do 2º, varia aleatoriamente entre 5 e 15s — parece humano.
      idxEnvio++;
      await new Promise(r => setTimeout(r, esperaEntreEnvios(idxEnvio)));
    }

    console.log(`\n📌 Processando ${registrosSemAno.length} registros SEM ANO...`);
    
    // ==================== PASSO 2: PROCESSAR REGISTROS SEM ANO ====================
    for (const registro of registrosSemAno) {
      console.log(`\n📋 ${registro.categoria || "sem categoria"}`);

      // Verificar data
      if (registro.dia !== dia || registro.mes !== mes) {
        console.log(`   ⏭️  Data não corresponde (${registro.dia}/${registro.mes})`);
        continue;
      }

      console.log(`   ✅ Data coincide! (${registro.dia}/${registro.mes})`);

      let mensagem = null;
      let tipoMensagem = "";

      // ==================== PROCESSAR TIPOS SEM ANO ====================
      
      if (registro.tipo === "aniversario_pessoal") {
        const destinatario = (registro.destinatario || "responsavel").toLowerCase();

        if (destinatario === "celebrado") {
          if (!registro.nomeCelebrado) {
            console.log(`   ❌ Falta 'nomeCelebrado'`);
            erros++;
            continue;
          }
          mensagem = montarMensagemAniversarioPessoalParaCelebrado(registro);
          tipoMensagem = "Aniversário Pessoal (Celebrado)";
        } else {
          if (!registro.nomeResponsavel || !registro.relacao || !registro.nomeCelebrado) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagemAniversarioPessoalParaResponsavel(registro);
          tipoMensagem = "Aniversário Pessoal (Responsável)";
        }
      } 
      else if (registro.tipo === "aniversario_casamento") {
        const destinatario = (registro.destinatario || "responsavel").toLowerCase();

        if (destinatario === "casal") {
          if (!registro.nomeNoiva || !registro.nomeNoivo) {
            console.log(`   ❌ Faltam nomeNoiva ou nomeNoivo`);
            erros++;
            continue;
          }
          mensagem = montarMensagemAniversarioCasamentoParaCasal(registro);
          tipoMensagem = "Aniversário de Casamento (Casal)";
        } else {
          if (!registro.nomeResponsavel || !registro.nomeNoiva || !registro.nomeNoivo) {
            console.log(`   ❌ Faltam campos obrigatórios`);
            erros++;
            continue;
          }
          mensagem = montarMensagemAniversarioCasamentoParaResponsavel(registro);
          tipoMensagem = "Aniversário de Casamento (Responsável)";
        }
      }

      if (!mensagem) {
        console.log(`   ❌ Tipo desconhecido: ${registro.tipo}`);
        erros++;
        continue;
      }

      const telefone = normalizarNumero(registro.telefone);
      if (!telefone) {
        console.log(`   ❌ Telefone inválido: ${registro.telefone}`);
        erros++;
        continue;
      }

      // ✅ NOVO: VERIFICAR PRIORIDADE
      // Se este telefone/dia/mês já foi processado com ano, bloquear
      const chaveVerificacao = `${telefone}|${dia}|${mes}`;
      if (processadosComAno.has(chaveVerificacao)) {
        console.log(`   ⛔ BLOQUEADO por prioridade! Registro com ANO já foi enviado para este telefone nesta data.`);
        bloqueadas_por_prioridade++;
        continue;
      }

      // Verificar duplicata em memória
      const chaveUnica = gerarChaveUnica(telefone, registro.tipo, registro.destinatario);
      if (jaFoiEnviada(chaveUnica)) {
        console.log(`   ⚠️  DUPLICADA! Já enviada hoje para ${telefone}`);
        duplicadas++;
        continue;
      }

      try {
        console.log(`   📱 Enviando para: ${telefone}`);
        await sendText(telefone, mensagem);
        console.log(`   ✅ Mensagem enviada com sucesso! (${tipoMensagem})`);
        
        marcarComoEnviada(chaveUnica);
        enviadas++;
      } catch (erroEnvio) {
        console.error(`   ❌ Erro ao enviar: ${erroEnvio.message}`);
        erros++;
      }

      // Intervalo anti-bloqueio da Meta: o 1º envio do ciclo sai em ~3s e,
      // a partir do 2º, varia aleatoriamente entre 5 e 15s — parece humano.
      idxEnvio++;
      await new Promise(r => setTimeout(r, esperaEntreEnvios(idxEnvio)));
    }

    console.log(`\n📊 ========== RESUMO FINAL ==========`);
    console.log(`✅ Mensagens enviadas: ${enviadas}`);
    console.log(`⛔ Bloqueadas por prioridade: ${bloqueadas_por_prioridade}`);
    console.log(`⚠️  Duplicatas bloqueadas: ${duplicadas}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📋 Total processado: ${registros.length}`);

  } catch (erro) {
    console.error("❌ Erro ao executar mensagens comemorativas:", erro.message);
    if (erro.response) {
      console.error(`   Status HTTP: ${erro.response.status}`);
    }
  }

  console.log(`\n🎉 ========== FIM DA VERIFICAÇÃO ========== \n`);
}

// ================= SETUP DO SCHEDULER =================
async function inicializarScheduler() {
  console.log("🚀 Sistema de Mensagens Comemorativas iniciado!");
  
  // Carregar configuração
  configAtual = await carregarConfiguracao();
  
  console.log(`📍 Timezone: ${configAtual.timezone}`);
  console.log(`⏰ Agendado para: ${configAtual.horario}`);
  console.log(`✅ Sistema ativo: ${configAtual.ativo}`);
  console.log("================================================\n");

  // Se já existe um cron, cancela
  if (cronTask) {
    cronTask.stop();
  }

  // ✅ NOVO: Inicializar limpador diário
  if (taskLimpeza) {
    taskLimpeza.stop();
  }
  taskLimpeza = inicializarLimpadorDiario();

  // Cria novo cron com a configuração
  if (configAtual.ativo) {
    cronTask = cron.schedule(configAtual.horario, () => {
      console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA...");
      executarEnvioComemoracoes();
    }, {
      timezone: configAtual.timezone
    });

    console.log(`📌 Aguardando próximo agendamento: ${configAtual.horario}\n`);
  } else {
    console.log(`⚠️  Sistema desativado (ativo: ${configAtual.ativo})\n`);
  }
}

// ================= EXPORTAÇÃO =================
module.exports = {
  inicializarScheduler,
  executarEnvioComemoracoes
};

// ================= RECARREGAR CONFIGURAÇÃO A CADA 5 MINUTOS =================
setInterval(async () => {
  try {
    const novaConfig = await carregarConfiguracao();
    
    // Se mudou o horário ou status, reinicializa
    if (novaConfig.horario !== configAtual.horario || 
        novaConfig.ativo !== configAtual.ativo ||
        novaConfig.timezone !== configAtual.timezone) {
      
      console.log("\n⚡ Configuração alterada! Reinicializando scheduler...");
      configAtual = novaConfig;
      inicializarScheduler();
    }
  } catch (erro) {
    console.error("⚠️  Erro ao recarregar configuração:", erro.message);
  }
}, 300000); // 5 minutos