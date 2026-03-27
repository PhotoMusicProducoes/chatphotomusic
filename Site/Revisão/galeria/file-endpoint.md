PhotoMusic_File_Endpoint
   ├── init()
   │       ├── add_rewrite_rules()
   │       └── handle_file_request()
   │
   ├── add_rewrite_rules()
   │       └── cria rota /pm-file/?f=BASE64&token=XYZ
   │
   ├── handle_file_request()
   │       ├── valida parâmetros
   │       ├── decodifica caminho
   │       ├── valida pasta segura
   │       ├── valida token em pm_acessos_galeria
   │       ├── valida evento
   │       ├── valida serviço
   │       ├── valida regras de acesso (PhotoMusic_Access_Rules)
   │       └── deliver_file()
   │
   ├── generate_device_hash()
   │       └── hash(ua|ip) via SHA-256
   │
   └── deliver_file()
           ├── valida extensão
           ├── define headers seguros
           └── envia arquivo

MAPA DAS TABELAS USADAS
Tabela	            Uso
pm_eventos	        Validação do evento
pm_servicos	        Validação do serviço
pm_acessos_galeria	Identificação do token e regras de acesso
pm_logs	            (via Access Rules) registro de auditoria


DESCRIÇÃO OFICIAL — PhotoMusic_File_Endpoint
Endpoint responsável pela entrega segura de arquivos da galeria.
Valida token, evento, serviço, dispositivo, regras de acesso e localização do arquivo antes de liberar o download.
Protege contra acesso indevido, path traversal, arquivos proibidos e dispositivos não autorizados.
É a camada final de segurança do sistema de galeria protegida.