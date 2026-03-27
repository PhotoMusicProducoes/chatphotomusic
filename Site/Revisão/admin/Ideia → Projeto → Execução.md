DIAGRAMA COMPLETO DO FLUXO — “Ideia → Projeto → Execução”

IDEIA FUTURA
   ├── Criada por usuário autorizado
   ├── Editada / Refinada
   ├── Priorizada por gestores
   ├── Aprovada para execução
   └── Transformada em Projeto
            │
            ▼
PROJETO
   ├── Recebe título oficial
   ├── Recebe escopo detalhado
   ├── Recebe prioridade final
   ├── Recebe responsável
   ├── Recebe progresso (%)
   ├── Entra em execução
   ├── Pode ser pausado
   └── Concluído
            │
            ▼
EXECUÇÃO / HISTÓRICO
   ├── Projeto concluído
   ├── Data de conclusão registrada
   ├── Ideia original marcada como implementada
   └── Histórico preservado para auditoria

Tela 1 — Ideias Futuras

--------------------------------------------------------------
|  IDEIAS FUTURAS                                            |
--------------------------------------------------------------
[ botão Nova Ideia ]

Tabela:
--------------------------------------------------------------
| ID | Título | Categoria | Prioridade | Status | Autor | ... |
--------------------------------------------------------------
| 12 | IA p/ Galeria | IA | Alta | Planejada | Mario | Edit |
| 11 | Novo App      | App | Média | Rascunho | João  | Edit |
--------------------------------------------------------------

Formulário (se editar/criar):
--------------------------------------------------------------
Título: [__________________________]
Descrição: [textarea]
Categoria: [__________]
Prioridade: [Baixa/Média/Alta/Crítica]
Status: [Rascunho/Planejada/...]
Sigilosa: [x]
Tags: [app, ia]
[Salvar]
--------------------------------------------------------------

Tela 2 — Projetos
--------------------------------------------------------------
|  PROJETOS                                                  |
--------------------------------------------------------------
[ botão Novo Projeto ]

Tabela:
---------------------------------------------------------------------------
| ID | Título | Status | Prioridade | Progresso | Responsável | Ações     |
---------------------------------------------------------------------------
| 5  | IA p/ Galeria | Em andamento | Alta | 40% | Mario | Edit | Concluir |
| 4  | Novo App      | Planejado    | Média | 0% | João  | Edit |          |
---------------------------------------------------------------------------

Formulário:
--------------------------------------------------------------
Título: [__________________________]
Descrição: [textarea]
Prioridade: [Baixa/Média/Alta/Crítica]
Status: [Planejado/Em andamento/Pausado/Concluído]
Responsável: [select]
Progresso: [0–100]
[Salvar]
--------------------------------------------------------------

INTEGRAÇÃO ENTRE AS CLASSES — Botão “Transformar em Projeto”

Esse é o ponto-chave que conecta PhotoMusic_Ideias_Futuras com PhotoMusic_Projetos.

✔ Onde aparece o botão?
Na tabela de Ideias Futuras:
Ações:
[ Editar ]  [ Transformar em Projeto ]



