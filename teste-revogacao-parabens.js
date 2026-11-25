// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-revogacao-parabens.js
// Fase 2C da privacidade (25/11/2026, RJN): SAIR e pedidos naturais revogam os parabens.
// Dados ficticios, sem envio real. Rodar: node teste-revogacao-parabens.js (saida 0 = ok)

const fs = require("fs");
const rv = require("./utils/revogacaoParabens.js");
const { conferirAntesDeEnviar } = require("./jobs/mensagensComemorativas.js");

const idx0 = () => fs.readFileSync(__dirname + "/index.js", "utf8");
let falhas = 0;
function checar(nome, cond, det) {
  console.log(`${cond ? "✅" : "❌"} ${nome}${cond ? "" : "  → " + (det || "")}`);
  if (!cond) falhas++;
}

(async () => {
  console.log("\n— Reconhecimento —");
  for (const t of ["SAIR", "sair", " Sair. ", "SAIR!"]) checar(`"${t}" = sair`, rv.pedidoDeRevogacao(t) === "sair", rv.pedidoDeRevogacao(t));
  for (const t of [
    "Não quero mais receber mensagens de aniversário",
    "nao quero receber parabens",
    "Pode parar as mensagens de aniversário",
    "cancela a mensagem de parabéns por favor",
    "não me mande mais parabéns",
    "chega de mensagem de aniversário",
    "para de mandar mensagem de aniversário"
  ]) checar(`natural: "${t}"`, rv.pedidoDeRevogacao(t) === "natural", rv.pedidoDeRevogacao(t));
  for (const t of [
    "Obrigada pelos parabéns! ❤️",
    "vou sair agora, falo depois",
    "quero orçamento para aniversário de 15 anos",
    "parabéns pelo trabalho de vocês",
    "não quero mais orçamento",
    "tira foto no aniversário?",
    "quero cancelar o orçamento de aniversário",
    ""
  ]) checar(`NÃO é revogação: "${t}"`, rv.pedidoDeRevogacao(t) === "", rv.pedidoDeRevogacao(t));

  console.log("\n— Registro: local primeiro, depois PhotoMusic Pro —");
  rv._limparParaTeste();
  let enviado = null;
  let r = await rv.revogarParabens("5521977776666@c.us", "SAIR", { semDisco: true, post: async (u, corpo) => { enviado = corpo; return { data: { registrado: true } }; } });
  checar("PhotoMusic Pro recebeu o número e o trecho", enviado && enviado.telefone === "5521977776666" && enviado.trecho === "SAIR", JSON.stringify(enviado));
  checar("registrado nos dois lugares", r.local && r.remoto, JSON.stringify(r));
  checar("revogado localmente (outro formato do mesmo número)", rv.estaRevogadoLocal("21977776666"));

  rv._limparParaTeste();
  r = await rv.revogarParabens("5521955554444", "SAIR", { semDisco: true, post: async () => { throw new Error("ECONNREFUSED"); } });
  checar("PhotoMusic Pro fora do ar: fica só local, mas fica", r.local && !r.remoto && rv.estaRevogadoLocal("5521955554444"));

  console.log("\n— A rotina respeita a revogação local —");
  const reg = { tipo: "aniversario_pessoal", destinatario: "celebrado", nomeCelebrado: "Teste", dia: 1, mes: 1, ano: 1980 };
  const motivo = await conferirAntesDeEnviar(reg, "5521955554444", {
    estaPausado: () => false, estaPausadoEspecial: () => false,
    get: async () => ({ data: { elegivel: true } })   // mesmo se o PhotoMusic Pro dissesse "sim"
  });
  checar("revogou no WhatsApp: não envia mesmo com o PhotoMusic Pro dizendo sim", motivo === "revogou_no_whatsapp", motivo);
  const outro = await conferirAntesDeEnviar(reg, "5521911112222", {
    estaPausado: () => false, estaPausadoEspecial: () => false, get: async () => ({ data: { elegivel: true } })
  });
  checar("outro número não é afetado", outro === "", outro);

  console.log("\n— Fontes —");
  const job = fs.readFileSync(__dirname + "/jobs/mensagensComemorativas.js", "utf8");
  checar("toda mensagem diz como parar (os 2 envios)", (job.match(/sendText\(telefone, mensagem \+ rodapeComoParar\(registro\.link_sair\)\)/g) || []).length === 2);
  checar("rodapé fala em SAIR", /responda SAIR/.test(rv.RODAPE_COMO_PARAR));
  const lk = "https://photomusic.com.br/?pm_parabens_sair=" + "a1".repeat(16);
  checar("com link do PhotoMusic Pro: SAIR + link", rv.rodapeComoParar(lk).includes("responda SAIR") && rv.rodapeComoParar(lk).endsWith(lk));
  checar("link de outro domínio é ignorado (fica só o SAIR)", rv.rodapeComoParar("https://golpe.com/?pm_parabens_sair=" + "a1".repeat(16)) === rv.RODAPE_COMO_PARAR);
  checar("sem link: fica o SAIR", rv.rodapeComoParar(undefined) === rv.RODAPE_COMO_PARAR);
  checar("pergunta do orçamento avisa como cancelar", /data de nascimento\*\? É para te enviarmos[^"]*responder SAIR/.test(idx0()));
  const idx = fs.readFileSync(__dirname + "/index.js", "utf8");
  const iRev = idx.indexOf("const tipoRevog = pedidoDeRevogacao(corpoMensagem);");
  const iPausa = idx.indexOf("if (!isOperador && estaPausadoEspecial(chatId)) {");
  checar("SAIR é reconhecido ANTES da pausa especial (vale em qualquer estado)", iRev > 0 && iPausa > iRev);
  checar("revogação não pausa nem bloqueia o atendimento", !/tipoRevog[\s\S]{0,600}pausarCliente/.test(idx.slice(iRev, iPausa)));
  checar("número pausado: registra mas não responde", /const calado = estaPausado\(chatId\) \|\| estaPausadoEspecial\(chatId\);/.test(idx));

  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ Tudo certo");
  process.exit(falhas ? 1 : 0);
})();
