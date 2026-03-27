DIAGRAMA COMPLETO - includes/core/class-photomusic-users.php

PhotoMusic_Users
   ├── init()
   │       └── (reservado para telas futuras de gestão de usuários)
   │
   ├── current_user_can($cap)
   │       └── return current_user_can($cap)
   │
   ├── is_admin()
   │       └── return current_user_can('pm_gerenciar_usuarios')
   │
   ├── is_user()
   │       └── return current_user_can('pm_ver_eventos')
   │
   ├── can_create_event()
   │       └── return current_user_can('pm_criar_eventos')
   │
   ├── can_edit_event()
   │       └── return current_user_can('pm_editar_eventos')
   │
   ├── can_disable_event()
   │       └── return current_user_can('pm_desativar_eventos')
   │
   ├── can_view_logs()
   │       └── return current_user_can('pm_ver_logs')
   │
   ├── get_current_user()
   │       └── return wp_get_current_user()
   │
   ├── is_contractor()
   │       └── return isset($_SESSION['pm_contratante_evento'])
   │
   └── contractor_can_access_event($id_evento)
           ├── verifica is_contractor()
           ├── compara $_SESSION['pm_contratante_evento'] com $id_evento
           └── return true/false


MAPA DAS TABELAS USADAS
Nenhuma tabela direta.
Usa apenas:
- roles e capabilities do WordPress
- $_SESSION['pm_contratante_evento']

DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Users
Camada de autenticação e autorização do PhotoMusic Pro.  
Centraliza todas as verificações de permissão, tanto para usuários internos (admin, operador, fotógrafo) quanto para contratantes que acessam o painel externo.
Fornece métodos simples para validar capabilities, identificar o tipo de usuário e controlar acesso a eventos específicos.
É a ponte entre o sistema de permissões do WordPress e as regras internas do PhotoMusic.
