// teste-carinho-comemoracao.js
// Banco de medicao de QUEM AGRADECE: nao abre menu, nao entra no funil.
// Rodar:  node teste-carinho-comemoracao.js      (0 = tudo OK, 1 = falhou)
//
// 🚨 CASO REAL, 15/10/2026 (prints do Mario): a Patricia recebeu o "feliz
// aniversario", REAGIU com um ❤️ e depois respondeu CITANDO a mensagem com
// "💖💖💖💖". O bot:
//   1. abriu o MENU DE BOAS-VINDAS (reacao nao tem texto -> corpo vazio ->
//      "conversa nova");
//   2. respondeu "⚠ Opcao invalida! Escolha uma opcao valida";
//   3. duas horas depois cobrou "🎁 Vamos montar o seu orcamento?".
// Mario: *"nao era para acontecer"*.
//
// 📌 O QUE ESTE BANCO MAIS PROTEGE: **o erro oposto**. Consertar demais faz o
// bot ficar MUDO para quem responde "obrigada! quanto custa a cabine?" - e
// isso custa venda, nao so simpatia. Metade das medicoes aqui e disso.

const fs = require("fs");
const path = require("path");

let falhas = 0;
function checa(cond, rotulo, dica) {
  if (!cond) falhas++;
  console.log((cond ? "[OK]    " : "[FALHOU]"), rotulo, cond ? "" : (dica ? "-> " + dica : ""));
}

const carinho = require("./utils/carinho.js");

/* ============================================================
   1) O TEXTO E SO CARINHO?
   ============================================================ */
console.log("--- so carinho ---");
checa(carinho.ehSoCarinho("💖💖💖💖"), "os 4 coracoes da Patricia");
checa(carinho.ehSoCarinho("❤️"), "um coracao so");
checa(carinho.ehSoCarinho("🙏🙏"), "maos rezando");
checa(carinho.ehSoCarinho("Obrigada!"), "obrigada com exclamacao");
checa(carinho.ehSoCarinho("muito obrigado"), "muito obrigado");
checa(carinho.ehSoCarinho("Amei ❤️"), "amei");
checa(carinho.ehSoCarinho("Deus abençoe vocês"), "deus abencoe");
checa(carinho.ehSoCarinho("") === false, "vazio nao e carinho");

console.log("\n--- 🚨 o erro oposto: quem PEDE nao pode ficar sem resposta ---");
checa(carinho.ehSoCarinho("1") === false, "o numero do menu nao e carinho");
checa(carinho.ehSoCarinho("obrigado, queria um orçamento para a festa da minha filha") === false,
      "agradecimento + pedido nao e so carinho",
      "o limite de tamanho existe para isto");
checa(carinho.pedeAlgo("obrigada! quanto custa a cabine?"), "'quanto custa' e pedido");
checa(carinho.pedeAlgo("💖💖💖") === false, "coracao nao e pedido");

/* ============================================================
   2) QUEM RECEBEU COMEMORACAO
   ============================================================ */
console.log("\n--- a marca de quem recebeu carinho nosso ---");
const NUM = "21999990000";
carinho.marcarComemorativa(NUM);
checa(carinho.recebeuComemorativa(NUM), "o numero fica marcado depois do envio");
checa(carinho.recebeuComemorativa(NUM + "@c.us"), "marca vale com e sem o @c.us",
      "o chatId chega com sufixo e o job envia so o numero");
checa(carinho.recebeuComemorativa("21988887777") === false, "quem nao recebeu nao fica marcado");

console.log("\n--- 🚨 a resposta a uma comemoracao ---");
/* Mario: "poderia ate ser texto, mas normalmente sera agradecimento pela msg" */
checa(carinho.ehAgradecimento("💖💖💖💖", NUM), "os coracoes dela");
checa(carinho.ehAgradecimento("Que linda mensagem, vocês são muito atenciosos, Deus abençoe!", NUM),
      "texto comprido de agradecimento, de quem recebeu a comemoracao",
      "e o caso que o Mario descreveu: na maioria das vezes e agradecimento");
/* 📌 Sem a marca, texto que NAO comeca com agradecimento segue o caminho
   normal: o bot nao tem motivo para supor carinho. Quem escreve "obrigada"
   recebe carinho com marca ou sem - e esse e o certo. */
checa(carinho.ehAgradecimento("Vocês trabalham em Niterói também?", "21988887777") === false,
      "de quem NAO recebeu comemoracao, a mensagem segue o fluxo normal",
      "sem a marca o bot nao tem motivo para supor agradecimento");
checa(carinho.ehAgradecimento("Vocês trabalham em Niterói também?", NUM) === false,
      "🚨 nem com a marca: pergunta se responde",
      "o erro oposto - ficar mudo para quem perguntou");
checa(carinho.ehAgradecimento("obrigada! quero orçamento para o aniversário do meu filho", NUM) === false,
      "🚨 pediu orcamento: NAO e agradecimento, mesmo tendo recebido a comemoracao",
      "ficar mudo para quem quer comprar e pior do que o bug original");
checa(carinho.ehAgradecimento("quanto custa a cabine?", NUM) === false,
      "pergunta de preco segue o fluxo normal");

// envelheceu: passou da janela
const dados = carinho._enviadas();
dados[carinho.soDigitos(NUM)] = Date.now() - (carinho.HORAS_JANELA + 1) * 3600 * 1000;
checa(carinho.recebeuComemorativa(NUM) === false,
      `depois de ${carinho.HORAS_JANELA}h a marca nao vale mais`,
      "senao o numero ficaria fora do funil para sempre");
delete dados[carinho.soDigitos(NUM)];

/* ============================================================
   3) A ESTRUTURA: os 3 pontos do caminho
   ============================================================ */
console.log("\n--- o caminho que a mensagem dela percorreu ---");
function soCodigo(txt) {
  return String(txt)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const srv = soCodigo(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"));
const idx = soCodigo(fs.readFileSync(path.join(__dirname, "index.js"), "utf8"));
const job = soCodigo(fs.readFileSync(path.join(__dirname, "jobs/mensagensComemorativas.js"), "utf8"));

checa(/function extrairReacao/.test(srv), "1) o webhook sabe o que e uma reacao");
/* 🚨 Comparar com `handleIncomingMessage(message)`, nao com "processarComFila(":
   a fila tambem e DECLARADA no topo do arquivo, e a medicao batia na
   declaracao, nao na chamada. Falhou com o codigo certo. */
checa(srv.indexOf("const reacao = extrairReacao(payload)") < srv.indexOf("handleIncomingMessage(message)"),
      "🚨 a reacao para ANTES de virar conversa",
      "depois disso ela ja viraria sessao e menu");
checa(/if \(reacao\) \{[\s\S]{0,200}return;/.test(srv),
      "reacao: responde 200 e nao processa nada");

checa(idx.includes('require("./utils/carinho.js")'), "2) o index conhece o carinho");
checa(idx.indexOf("ehAgradecimento(texto, chatId)") < idx.indexOf("if (!session.menuInicialEnviado) {"),
      "🚨 o agradecimento e visto ANTES de abrir o menu",
      "era o menu de boas-vindas que comecava tudo");
checa(/responderCarinho\(chatId, session,[\s\S]{0,200}return;/.test(idx),
      "responde o carinho e PARA ali");
/* 🚨 Medir SO o ramo do carinho: entre ele e o `if (!session.menuInicialEnviado)`
   mora o atalho de quem veio do site, que marca `menuInicialEnviado = true` com
   todo o direito. A fatia grande acusava falha com o codigo certo. */
const _ini = idx.indexOf("ehAgradecimento(texto, chatId)");
const trechoCarinho = idx.slice(_ini, idx.indexOf("return;", _ini) + 7);
checa(trechoCarinho.includes("menuInicialEnviado = true") === false,
      "🚨 NAO marca `menuInicialEnviado`",
      "com a marca, o lembrete de 2h cobraria orcamento - a 3a mensagem errada que ela recebeu");

checa(job.includes('require("../utils/carinho.js")'), "3) o job de comemoracoes marca o numero");
checa((job.match(/marcarComemorativa\(telefone(, mensagem)?\)/g) || []).length === 2,
      "marca nos DOIS envios do job (responsavel e celebrado)",
      "marcar so num deles deixa metade das pessoas no funil");

/* ============================================================
   4) A PRIMEIRA MENSAGEM TAMBEM (caso Elza, 26/10/2026)
   ============================================================ */
console.log("--- resposta ao carinho com o NOME (27/10/2026) ---");
checa(carinho.nomeNaSaudacao("Bom dia, Karla! 🥳🎂\n\nFeliz aniversário!") === "Karla", "pega o nome da saudacao da comemoracao");
checa(carinho.nomeNaSaudacao("Boa noite, Maria Clara! x") === "Maria", "so o primeiro nome");
checa(carinho.nomeNaSaudacao("Feliz aniversário!") === "", "sem saudacao com nome, fica vazio");
const respNome = carinho.respostaAoCarinho("Karla");
checa(respNome.startsWith("Nós é que agradecemos pelo carinho, Karla! 🥰❤️"), "a resposta chama a pessoa pelo nome");
checa(carinho.respostaAoCarinho("").startsWith("Nós é que agradecemos pelo carinho! 🥰❤️"), "sem nome, a frase continua certa");
checa(/\*Adriana e Mario\*\n\*PhotoMusic Produções\* ❤️$/.test(respNome), "assinatura em negrito, coracao vermelho no fim");
checa(!/[—–]/.test(respNome), "sem travessao longo");
carinho._enviadas()["5521981775333"] = { t: Date.now(), nome: "Karla" };
checa(carinho.nomeDaComemorativa("5521981775333@c.us") === "Karla", "o bot lembra o nome de quem recebeu a comemoracao");
checa(carinho.recebeuComemorativa("5521981775333@c.us") === true, "formato novo { t, nome } conta como recebeu comemoracao");
carinho._enviadas()["5521981775334"] = Date.now();
checa(carinho.recebeuComemorativa("5521981775334") === true && carinho.nomeDaComemorativa("5521981775334") === "", "formato antigo (so timestamp) continua valendo, sem nome");
delete carinho._enviadas()["5521981775333"]; delete carinho._enviadas()["5521981775334"];
checa(job.includes("marcarComemorativa(telefone, mensagem)"), "o job passa a mensagem enviada, de onde sai o nome");

console.log("--- primeira mensagem sem sessao ---");
const FONE_ELZA = "5521980223312";
carinho._enviadas()[FONE_ELZA] = Date.now();   // sem gravar o arquivo
checa(carinho.ehAgradecimento("", FONE_ELZA + "@c.us"),
      "audio/figurinha (corpo vazio) logo apos a comemoracao e carinho",
      "o audio da Elza abria o menu de boas-vindas");
checa(carinho.ehAgradecimento("", "5521911112222@c.us") === false,
      "audio de quem NAO recebeu comemoracao segue o fluxo normal (menu)");
delete carinho._enviadas()[FONE_ELZA];

const iCriacao = idx.indexOf("Criando sessão para cliente");
const blocoCriacao = idx.slice(iCriacao, idx.indexOf('sessions[chatId]?.step === "finalizado"', iCriacao));
checa(iCriacao > 0 && blocoCriacao.length > 100, "achei o bloco de criacao de sessao no codigo");
checa(blocoCriacao.includes("ehAgradecimento(corpoMensagem, chatId)")
      && blocoCriacao.indexOf("ehAgradecimento(corpoMensagem, chatId)") < blocoCriacao.indexOf("mostrarMenuInicial(chatId)"),
      "a criacao de sessao testa o carinho ANTES de abrir o menu",
      "sem isso o 1o audio abre o menu e arma o lembrete de orcamento");
const jobLembrete = fs.readFileSync(path.join(__dirname, "jobs/lembreteOrcamento.js"), "utf8");
checa(/PASSO_MENU_INICIAL && recebeuComemorativa\(chatId\)\) continue/.test(jobLembrete),
      "o lembrete do menu pula quem acabou de receber comemoracao",
      "a Elza recebeu o 'Vamos montar o seu orcamento?' as 11:00");

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s).`); process.exit(1); }
console.log("RESULTADO: tudo OK - quem agradece recebe carinho, nao funil.");
process.exit(0);
