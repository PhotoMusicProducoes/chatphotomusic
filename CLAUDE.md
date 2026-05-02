# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

**ChatBot PhotoMusic** é um bot de WhatsApp para a empresa PhotoMusic Produções — empresa de serviços de fotografia, foto cabine, plataforma 360° e DJ para eventos sociais e corporativos.

O bot recebe mensagens via **Z-API** (webhook), conduz clientes por fluxos de orçamento, envia PDFs de tabelas de preços e se integra com o **plugin WordPress PhotoMusic Pro** via REST API.

Hospedado no **Fly.io**, região `gru` (São Paulo). Projeto separado do PhotoMusic Pro (plugin WordPress em `../Site/photomusic-pro/`).

## Comandos

```bash
# Desenvolvimento local
node server.js
# ou com hot-reload:
npx nodemon server.js

# Deploy no Fly.io
fly deploy

# Ver logs em tempo real no Fly.io
fly logs

# Acessar o volume /data no Fly.io
fly ssh console
ls /data
```

## Variáveis de ambiente (`.env`)

```
INSTANCE_ID=       # ID da instância Z-API
TOKEN=             # Token da instância Z-API
WEBHOOK_URL=       # URL pública do webhook (ngrok em dev, Fly.io em prod)
PM_API_KEY=        # Chave da API gerada pelo plugin WordPress PhotoMusic Pro
PM_API_BASE=       # https://photomusic.com.br/wp-json/photomusic/v1
```

## Arquitetura geral

### Fluxo de uma mensagem

```
Z-API → POST /webhook (server.js)
           ↓
    handleIncomingMessage() (index.js)
           ↓
    ┌──────────────────────────────┐
    │  Comandos do Operador (#)    │  ← verificado PRIMEIRO
    │  Pausa Especial / Normal     │
    │  Fluxo do Cliente (steps)    │  ← máquina de estados por chatId
    └──────────────────────────────┘
           ↓
    services/  (envio de orçamentos, PDFs, textos)
           ↓
    utils/sendText, sendFileByUrl... → Z-API REST
```

### Arquivos principais

| Arquivo | Função |
|---|---|
| `server.js` | Entrada: Express + webhook `/webhook`, inicializa jobs e pausa especial |
| `index.js` | Toda a lógica de conversação — máquina de estados por `chatId` |
| `utils/config.js` | Variáveis de ambiente e URLs base (Z-API + WordPress) |
| `utils/sessions.js` | Estado das conversas em memória, persistido a cada 5s em `/data/sessions.json` |
| `utils/pauseControl.js` | Pausa normal (operador via WhatsApp), persiste em `/data/pausados.json` |
| `utils/pausaEspecialControl.js` | Pausa especial persistente, sincroniza com WordPress (`pm_pausa_especial`) e `/data/pausaEspecial.json` |
| `services/index.js` | Barrel de todos os serviços |
| `jobs/mensagensComemorativas.js` | Cron diário — envia mensagens de aniversário via Z-API |

### Serviços (`services/`)

Cada arquivo de serviço corresponde a um produto da PhotoMusic:

| Arquivo | Produto |
|---|---|
| `fotoCabine.js` | Foto Cabine |
| `totemFotografico.js` | Totem Fotográfico |
| `plataforma360.js` | Plataforma 360° |
| `paparazziDigital.js` | Paparazzi Digital |
| `fotoLembranca.js` | Foto Lembrança |
| `fotografia.js` | Fotografia |
| `somDJ.js` | Som e DJ |
| `iluminacao.js` | Iluminação |
| `eucaristia.js` | Fotografia 1ª Eucaristia |
| `tarefas.js` | Tarefas do operador (consulta/confirma via API WordPress) |
| `eventos.js` | Galeria de fotos — busca eventos com `chatbot_ativo=1` na API WordPress |
| `avaliacaoEmpresa.js` | Envia avaliação do Google no início de cada orçamento |
| `fluxoOrcamento.js` | Helpers: `capitalizarPalavras`, `normalizarHorario`, `calcularDuracaoEvento` |

### Estado da sessão (`sessions[chatId]`)

Cada cliente tem um objeto com campos como:
- `step` — etapa atual do fluxo (ex: `"aguardando_opcao"`, `"orcamento_celebracao"`, `"orcamento_convidados"`)
- `orcamento` — dados coletados: `celebracaoId`, `convidados`, `horas`, `data`, `nome`, `email`, `dataNascimento`
- `enviouAvaliacao`, `primeiraRodadaFinalizada`, `enviandoOrcamentos` — flags de controle de fluxo
- `pausado` — se o operador pausou este cliente

A chave especial `sessions["__ultimo_cliente__"]` guarda o chatId do último cliente que enviou mensagem (usado para comandos do operador sem número explícito).

### Persistência de estado (`/data/`)

O volume `/data` no Fly.io armazena:
- `sessions.json` — estado de todas as sessões ativas
- `pausados.json` — clientes pausados pelo operador
- `pausaEspecial.json` — números com pausa especial (sincronizado com WordPress)

Em desenvolvimento local (sem `/data`), os arquivos ficam na raiz do projeto.

## Integração com o WordPress (PhotoMusic Pro)

Todas as chamadas usam `X-PM-API-Key` no header. Base URL em `PM_API_BASE`.

| Endpoint | Método | Usado em |
|---|---|---|
| `/eventos-chatbot` | GET | `services/eventos.js` — lista eventos com links de galeria |
| `/comemoracao-capturar` | POST | `index.js` — salva aniversário do cliente após orçamento |
| `/comemoracao-contatos` | GET | `jobs/mensagensComemorativas.js` — busca aniversários do dia |
| `/pausa-especial` | GET | `utils/pausaEspecialControl.js` — sincroniza números bloqueados |
| `/tarefas` | GET | `services/tarefas.js` — lista tarefas pendentes |
| `/tarefas/:id/concluir` | POST | `services/tarefas.js` — confirma tarefa via WhatsApp |

## Comandos do operador (via WhatsApp)

O telefone do operador está hardcoded: `5521964428172` (em `index.js` e `services/tarefas.js`).

| Comando | Ação |
|---|---|
| `#fotocabine 0,2,120,6,1` | Envia orçamento manual: `celebracaoId, horas, convidados, duracao, dias` |
| `#fotocabine 0,2,120,6,1 -> 5521999999999` | Orçamento para cliente específico |
| `#fotocabine ..., #somdj ...` | Múltiplos orçamentos de uma vez |
| `#cliente 5521999999999` | Define o cliente-alvo para próximos envios |
| `pausar 5521999999999` | Pausa cliente normal |
| `retomar 5521999999999` | Retoma cliente normal |
| `pausarespecial 5521999999999` | Pausa especial persistente |
| `retomarespecial 5521999999999` | Remove pausa especial |
| `resetar 5521999999999` | Reseta sessão do cliente |
| `#tarefas` | Lista tarefas pendentes |
| `#ok ID` | Conclui tarefa pelo ID |

## Deploy no Fly.io

Configuração em `fly.toml`:
- App: `chatphotomusic`, região primária: `gru` (São Paulo)
- 1 máquina shared CPU 1x, 1GB RAM
- `auto_stop_machines = 'stop'` — para quando ocioso, liga automaticamente na chegada de webhook
- Volume `chatbot_data` montado em `/data` (1GB) — **não apagar**, contém estado persistente

```bash
# Ver status das máquinas
fly status

# Ver uso do volume
fly volumes list

# Forçar redeploy sem cache
fly deploy --no-cache
```

## Dependências relevantes

- `express` — servidor HTTP para receber webhook da Z-API
- `axios` / `node-fetch` — chamadas HTTP para Z-API e WordPress
- `node-cron` — agendamento das mensagens comemorativas
- `mysql2` — presente no `package.json` mas **não utilizado** (banco é do WordPress)
- `@wppconnect-team/wppconnect` / `puppeteer` — presentes no `package.json` mas **não utilizados** (Z-API substituiu)
