// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-vigia-whatsapp.js
// 27/11/2026 (RJN): vigia de conexao do WhatsApp. Z-API e PhotoMusic Pro SIMULADOS (nada sai).
// Rodar: node teste-vigia-whatsapp.js  (codigo de saida 0 = tudo ok)
process.env.INSTANCE_ID = process.env.INSTANCE_ID || "INST_TESTE";
process.env.TOKEN = process.env.TOKEN || "TOKEN_TESTE";
process.env.PM_API_KEY = process.env.PM_API_KEY || "CHAVE_TESTE";
const path = require("path");
const fs = require("fs");
// o vigia grava o estado na pasta do bot quando nao ha /data: o teste apaga no fim se criou
const ARQ_ESTADO = path.join(__dirname, "whatsapp-conexao.json");
const existia = fs.existsSync(ARQ_ESTADO);
process.on("exit", () => { if (!existia) { try { fs.unlinkSync(ARQ_ESTADO); } catch (e) {} } });

// node-fetch simulado ANTES de carregar o sendText (nenhum envio real)
const chamadasEnvio = [];
const caminhoFetch = require.resolve("node-fetch", { paths: [path.join(__dirname, "utils")] });
require.cache[caminhoFetch] = { id: caminhoFetch, filename: caminhoFetch, loaded: true,
  exports: async (url) => { chamadasEnvio.push(url); return { ok: true, status: 200, json: async () => ({ id: "x" }) }; } };

const V = require("./utils/conexaoZapi.js");
const { sendText } = require("./utils/sendText.js");

let falhas = 0, ok = 0;
function checar(nome, cond) { if (cond) { ok++; console.log("✅ " + nome); } else { falhas++; console.log("❌ " + nome); } }

(async () => {
  const T = "2026-11-27T12:00:00.000Z";
  // ---- regra pura
  let e = V.proximoEstado({ conectado: null, falhas_seguidas: 0 }, { connected: false }, T);
  checar("sem estado anterior: 1 'false' ja vale DESCONECTADO", e.conectado === false && e.desde === T);
  e = V.proximoEstado({ conectado: true, falhas_seguidas: 0, desde: "antes" }, { connected: false }, T);
  checar("estava conectado: 1 'false' NAO alarma (soluco)", e.conectado === true && e.falhas_seguidas === 1);
  e = V.proximoEstado(e, { connected: false }, T);
  checar("2 'false' seguidos: DESCONECTADO", e.conectado === false && e.desde === T);
  checar("resposta estranha = nao sei (nao muda)", V.proximoEstado({ conectado: true, falhas_seguidas: 0 }, { erro: "x" }, T).conectado === true);
  checar("resposta vazia/nula = nao sei", V.proximoEstado({ conectado: false, falhas_seguidas: 3 }, null, T).conectado === false);
  e = V.proximoEstado({ conectado: false, falhas_seguidas: 2, desde: "x" }, { connected: true }, T);
  checar("voltou: CONECTADO e zera as falhas", e.conectado === true && e.falhas_seguidas === 0);

  // ---- trava dos envios
  V._definirEstado({ conectado: false });
  let travou = false; try { V.garantirConectado(); } catch (er) { travou = /NAO saiu/.test(er.message); }
  checar("desconectado: trava os envios com aviso claro", travou);
  chamadasEnvio.length = 0;
  const r = await sendText("5521900000000@c.us", "teste");
  checar("desconectado: sendText devolve false e NAO chama a Z-API (nao cai na fila)", r === false && chamadasEnvio.length === 0);
  V._definirEstado({ conectado: true });
  const r2 = await sendText("5521900000000@c.us", "teste");
  checar("conectado: sendText envia normal", r2 === true && chamadasEnvio.length === 1);
  V._definirEstado({ conectado: null });
  checar("estado desconhecido (nao sei): deixa enviar", (await sendText("5521900000000@c.us", "t")) === true);

  // ---- rotinas
  V._definirEstado({ conectado: false });
  let rodou = 0;
  checar("rotina pausa quando desconectado", V.pausarSeDesconectado("parabens do dia", () => { rodou++; }) === true);
  checar("rotina segue quando conectado", (V._definirEstado({ conectado: true }), V.pausarSeDesconectado("x")) === false);
  V._definirEstado({ conectado: false });
  V.pausarSeDesconectado("parabens do dia", () => { rodou++; });
  await V.rodarRepescagem({ agora: new Date() });
  // a repescagem so roda ate as 21h do mesmo dia: o teste aceita os dois lados conforme a hora
  const horaAgora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  checar("repescagem: roda 1x ao reconectar (ate 21h) e nao fica na lista", (horaAgora < 21 ? rodou === 1 : rodou === 0) && V._repescagem.size === 0);
  V.pausarSeDesconectado("parabens do dia", () => { rodou += 10; });
  await V.rodarRepescagem({ agora: new Date("2026-11-28T23:30:00Z") });
  checar("repescagem: dia seguinte ou depois das 21h NAO roda", rodou < 10);

  // ---- verificar + aviso ao PhotoMusic Pro (so quando muda)
  const avisos = [];
  const respostas = [];
  const fetchFalso = async (url, opt) => {
    if (/whatsapp-conexao/.test(url)) { avisos.push(JSON.parse(opt.body)); return { ok: true }; }
    return { text: async () => JSON.stringify(respostas.shift() || {}) };
  };
  V._definirEstado({ conectado: true, falhas_seguidas: 0 });
  respostas.push({ connected: false }); await V.verificar({ fetch: fetchFalso });
  checar("1o 'false': nao avisa o PhotoMusic Pro ainda", avisos.length === 0);
  respostas.push({ connected: false }); await V.verificar({ fetch: fetchFalso });
  checar("2o 'false': avisa o PhotoMusic Pro (desconectado)", avisos.length === 1 && avisos[0].conectado === false && !!avisos[0].desde);
  respostas.push({ connected: false }); await V.verificar({ fetch: fetchFalso });
  checar("continua caido: nao repete o aviso", avisos.length === 1);
  respostas.push({ connected: true }); await V.verificar({ fetch: fetchFalso });
  checar("voltou: avisa o PhotoMusic Pro (conectado)", avisos.length === 2 && avisos[1].conectado === true);
  await V.verificar({ fetch: async (u) => { if (/status/.test(u)) throw new Error("rede"); return { ok: true }; } });
  checar("erro de rede: nao muda o estado", V.situacao().conectado === true);

  // ---- cobertura: todas as funcoes de envio e rotinas
  const u = n => fs.readFileSync(path.join(__dirname, "utils", n), "utf8");
  for (const n of ["sendButtonList.js", "sendOptionList.js", "sendImageBase64.js", "sendFileByUrl.js", "sendFileFromUrl.js", "sendLinkPreview.js"]) {
    checar(`${n} tem a trava antes do envio`, /garantirConectado\(\)/.test(u(n)));
  }
  for (const n of ["avisosGaleria.js", "envioAgendado.js", "followupLeads.js", "lembreteOrcamento.js", "lembreteTarefas.js", "reativacaoTick.js", "mensagensComemorativas.js", "mensagemDiaFesta.js"]) {
    checar(`rotina ${n} pausa quando desconectado`, /pausarSeDesconectado\(/.test(fs.readFileSync(path.join(__dirname, "jobs", n), "utf8")));
  }
  checar("parabens so marca enviado se saiu", (fs.readFileSync(path.join(__dirname, "jobs/mensagensComemorativas.js"), "utf8").match(/if \(saiu === false\) throw/g) || []).length === 2);
  checar("vigia ligado no server.js", /conexaoZapi\.js"\)\.iniciar\(\)/.test(fs.readFileSync(path.join(__dirname, "server.js"), "utf8")));

  console.log(`\n${ok} OK, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log("❌ erro: " + e.stack); process.exit(1); });
