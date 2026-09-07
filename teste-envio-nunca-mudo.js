// teste-envio-nunca-mudo.js — Banco de medição do "bot ficou mudo"
//
// Caso real (01/09/2026, cliente 21 96868-4218): ela pediu para corrigir os
// dados, o bot mandou a lista de campos, ela digitou "2" (Convidados) e o bot
// NUNCA MAIS FALOU. Ela não estava pausada, não estava em pausa especial, e o
// anti-loop não tinha disparado. O caminho no código estava correto.
//
// O que faltava não era a causa, era o RASTRO. Duas coisas escondiam qualquer
// falha nesse ponto:
//
//   1) utils/sendText.js tinha um catch que só escrevia no log. Falhou o envio,
//      o bot seguia como se tivesse falado: nada subia, ninguém era avisado, e
//      o log do Fly guarda só uns 2 minutos.
//   2) pedirProximaCorrecao() avançava session.step ANTES de enviar. Sem a
//      pergunta, a próxima mensagem do cliente seria lida como o VALOR do campo.
//
// Rodar:  node teste-envio-nunca-mudo.js

const fs   = require("fs");
const path = require("path");

const { silencioValendo, SILENCIOSO_VALIDADE_MS,
        ativarModoSilencioso, desativarModoSilencioso } = require("./utils/sendText.js");

const fonteSend  = fs.readFileSync(path.join(__dirname, "utils/sendText.js"), "utf8");
const fonteIndex = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

console.log("\n— FALHA DE ENVIO NÃO PODE MAIS SER SILENCIOSA —");
checar("tenta enviar uma segunda vez",
  /Tentando de novo/.test(fonteSend), "");
checar("avisa o operador quando não entrega",
  /async function avisarOperadorFalha/.test(fonteSend), "");
checar("o aviso diz para o operador assumir o atendimento",
  /Assuma esse atendimento/.test(fonteSend), "");
checar("não avisa sobre falha de envio para o próprio operador (evita laço)",
  /phone === operador\) return;/.test(fonteSend), "");
checar("no máximo um aviso a cada 5 min (queda da Z-API não vira enxurrada)",
  /AVISO_FALHA_INTERVALO_MS/.test(fonteSend) && /ultimoAvisoFalha/.test(fonteSend), "");

console.log("\n— O PASSO DA CONVERSA NÃO ANDA ÀS CEGAS —");
const corpoPedir = (fonteIndex.match(
  /async function pedirProximaCorrecao[\s\S]*?\n}/
) || [""])[0];
const posEnvio = corpoPedir.indexOf("await sendText");
const posPasso = corpoPedir.indexOf('session.step = "orcamento_corrigir_valor"');
checar("a pergunta é enviada ANTES de o passo mudar",
  posEnvio > 0 && posPasso > 0 && posEnvio < posPasso,
  `envio em ${posEnvio}, passo em ${posPasso}`);
checar("se não entregou, o passo não muda",
  /entregue === false/.test(corpoPedir), corpoPedir.slice(-300));

console.log("\n— MODO SILENCIOSO TEM PRAZO DE VALIDADE —");
checar("validade de 2 minutos", SILENCIOSO_VALIDADE_MS === 120000, String(SILENCIOSO_VALIDADE_MS));

const numero = "5521999998888";
ativarModoSilencioso(numero);
checar("recém-ligado: cala a boca mesmo", silencioValendo(numero) === true, "");
desativarModoSilencioso(numero);
checar("desligado na mão: volta a falar", silencioValendo(numero) === false, "");

// Vencido: liga e finge que já se passaram 3 minutos.
ativarModoSilencioso(numero);
const relogioReal = Date.now;
Date.now = () => relogioReal() + 3 * 60 * 1000;
const aindaCalado = silencioValendo(numero);
Date.now = relogioReal;
checar("esquecido ligado: se cura sozinho depois de 2 min", aindaCalado === false,
  "continuaria mudo para sempre");
checar("depois de vencer, segue falando", silencioValendo(numero) === false, "");

console.log("\n— O QUE NUNCA PODE VOLTAR —");
// O catch externo continua existindo (pega erro inesperado, tipo chatId
// nulo), mas agora DEVOLVE false: quem chamou fica sabendo que não falou.
const catchExterno = (fonteSend.match(/\} catch \(error\) \{[\s\S]*?\n  \}/) || [""])[0];
checar("o catch externo devolve false em vez de fingir que enviou",
  /return false/.test(catchExterno), catchExterno);
checar("sendText devolve se entregou ou não",
  /@returns \{Promise<boolean>\}/.test(fonteSend), "");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
