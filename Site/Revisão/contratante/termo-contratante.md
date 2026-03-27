PhotoMusic_Termo_Contratante
   ├── init()
   │     ├── add_shortcode('photomusic_termo_contratante', render_termo)
   │     └── add_action('init', processar_aceite)
   │
   ├── render_termo()
   │     ├── valida parâmetro evento
   │     ├── carrega evento e verifica status
   │     ├── exibe texto do termo
   │     └── exibe formulário:
   │           ├── nome_contratante
   │           ├── email_contratante
   │           ├── hidden id_evento
   │           ├── hidden pm_aceitar_termo
   │           └── nonce pm_termo_nonce
   │
   ├── processar_aceite()
   │     ├── verifica pm_aceitar_termo
   │     ├── valida nonce
   │     ├── sanitiza id_evento, nome, email
   │     ├── valida evento e status
   │     ├── coleta IP e user agent
   │     ├── detecta navegador e dispositivo
   │     ├── insere registro em wp_pm_aceite_contratante
   │     ├── registra log (PhotoMusic_Logs)
   │     └── redireciona para /acesso-contratante/?evento=...&termo_ok=1
   │
   ├── contratante_aceitou(id_evento)
   │     ├── consulta wp_pm_aceite_contratante por id_evento
   │     └── retorna true/false
   │
   ├── detect_browser(ua)
   │     └── retorna nome do navegador (Chrome, Firefox, Safari, Edge ou Desconhecido)
   │
   └── detect_device(ua)
         └── retorna tipo de dispositivo (iPhone, iPad, Android ou Desktop)


MAPA DAS TABELAS USADAS
wp_pm_aceite_contratante

Armazena o aceite do termo do contratante por evento:
id_evento
nome_contratante
email_contratante
ip
navegador
dispositivo
user_agent
aceite_em
versao_termo

DESCRIÇÃO OFICIAL
Controla o fluxo de aceite do termo de responsabilidade do contratante no PhotoMusic Pro.
Exibe o texto do termo, coleta nome e e-mail do contratante, registra o aceite com IP, navegador, dispositivo, user agent, data/hora e versão do termo em tabela dedicada.
Integra com o módulo de eventos para validar status, registra log de auditoria e redireciona o contratante para a tela de acesso após o aceite.
Fornece um método de verificação (contratante_aceitou) usado para bloquear o painel até que o termo seja aceito.