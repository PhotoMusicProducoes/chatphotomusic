# 🔔 Explicação do Scheduler CRON - Disparo às 07:00 e 18:00

## 📍 Trecho de Agendamento às 07:00

```javascript
// Agendar para 07:00 todos os dias
cron.schedule("0 7 * * *", () => {
  console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA...");
  executarEnvioComemoracoes();
}, {
  timezone: TIMEZONE
});
```

### 🔍 Explicação linha por linha:

#### Linha 1: `cron.schedule("0 7 * * *", () => {`
**O que faz:** Cria um agendamento que executa em um horário específico

**Formato CRON:** `"0 7 * * *"`
```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── dia do mês (1 - 31)
│ │ │ ┌───────────── mês (1 - 12)
│ │ │ │ ┌───────────── dia da semana (0 - 6) (0 = domingo)
│ │ │ │ │
0 7 * * *
```

**Breakdown:**
- `0` = **minuto 0** (início da hora)
- `7` = **hora 7** (07:00 AM)
- `*` = **qualquer dia do mês** (1 a 31)
- `*` = **qualquer mês** (janeiro a dezembro)
- `*` = **qualquer dia da semana** (segunda a domingo)

**Resultado:** Executa **todos os dias às 07:00**

---

#### Linha 2-3: `() => { console.log(...); executarEnvioComemoracoes(); }`
**O que faz:** A função a executar quando chegar na hora

```javascript
() => {
  // Arrow function que roda no horário agendado
  console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA...");
  // Mostra mensagem no console/logs
  
  executarEnvioComemoracoes();
  // Executa a função que envia as mensagens
}
```

---

#### Linha 4-5: `}, { timezone: TIMEZONE }`
**O que faz:** Define a timezone para o cálculo correto da hora

```javascript
{
  timezone: TIMEZONE  // = "America/Sao_Paulo"
}
// Garante que 07:00 é do Rio de Janeiro, não UTC
```

---

## ✅ Exemplos de outras horas:

```javascript
// 06:00 da manhã
cron.schedule("0 6 * * *", () => { ... })

// 12:00 (meio-dia)
cron.schedule("0 12 * * *", () => { ... })

// 18:00 (6 da tarde)
cron.schedule("0 18 * * *", () => { ... })

// 23:59 (11:59 da noite)
cron.schedule("59 23 * * *", () => { ... })

// 3:30 da manhã
cron.schedule("30 3 * * *", () => { ... })

// Apenas aos sábados às 14:00
cron.schedule("0 14 * * 6", () => { ... })

// Apenas aos domingos às 10:00
cron.schedule("0 10 * * 0", () => { ... })
```

---

## 🔄 Como usar 07:00 comentado + 18:00 ativo para teste

```javascript
// ================= SCHEDULER =================
console.log("🚀 Sistema de Mensagens Comemorativas iniciado!");
console.log(`📍 Timezone: ${TIMEZONE}`);
console.log("⏰ Agendado para: 18:00 (TESTE)");
console.log("================================================\n");

// 🔴 COMENTADO - 07:00 (desativado para teste)
// cron.schedule("0 7 * * *", () => {
//   console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA (07:00)...");
//   executarEnvioComemoracoes();
// }, {
//   timezone: TIMEZONE
// });

// 🟢 ATIVO - 18:00 (TESTE)
cron.schedule("0 18 * * *", () => {
  console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA (18:00 - TESTE)...");
  executarEnvioComemoracoes();
}, {
  timezone: TIMEZONE
});

// Manter processo rodando
console.log("📌 Aguardando próximo agendamento às 18:00 (TESTE)...\n");
```

---

## 📊 O que acontece em cada disparo:

```
18:00 (quando o cron ativa)
    ↓
console.log("🔔 ACIONANDO...")  ← Mostra no log
    ↓
executarEnvioComemoracoes()  ← Executa função principal
    ├─ Busca JSON
    ├─ Valida datas
    ├─ Normaliza telefones
    ├─ Monta mensagens
    ├─ Envia via sendText()
    └─ Registra resultado
    ↓
console.log("✅ Resumo Final")  ← Mostra resultados
```

---

## 🧪 Como você verá nos logs:

**À 18:00:**
```
🔔 ACIONANDO VERIFICAÇÃO AGENDADA (18:00 - TESTE)...

🎉 ========== INICIANDO VERIFICAÇÃO DE COMEMORAÇÕES ==========
⏰ Horário: 04/03/2026 18:00:05
📥 Buscando dados de: https://photomusic.com.br/wp-content/dados/comemoracoes.json
✅ JSON recebido com sucesso
📊 Total de registros encontrados: 4

📋 Verificando registro: aniversario_proprio
   ✅ Data coincide! (4/3)
   📱 Enviando para: 552198219-2443
   ✅ Mensagem enviada com sucesso!

📊 ========== RESUMO FINAL ==========
✅ Mensagens enviadas: 1
❌ Erros: 0
📋 Total processado: 4

🎉 ========== FIM DA VERIFICAÇÃO ==========
```

---

## 🚀 Após testar em 18:00, retornar para 07:00:

```javascript
// 🟢 ATIVO - 07:00 (produção)
cron.schedule("0 7 * * *", () => {
  console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA (07:00)...");
  executarEnvioComemoracoes();
}, {
  timezone: TIMEZONE
});

// 🔴 COMENTADO - 18:00 (teste desativado)
// cron.schedule("0 18 * * *", () => {
//   console.log("\n🔔 ACIONANDO VERIFICAÇÃO AGENDADA (18:00 - TESTE)...");
//   executarEnvioComemoracoes();
// }, {
//   timezone: TIMEZONE
// });

console.log("📌 Aguardando próximo agendamento às 07:00...\n");
```

---

## ⚠️ Dicas importantes:

✅ **Sempre use timezone:** `{ timezone: TIMEZONE }`
✅ **Horário 24h:** Use 0-23 (não 1-12 AM/PM)
✅ **Testar antes:** Agende para próximos 2-3 minutos para testar
✅ **Logs:** Sempre veja os logs para confirmar execução
✅ **Um de cada vez:** Não deixe dois agendamentos ativos com padrão similar

---

## 🔍 Validação de Formato CRON:

https://crontab.guru/ → Digite `0 18 * * *` para ver explicação visual

---

*Última atualização: 04/03/2026*
