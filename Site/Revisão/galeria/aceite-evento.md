PhotoMusic_Aceite_Evento
   ├── __construct()
   │       ├── carrega tabelas
   │
   ├── render_form(evento)
   │       ├── exibe formulário com nonce
   │       └── coleta nome, telefone e aceite
   │
   ├── processar_aceite(id_evento)
   │       ├── valida nonce
   │       ├── valida evento
   │       ├── sanitiza dados
   │       ├── gera device_hash
   │       ├── registrar_device()
   │       ├── evita aceite duplicado
   │       ├── insere aceite em pm_aceites_evento
   │       ├── gerar_token_acesso()
   │       └── redireciona para galeria protegida
   │
   ├── registrar_device()
   │       └── salva device em pm_devices
   │
   ├── gerar_device_hash()
   │       └── hash(ua|ip)
   │
   └── gerar_token_acesso()
           └── hash SHA256(id_evento|id_aceite|timestamp|uuid)


MAPA DAS TABELAS USADAS
Tabela	            Uso
pm_eventos	        Validação do evento
pm_aceites_evento	Registro do aceite do convidado
pm_devices	        Registro do dispositivo (hash, IP, user agent)
pm_servicos	        (não usada diretamente, mas carregada no construtor)

DESCRIÇÃO OFICIAL — PhotoMusic_Aceite_Evento
Gerencia o aceite do convidado antes de acessar a galeria protegida.
Exibe formulário, valida evento, registra dispositivo, evita aceites duplicados, salva o aceite e gera token seguro SHA256 para acesso à galeria.
Garante rastreabilidade, segurança e conformidade com LGPD.