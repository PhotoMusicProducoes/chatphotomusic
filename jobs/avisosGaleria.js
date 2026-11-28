// jobs/avisosGaleria.js
// Avisos automáticos da galeria ao CONTRATANTE (pedido do Mario, 2026-08).
//
// Dois avisos, para os serviços de foto (cabine, totens, 360, paparazzi e
// foto lembrança):
//
//   INÍCIO do serviço -> o contratante recebe A MESMA mensagem que os
//                        convidados recebem, para saber o que chega para eles.
//   FIM do serviço    -> a mensagem carinhosa com O LINK DELE, que baixa tudo.
//
// 🚨 Quem decide "está na hora" é o WORDPRESS, não este arquivo: ele conhece o
// fuso do site, sabe o horário de cada evento e guarda a marca de enviado. Aqui
// só perguntamos o que está devido e entregamos. Controle de envio em memória
// não serviria: a máquina do Fly reinicia sozinha e o cliente receberia de novo.

const axios = require("axios");
const cron = require("node-cron");
const { sendText } = require("../utils/index.js");
const { PM_API_BASE, PM_API_KEY } = require("../utils/config.js");
const { montarMensagemEvento, blocoRedes, marcaDoTelefone } = require("../services/eventos.js");
// 🎭 as palavras mudam com a celebração - ver services/tomDoEvento.js
const { tomDoEvento } = require("../services/tomDoEvento.js");

const TIMEZONE = "America/Sao_Paulo";

/* 28/11/2026 (Mario): o link do contratante NAO segue mais a janela 10h-21h das
   mensagens comemorativas. O contratante esta NA FESTA: começou, recebe a mensagem
   da festa; terminou, recebe o link dele, a qualquer hora (a IMF terminou 22h e o
   link ficou preso ate as 10h do dia seguinte).
   So o ATRASADO (mais de 3h depois do fim: bot fora do ar, WhatsApp caido, link
   lancado tarde) espera 10h-21h, para nao acordar ninguem de madrugada.
   Sem `fim_em` (PhotoMusic Pro antigo): na duvida, de 1h a 9h59 espera. */
const ATRASO_MAX_MS = 3 * 60 * 60 * 1000;

function horaDeBrasilia(agora = new Date()) {
  return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", hour12: false }).format(agora));
}

/** Pode mandar o link do contratante agora? (funcao pura, testavel) */
function podeMandarLinkContratante(fimEmSeg, agora = new Date()) {
  const h = horaDeBrasilia(agora);
  const diaClaro = h >= 10 && h <= 21;
  if (fimEmSeg) return (agora.getTime() - fimEmSeg * 1000) <= ATRASO_MAX_MS || diaClaro;
  return !(h >= 1 && h < 10);
}

/* ======================================================
   MENSAGEM 1 - INÍCIO: "é isto que os seus convidados recebem"
   ====================================================== */
function aberturaDoInicio(evento) {
  const nome = (evento.contratante || "").trim().split(" ")[0];
  const ola = nome ? `Olá, *${nome}*!` : "Olá!";
  const tom = tomDoEvento(evento.tipo_celebracao);

  return (
    `👀 *Como os seus convidados recebem as fotos*\n\n` +
    `${tom.inicioOla(ola)}\n\n` +
    `Abaixo está, palavra por palavra, a mensagem que cada convidado recebe da gente aqui no WhatsApp. ` +
    `Assim você já sabe o que eles vão ver.\n\n` +
    `📌 O link que vai na mensagem seguinte é o *seu*. Cada convidado recebe o dele ao falar com a gente.`
  );
}

/* ======================================================
   MENSAGEM 2 - FIM: o agradecimento com o link que baixa tudo
   ====================================================== */
function mensagemDeEncerramento(evento) {
  const nome = (evento.contratante || "").trim().split(" ")[0];
  const ola = nome ? `Olá, *${nome}*!` : "Olá!";
  const tom = tomDoEvento(evento.tipo_celebracao);

  return (
    `${tom.fimTitulo}\n\n` +
    `${ola} ${tom.fimAlegria}\n\n` +
    `${tom.fimObrigado}\n\n` +
    `📸🎥 *Aqui está o seu acesso, com todas as fotos e vídeos:*\n${evento.link_contratante}\n\n` +
    `💻 *Uma dica que facilita muito:* abra este link *no computador*. ` +
    `Depois de confirmar o aceite, na *primeira tela* existe uma *seta ⬇️* ` +
    `que baixa *todas as fotos de uma vez só*, sem precisar salvar uma por uma.\n\n` +
    `📱 No celular também abre normalmente, mas aí o download é foto por foto.\n\n` +
    `Guarde este link com carinho, ele é o seu. Qualquer dúvida, é só me chamar por aqui.\n\n` +
    // 28/11/2026 (Mario): Instagram e avaliacao, como os convidados recebem na festa (Me Conta = redes da empresa)
    blocoRedes({ instagram: evento.instagram, instagramNome: evento.instagram_nome, googleReview: evento.google_review }) +
    `Com carinho,\n*PhotoMusic Produções* ❤️`
  );
}

/* Confirma no WordPress; sem isso o mesmo aviso sai no ciclo seguinte. */
async function marcarEnviado(idEvento, tipo) {
  await axios.post(
    `${PM_API_BASE}/eventos-avisos/marcar`,
    { id_evento: idEvento, tipo },
    { headers: { "X-PM-Api-Key": PM_API_KEY }, timeout: 10000 }
  );
}

async function executarAvisosGaleria() {
  // 27/11: WhatsApp desconectado = a rotina PAUSA sem marcar nada como enviado (roda no proximo ciclo)
  if (require("../utils/conexaoZapi.js").pausarSeDesconectado("avisos da galeria")) return;
  try {
    const resp = await axios.get(`${PM_API_BASE}/eventos-avisos`, {
      headers: { "X-PM-Api-Key": PM_API_KEY },
      timeout: 20000,
    });

    const eventos = Array.isArray(resp.data) ? resp.data : [];
    if (eventos.length === 0) return;

    console.log(`🖼️ [avisosGaleria] ${eventos.length} evento(s) com aviso devido.`);

    for (const ev of eventos) {
      /* INÍCIO: abertura + a mensagem dos convidados, na íntegra.
         Duas mensagens de propósito: a segunda é a mensagem real, do jeito
         que o convidado vê, sem nada nosso colado nela. */
      if (ev.aviso_inicio) {
        try {
          await sendText(ev.telefone, aberturaDoInicio(ev));
          await new Promise(r => setTimeout(r, 1500));
          await sendText(ev.telefone, montarMensagemEvento({
            titulo:        ev.titulo,
            preposicao:    ev.preposicao,
            tipoCelebracao: ev.tipo_celebracao || "",
            token:         ev.token_evento,
            instagram:     ev.instagram || "",
            instagramNome: ev.instagram_nome || "",
            googleReview:  ev.google_review || "",
          }, ev.telefone, await marcaDoTelefone(ev.telefone)));

          await marcarEnviado(ev.id, "inicio");
          console.log(`   ✅ Aviso de INÍCIO enviado -> ${ev.nome} (${ev.telefone})`);
        } catch (e) {
          console.error(`   ❌ Aviso de início do evento #${ev.id}: ${e.message}`);
        }
      }

      if (ev.aviso_fim) {   // 28/11: sai assim que a festa termina, a qualquer hora
        if (!podeMandarLinkContratante(ev.fim_em)) {
          console.log(`   ⏸️ Evento #${ev.id}: link do contratante ATRASADO, espera as 10h.`);
          continue;
        }
        try {
          await sendText(ev.telefone, mensagemDeEncerramento(ev));
          await marcarEnviado(ev.id, "fim");
          console.log(`   ✅ Aviso de FIM enviado -> ${ev.nome} (${ev.telefone})`);
        } catch (e) {
          console.error(`   ❌ Aviso de fim do evento #${ev.id}: ${e.message}`);
        }
      }

      // Intervalo entre contratantes, mesmo cuidado anti-bloqueio do follow-up.
      await new Promise(r => setTimeout(r, 4000));
    }
  } catch (e) {
    console.error(`❌ [avisosGaleria] Erro ao buscar avisos: ${e.message}`);
  }
}

/* A cada 5 minutos: o aviso de início precisa cair perto do horário marcado,
   e um ciclo mais espaçado atrasaria demais o link dos convidados. */
function inicializarAvisosGaleria() {
  cron.schedule("*/5 * * * *", () => {
    executarAvisosGaleria();
  }, { timezone: TIMEZONE });

  console.log("🖼️ Avisos de galeria ao contratante agendados (a cada 5 min).");
}

module.exports = { inicializarAvisosGaleria, executarAvisosGaleria, mensagemDeEncerramento, podeMandarLinkContratante };
