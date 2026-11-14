// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-acolhimento-celebracao.js
// Acolhimento por celebração (14/11/2026, RJN; pedido do Mario + ChatGPT).
// Dirige o handleIncomingMessage REAL com o WhatsApp trocado por um gravador. Não toca em produção.
// Rodar:  node teste-acolhimento-celebracao.js   (conferir o CÓDIGO DE SAÍDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
const chamadasGerar = [];
utils.gerarOrcamento = async (s) => { chamadasGerar.push(1); return { id: "T1", url: "https://exemplo/teste.pdf", total: 1 }; };
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

const fs = require("fs");
const path = require("path");
const ARQ = path.join(__dirname, "sessions.json");
const ARQ_PAUSA = path.join(__dirname, "pausados.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const pausaAntes = fs.existsSync(ARQ_PAUSA) ? fs.readFileSync(ARQ_PAUSA, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const AC = require("./utils/acolhimentoCelebracao.js");
const LV = require("./utils/entendimentoLivre.js");

let falhas = 0, seq = 0, CHAT = "";
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 500)}`); if (!ok) falhas++; }
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "ac-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); chamadasGerar.length = 0; CHAT = "55219942431" + String(10 + (++seq)).slice(-2); }
// do "Oi" até a lista "o que vai celebrar?" (ou até os convidados, quando a celebração já foi dita)
async function ateCelebracao(primeira = "Oi") {
  novo();
  await cliente(primeira);
  let r = "";
  for (const t of ["1", "1", "Ana", "1", "0", "1"]) {
    r = await cliente(t);
    if (["orcamento_celebracao", "orcamento_convidados", "orcamento_bodas_anos"].includes(sess().step)) break;
  }
  return r;
}
const PERGUNTA = /Quantos anos de casamento vocês estarão celebrando/;

(async () => {
  console.log("--- 💍 BODAS (escolhida na lista) ---");
  await ateCelebracao();
  checar("chegou na lista de celebrações", sess().step === "orcamento_celebracao", sess().step);
  let r = await cliente("6");
  checar("Bodas: pergunta os anos de casamento (e ainda não abre as perguntas do evento)", PERGUNTA.test(r) && sess().step === "orcamento_bodas_anos" && !/Quantos convidados/.test(r), r);
  r = await cliente("25");
  checar("25: '25 anos de casamento' + 'Bodas de Prata' + em nome da PhotoMusic", /25 anos de casamento! ❤️/.test(r) && /Bodas de Prata/.test(r) && /Em nome da PhotoMusic Produções/.test(r), r);
  checar("25 fica como anos de casamento, NÃO como convidados; segue para os convidados",
    sess().orcamento.anosCasamento === 25 && !sess().orcamento.convidados && /Quantos convidados/.test(r) && /orcamento_convidados/.test(sess().step), JSON.stringify({ a: sess().orcamento.anosCasamento, c: sess().orcamento.convidados, st: sess().step }));
  checar("acolhimento em UMA mensagem (antes do aviso das perguntas)", registro.filter(x => /Bodas de Prata/.test(x)).length === 1);

  await ateCelebracao(); await cliente("6");
  r = await cliente("50 anos");
  checar("50: Bodas de Ouro", /50 anos de casamento/.test(r) && /Bodas de Ouro/.test(r), r);
  await ateCelebracao(); await cliente("6");
  r = await cliente("40");
  checar("40 (denominação varia entre as listas): só os anos, sem nome de boda", /40 anos de casamento/.test(r) && !/Bodas de /.test(r) && /linda história/.test(r), r);
  await ateCelebracao(); await cliente("6");
  r = await cliente("não sei ao certo");
  checar("sem número: não trava, parabeniza sem os anos e segue", /linda história de amor/.test(r) && /orcamento_convidados/.test(sess().step) && !sess().orcamento.anosCasamento, sess().step + " | " + r);

  console.log("--- informação já dada em texto livre: não pergunta de novo ---");
  checar("'Vou comemorar 25 anos de casamento' = Bodas, 25 (antes virava Casamento)", JSON.stringify(LV.celebracaoDoTexto("Vou comemorar 25 anos de casamento")) === JSON.stringify({ id: 6, anosCasamento: 25 }), JSON.stringify(LV.celebracaoDoTexto("Vou comemorar 25 anos de casamento")));
  checar("'bodas de ouro dos meus pais' = Bodas, 50", (LV.celebracaoDoTexto("bodas de ouro dos meus pais") || {}).anosCasamento === 50);
  checar("'orçamento para casamento' continua Casamento", (LV.celebracaoDoTexto("orçamento para casamento") || {}).id === 2);
  r = await ateCelebracao("Olá! Vamos comemorar 25 anos de casamento e queremos a foto cabine");
  checar("Bodas de 25 já dita: anota, parabeniza direto e vai aos convidados (sem perguntar os anos)",
    /Anotei: \*Bodas\* \(25 anos de casamento\)/.test(r) && /Bodas de Prata/.test(r) && !PERGUNTA.test(r) && /orcamento_convidados/.test(sess().step), sess().step + " | " + r);
  checar("e os 25 não viram convidados", sess().orcamento.convidados !== 25 && (sess().dadosLivres || {}).convidados !== 25, JSON.stringify(sess().dadosLivres));
  r = await ateCelebracao("Oi, é o aniversário de 5 anos do meu filho");
  checar("idade já dita na 1a mensagem: Infantil (5 anos), '5 aninhos', sem perguntar", /Anotei: \*Aniversário Infantil\* \(5 anos\)/.test(r) && /5 aninhos/.test(r) && /orcamento_convidados/.test(sess().step), sess().step + " | " + r);

  console.log("--- 💰 preço primeiro: nenhuma pergunta a mais ---");
  await ateCelebracao();
  sess().orcamento.preliminarEnviadoEm = Date.now();   // já pediu e recebeu o valor
  r = await cliente("6");
  checar("quem já pediu o preço NÃO recebe a pergunta dos anos", !PERGUNTA.test(r) && /orcamento_convidados/.test(sess().step), sess().step + " | " + r);
  await ateCelebracao(); await cliente("6");
  r = await cliente("quanto custa?");
  checar("'quanto custa?' na pergunta dos anos: manda o valor na hora (a pergunta não segura o preço)", chamadasGerar.length > 0 || /PDF/.test(r), r);

  console.log("--- 💒 casamento: casal x família ---");
  await ateCelebracao(); r = await cliente("2");
  checar("casamento sem filhos informados: fala do CASAL, sem 'família'", /concedendo ao casal/.test(r) && !/fam[ií]lia|filhos/i.test(r), r);
  r = await ateCelebracao("Oi! Vamos nos casar e já temos dois filhos");
  checar("casal que CONTOU que tem filhos: abençoa a família e os filhos", /Casamento/.test(r) && /toda a família/.test(r) && /aos filhos/.test(r), sess().step + " | " + r);
  checar("'minha filha vai casar' NÃO conta como o casal ter filhos", !AC.contouQueTemFilhos("minha filha vai casar em março"));

  console.log("--- 🏢 corporativo e as outras celebrações ---");
  await ateCelebracao(); r = await cliente("8");
  checar("corporativo: tom profissional, sem Deus nem linguagem familiar", /sucesso do seu evento/.test(r) && !/Deus|família|❤️/.test(r), r);
  checar("perfil empresa/agência também é profissional", !/Deus/.test(AC.mensagemAcolhimento(5, { perfil: "empresa" })) && !/Deus/.test(AC.mensagemAcolhimento(2, { perfil: "agencia" })));
  const todas = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => AC.mensagemAcolhimento(i, {}));
  checar("cada celebração tem mensagem própria (9 diferentes)", new Set(todas).size === 9);
  checar("formatura parabeniza a conquista; outros não presume", /conquista/.test(todas[6]) && !/anos|casal|aniversário/i.test(todas[8]));
  checar("nenhuma diz 'sua festa', nenhuma tem travessão longo, coração só vermelho",
    todas.every(t => !/sua festa/i.test(t) && !/—/.test(t) && !/[💙💚💛🧡💜🖤🤍💗💖]/u.test(t)), "");
  checar("mensagens curtas (até 400 caracteres)", todas.every(t => t.length <= 400), todas.map(t => t.length).join(","));

  if (pausaAntes !== null) fs.writeFileSync(ARQ_PAUSA, pausaAntes); else if (fs.existsSync(ARQ_PAUSA)) fs.unlinkSync(ARQ_PAUSA);
  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ TUDO CERTO");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
