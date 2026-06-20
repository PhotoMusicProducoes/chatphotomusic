// jobs/index.js — Mensagens Comemorativas + Lembretes de Tarefas

const axios = require("axios");
const cron = require("node-cron");
const { sendText } = require("../utils/index.js");
const { normalizarNumero } = require("../index.js");
const { notificarTarefasAbertas } = require("../services/tarefas.js");

// ================= CRON: LEMBRETES DIÁRIOS DE TAREFAS =================
// Dispara todo dia às 08:00 (horário de Brasília)
cron.schedule("0 8 * * *", async () => {
  console.log("⏰ [Jobs] Verificando tarefas abertas para lembrete diário...");
  const grupoId = process.env.PM_TAREFAS_GRUPO_ID || "";
  await notificarTarefasAbertas(grupoId || null);
}, { timezone: "America/Sao_Paulo" });

// ================= CONFIGURAÇÕES =================
const URL_DADOS = "https://photomusic.com.br/wp-content/dados/comemoracoes.json";
const URL_CONFIG = "https://photomusic.com.br/wp-content/dados/comemoracoes-config.json";

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
      horario: "0 7 * * *",
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

// ================= EXECUÇÃO PRINCIPAL =================
async function executarEnvioComemoracoes() {
  console.log("\n🎉 ========== INICIANDO VERIFICAÇÃO DE COMEMORAÇÕES ==========");
  console.log(`⏰ Horário: ${new Date().toLocaleString("pt-BR", { timeZone: configAtual.timezone })}`);

  try {
    console.log(`📥 Buscando dados de: ${URL_DADOS}`);
    const resposta = await axios.get(URL_DADOS);
    const registros = resposta.data;

    if (!Array.isArray(registros)) {
      console.error("❌ Estrutura inválida no JSON de comemorações.");
      return;
    }

    console.log(`📊 Total de registros encontrados: ${registros.length}`);

    const { dia, mes } = hoje();
    let enviadas = 0;
    let erros = 0;
    let duplicadas = 0;  // ✅ NOVO: Contador de duplicatas
    let idxEnvio = 0;    // p/ o intervalo anti-bloqueio entre envios do mesmo ciclo

    for (const registro of registros) {
      console.log(`\n📋 Verificando registro: ${registro.categoria || "sem categoria"}`);

      if (registro.dia !== dia || registro.mes !== mes) {
        console.log(`   ⏭️  Data não corresponde (${registro.dia}/${registro.mes})`);
        continue;
      }

      console.log(`   ✅ Data coincide! (${registro.dia}/${registro.mes})`);

      let mensagem = null;
      let tipoMensagem = "";

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
      } else if (registro.tipo === "aniversario_casamento") {
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

      // ✅ NOVO: Verificar se já foi enviada
      const chaveUnica = gerarChaveUnica(telefone, registro.tipo, registro.destinatario);
      if (jaFoiEnviada(chaveUnica)) {
        console.log(`   ⚠️  DUPLICADA! Já enviada para ${telefone} (${tipoMensagem})`);
        duplicadas++;
        continue;
      }

      try {
        console.log(`   📱 Enviando para: ${telefone}`);
        await sendText(telefone, mensagem);
        console.log(`   ✅ Mensagem enviada com sucesso! (${tipoMensagem})`);
        
        // ✅ NOVO: Marcar como enviada
        marcarComoEnviada(chaveUnica);
        enviadas++;
      } catch (erroEnvio) {
        console.error(`   ❌ Erro ao enviar: ${erroEnvio.message}`);
        erros++;
      }

      // Intervalo anti-bloqueio da Meta: o 1º envio do ciclo sai em ~3s e,
      // a partir do 2º, varia aleatoriamente entre 5 e 15s — parece humano.
      idxEnvio++;
      const espera = idxEnvio <= 1 ? 3000 : 5000 + Math.floor(Math.random() * 10001);
      await new Promise(r => setTimeout(r, espera));
    }

    console.log(`\n📊 ========== RESUMO FINAL ==========`);
    console.log(`✅ Mensagens enviadas: ${enviadas}`);
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
