Diagramação detalhada — photomusic-pro.php

photomusic-pro.php
   ├── DEFINIÇÃO DE CONSTANTES
   │       ├── PHOTOMUSIC_PRO_PATH
   │       ├── PHOTOMUSIC_PRO_URL
   │       └── PHOTOMUSIC_PRO_VERSION
   │
   ├── photomusic_pro_autoload_classes()
   │       ├── carrega classes admin
   │       │       ├── Roadmap
   │       │       ├── Ideias Futuras
   │       │       └── Projetos
   │       ├── carrega núcleo (core)
   │       │       ├── Installer
   │       │       ├── Events / Events_Core
   │       │       ├── Financeiro
   │       │       ├── Logs
   │       │       ├── Admin_Menu
   │       │       ├── Access_Rules
   │       │       ├── Token_Generator
   │       │       ├── Helpers
   │       │       └── Contratantes
   │       ├── carrega módulo contratante
   │       ├── carrega convites
   │       ├── carrega contratos
   │       ├── carrega galeria
   │       ├── carrega serviços
   │       ├── carrega empresa
   │       ├── carrega WhatsApp
   │       └── carrega stats
   │
   ├── register_activation_hook()
   │       └── PhotoMusic_Installer::activate()
   │
   ├── photomusic_pro_init_modules()
   │       ├── inicializa Roadmap, Ideias, Projetos
   │       ├── inicializa rotas da galeria
   │       ├── inicializa menu admin
   │       ├── inicializa WhatsApp
   │       ├── inicializa rotas/shortcode de contratos
   │       ├── inicializa painel do contratante
   │       └── inicializa endpoints da galeria
   │
   └── add_action('init', photomusic_pro_init_modules)


Mapa dos módulos carregados
Admin

PhotoMusic_Roadmap_Menu — menu Roadmap

PhotoMusic_Ideias_Futuras — ideias internas

PhotoMusic_Projetos — projetos derivados das ideias

Core

PhotoMusic_Installer — cria tabelas e permissões

PhotoMusic_Events_Core / PhotoMusic_Events — núcleo de eventos

PhotoMusic_Financeiro — financeiro central (futuro ERP)

PhotoMusic_Contratantes — PF/PJ

PhotoMusic_Users — autenticação/autorização

PhotoMusic_Admin_Menu — menus do painel

PhotoMusic_Logs — auditoria

PhotoMusic_Access_Rules / Token_Generator / Helpers — segurança e utilitários

PhotoMusic_Config

Contratante

Login, painel, termo, aceites, permissões de operador

Contratos

Criação, edição, PDF, rotas, logs, e-mail, WhatsApp, permissões

Galeria

Rotas, endpoints, aceite, entrega de arquivos, controle de acesso

Serviços

Serviços, itens, formas de pagamento

Empresa

Dados institucionais, representantes, helpers

WhatsApp

Configurações e envio de mensagens/PDFs

Stats

Estatísticas de acessos e eventos

. Descrição oficial — photomusic-pro.php
Arquivo principal do plugin PhotoMusic Pro.
Responsável por:

definir constantes globais do sistema

carregar todas as classes de núcleo, admin, contratos, galeria, serviços, empresa, WhatsApp e stats

registrar o processo de instalação (tabelas e permissões)

inicializar os módulos principais (menus, rotas, endpoints, painel do contratante, WhatsApp)

Em resumo: é o bootstrap oficial do ecossistema PhotoMusic Pro dentro do WordPress.