## Identificação da Equipe

**Disciplina:** Programação para Dispositivos Móveis  
**Período:** 2026.2  
**Projeto:** Sistema de Registro e Acompanhamento de Medições em Construções Civis  
**Equipe:** Metria

| Nome completo | Matrícula | Turma | Turno | GitHub |
| :--- | :--- | :--- | :--- | :--- |
| Cícero Higor de Medeiros Carnaúba | 574228 | T02A | Noite | [@cicerocarnauba](https://github.com/cicerocarnauba) |
| Emilly Wictoria Pinheiro Ferreira | 567253 | T02A | Noite | [@Emilly-Pinheiro](https://github.com/Emilly-Pinheiro) |
| Gabriel Ribeiro de Sousa | 567908 | T01A | Tarde | [@gabrielrbsousa](https://github.com/gabrielrbsousa) |
| Kawan Torres Lopes | 563869 | T01A | Tarde | [@kawantorres](https://github.com/kawantorres) |
| Layssa da Silva de Oliveira | 564923 | T02A | Noite | [@Layssaoliveira26](https://github.com/Layssaoliveira26) |
| Mel Barbosa Mello | 571597 | T02A | Noite | [@abebuh21](https://github.com/abebuh21) |

### Descrição do projeto

Na engenharia civil e na fiscalização de obras públicas e privadas, o levantamento de quantitativos executados em campo ainda é frequentemente feito em pranchetas de papel ou planilhas avulsas, com posterior redigitação no escritório. Esse processo gera erros de cálculo acumulado, perda de vínculo entre serviços medidos e evidências fotográficas, atrasos na liberação de boletins de medição e baixa rastreabilidade sobre prorrogações de prazo.

O público-alvo da solução é composto por engenheiros civis, fiscais de obras, mestres de obras e gestores de contratos que atuam diretamente em canteiros de obras (inclusive em locais com conectividade instável ou inexistente).

O objetivo principal do sistema é digitalizar de ponta a ponta o ciclo de medição física e financeira de obras, integrando o aplicativo móvel a uma API REST com persistência relacional e suporte a operação *offline-first*. Entre as funcionalidades implementadas estão:

- Cadastro, autenticação JWT e edição de perfil do responsável técnico;
- Gerenciamento completo do ciclo de vida de obras (cadastro com foto de capa, listagem com busca e filtros avançados, visualização detalhada, edição cadastral com histórico de prorrogações de conclusão, arquivamento, reativação, encerramento e exclusão);
- Download de planilha-modelo e importação de planilhas orçamentárias (`.xlsx`), estruturando automaticamente etapas e serviços (SINAPI/SEINFRA/próprios);
- Registro de medições por ciclo com cálculo automático de quantidades acumuladas, saldo remanescente, valores financeiros e percentual ponderado de execução;
- Abertura sequencial e encerramento imutável de ciclos de medição, com consulta histórica por ciclo;
- Captura e galeria de fotografias georreferenciadas (GPS + endereço por extenso) vinculadas à obra, ao ciclo e ao serviço;
- Pré-visualização e exportação da planilha final de medição (`.xlsx`) e do relatório fotográfico técnico em PDF.

**Caso de uso concreto:** Uma engenheira fiscal responsável pela *Reforma da Escola Municipal São José* cadastra a obra no aplicativo informando endereço e datas previstas (`POST /obras`) e importa a planilha orçamentária `.xlsx` com as etapas de *Fundação*, *Alvenaria* e *Cobertura*. Durante a vistoria semanal no canteiro, ela acessa a etapa *Alvenaria*, seleciona o serviço `ALV-01 (Alvenaria de vedação em blocos cerâmicos - 200 m²)`, registra a execução de `80 m²` no Ciclo 1 e fotografa a parede levantada com coordenadas GPS registradas automaticamente. O sistema calcula imediatamente `40%` de execução no serviço, atualiza o saldo para `120 m²` e recalcula o avanço financeiro da obra. Ao fim do mês, ela encerra o Ciclo 1 (tornando-o imutável para auditoria), abre automaticamente o Ciclo 2 e exporta pelo próprio celular o Boletim de Medição em `.xlsx` e o Relatório Fotográfico em `.pdf` para prestação de contas.

### API REST

**Tecnologias:** JavaScript (Node.js 18+), framework Express 5, banco de dados relacional PostgreSQL 16 (driver `pg`), autenticação stateless com JSON Web Token (`jsonwebtoken`) e hash de senhas com `bcryptjs`, aritmética financeira de alta precisão com `decimal.js`, manipulação de planilhas com SheetJS (`xlsx`), suíte de testes automatizados com `node:test` e containerização com Docker e Docker Compose (incluindo Adminer para inspeção do banco).

**Execução:**
- *Pré-requisitos:* [Node.js](https://nodejs.org/) (v18+) e [Docker / Docker Compose](https://www.docker.com/) instalados.
- *Variáveis de ambiente:* Copie os arquivos de exemplo na raiz e na pasta `backend/`:
  ```bash
  cp .env.example .env
  cp backend/.env.example backend/.env
  ```
  Gere uma chave secreta para `JWT_SECRET` e preencha nos dois arquivos `.env`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Principais variáveis utilizadas pela API (`backend/.env`):
  - `PORT=3000`
  - `DATABASE_URL=postgresql://pies3_user:pies3_pass@localhost:5432/pies3_db`
  - `JWT_SECRET=<chave-secreta>`
- *Comandos para iniciar a API (recomendado via Docker):*
  ```bash
  docker compose up --build -d
  ```
  A API ficará disponível em `http://localhost:3000` (healthcheck em `GET http://localhost:3000/health`) e o gerenciador Adminer em `http://localhost:8080`.
- *Execução local sem Docker (com PostgreSQL rodando localmente):*
  ```bash
  cd backend
  npm install
  npm run dev
  ```
- *Testes automatizados do backend:* `cd backend && npm test`.

**Entidades (Diagrama Relacional):**

![Diagrama Relacional](./docs/diagrama-relacional.svg)

**Endpoints:**

Todas as rotas de domínio (exceto `/health`, `/auth/register`, `/auth/login` e `/obras/modelo-planilha`) exigem cabeçalho `Authorization: Bearer <token>`.

| Rota | Método | Finalidade |
| :--- | :--- | :--- |
| `/auth/register` | `POST` | Cadastra novo usuário e retorna perfil + token JWT (`201`). |
| `/auth/login` | `POST` | Autentica credenciais e retorna perfil + token JWT (`200`). |
| `/auth/me` | `GET` | Consulta os dados do usuário autenticado (`200`). |
| `/auth/perfil` | `PUT` / `PATCH` | Atualiza nome, e-mail, foto ou senha do usuário (`200`). |
| `/obras` | `GET` | Lista as obras do usuário autenticado, com filtros `incluirArquivadas` e `incluirEncerradas` (`200`). |
| `/obras/:id` | `GET` | Obtém os detalhes cadastrais de uma obra específica (`200`). |
| `/obras` | `POST` | Cadastra uma nova obra vinculada ao usuário logado (`201`). |
| `/obras/:id` | `PUT` | Atualiza os dados cadastrais da obra e registra histórico caso o prazo mude (`200`). |
| `/obras/:id/arquivar` | `PATCH` | Altera o status de uma obra ativa para `arquivada` (`200`). |
| `/obras/:id/desarquivar` | `PATCH` | Reativa uma obra arquivada para o status `ativa` (`200`). |
| `/obras/:id/encerrar` | `PATCH` | Encerra definitivamente a obra e fecha ciclos abertos (`200`). |
| `/obras/:id` | `DELETE` | Remove em transação a obra e registros dependentes, registrando tombstone de sincronização (`200`). |
| `/obras/:id/planilha-base` | `POST` | Importa etapas e serviços da planilha orçamentária e abre o Ciclo 1 (`201`). |
| `/obras/estrutura/:obra_id` | `GET` | Retorna árvore hierárquica de etapas, serviços, ciclo ativo e progresso ponderado (`200`). |
| `/obras/:id/planilha-final` | `GET` | Gera os dados consolidados da planilha final de medição (`200`). |
| `/obras/:id/historico-conclusao` | `GET` | Lista o histórico de alterações da data prevista de conclusão (`200`). |
| `/medicoes` | `POST` | Registra ou atualiza a quantidade medida de um serviço no ciclo aberto (`200`/`201`). |
| `/medicoes/ciclo/:ciclo_id` | `GET` | Lista todas as medições registradas em determinado ciclo (`200`). |
| `/ciclos/obra/:obra_id` | `GET` | Lista os ciclos de medição da obra em ordem cronológica (`200`). |
| `/ciclos/:id/encerrar` | `POST` | Encerra o ciclo atual e abre automaticamente o próximo ciclo (`200`). |
| `/sync/push` | `POST` | Sincroniza em lote mutações realizadas em modo offline no dispositivo (`200`). |
| `/sync/pull` | `GET` | Retorna carga completa ou incremental (`?since=`) para hidratação do SQLite mobile (`200`). |

*Exemplo de Entrada e Saída (`POST /obras`):*
```json
// Requisição: POST /obras
{
  "nome": "Reforma da Escola Municipal São José",
  "endereco": "Rua José de Alencar, 450 - Centro, Quixadá/CE",
  "data_inicio": "01/09/2026",
  "data_conclusao": "15/12/2026",
  "descricao": "Reforma de salas de aula, revisão elétrica e pintura geral."
}

// Resposta (201 Created)
{
  "id": "8f14e45f-ceea-467f-9a28-7b388c9910e2",
  "usuario_id": "3d6f0a12-91b8-4c55-82c0-0f77b2194a11",
  "nome": "Reforma da Escola Municipal São José",
  "endereco": "Rua José de Alencar, 450 - Centro, Quixadá/CE",
  "data_inicio": "2026-09-01",
  "data_conclusao": "2026-12-15",
  "descricao": "Reforma de salas de aula, revisão elétrica e pintura geral.",
  "orcamento_total": "0.00",
  "status": "ativa",
  "sync_status": "synced",
  "version": 1
}
```

**Validações:**
- *Autenticação e autorização:* Validação de formato de e-mail, unicidade de cadastro (`409` / `400`), confirmação de senha atual para troca de credenciais, verificação de assinatura/expiração do token JWT (`401`) e isolamento estrito por `usuario_id` em todas as consultas e mutações para impedir acesso cruzado entre contas (`403` / `404`).
- *Obras e datas:* Obrigatoriedade de `nome` e `endereco`, validação real de calendário (dias por mês e anos bissextos nos formatos `DD/MM/AAAA` e `AAAA-MM-DD`), bloqueio de `data_conclusao < data_inicio` (`400`) e proteção de obras arquivadas ou encerradas contra edições indevidas (`400`).
- *Planilhas, medições e ciclos:* Verificação de colunas obrigatórias da planilha-base, impedimento de reimportação quando já há medições lançadas, validação de não negatividade e de teto `100%` da quantidade orçada, exigência de valores inteiros para unidades discretas (`un`, `und`, `pç`, `cj`, `vb`, `gl`) e imutabilidade de ciclos com status `encerrado`.
- *Formato padrão de erro JSON (`400`, `401`, `404`, `500`):*
  ```json
  {
    "erro": "A data de conclusão não pode ser anterior à data de início.",
    "mensagem": "A data de conclusão não pode ser anterior à data de início."
  }
  ```

**Persistência:** Os dados do servidor são armazenados de forma relacional no PostgreSQL 16, inicializado automaticamente pelo script [`backend/src/database/schema.sql`](./backend/src/database/schema.sql) e mantido em volume Docker persistente (`pgdata`), garantindo durabilidade mesmo após reiniciar os containers ou o aplicativo. No dispositivo móvel, há espelhamento relacional em SQLite (`expo-sqlite`) para operação offline em campo e reconciliação automática via cursor incremental.

### Aplicação mobile

**Protótipo:** [Figma](https://www.figma.com/design/oUi0UBlwBdxAAsCJ5W0Jhh/PIES-III?node-id=20-37)

**Tecnologias e Organização do Código:**
- Desenvolvido em React Native (0.88) + Expo (SDK 58) com navegação via `@react-navigation/native-stack`.
- Arquitetura em camadas dentro de [`mobile/src/`](./mobile/src):

```text
mobile/
└── src/
    ├── components/     # +30 componentes visuais reutilizáveis (cards, filtros, cabeçalhos, modais e banner de conectividade)
    ├── constants/      # Mensagens padronizadas de confirmação e feedback
    ├── context/        # Gerenciamento de sessão (AuthContext), sincronização (SyncContext) e rolagem
    ├── database/       # Configuração do SQLite local (expo-sqlite)
    │   └── migrations/ # Script de criação do schema local (001_schema_inicial.sql)
    ├── hooks/          # Hooks customizados (useSync, useFeedbackAcao)
    ├── navigation/     # Pilha de rotas do aplicativo (AppNavigator.js)
    ├── repositories/   # Repositórios SQLite (obras, ciclos, medições, fotografias, relatórios e fila de sync)
    ├── screens/        # Telas do app (Login, Register, Home, NovaObra, EditarObra, DadosProjetoScreen,
    │                   # ImportarPlanilhaScreen, AcompanhamentoObraScreen, Medicao, DetalhesCicloScreen,
    │                   # CapturaFotoScreen, PreviaPlanilhaScreen, PreviaRelatorioFotograficoScreen,
    │                   # PerfilScreen, ObrasArquivadas e ObrasEncerradas)
    ├── services/       # Consumo HTTP JSON da API REST (api.js, authService.js, medicaoService.js,
    │                   # cicloService.js, planilhaFinalService.js, relatorioFotograficoService.js, storage.js)
    ├── styles/         # Sistema de design responsivo (theme.js) e estilos compartilhados de modais
    ├── sync/           # Motor de sincronização offline-first (syncManager.js) via NetInfo
    └── utils/          # Validações, formatadores, parsers de planilha, cálculos locais, GPS e responsividade
```

**Instalação, Configuração e Execução do Aplicativo:**
1. Certifique-se de que a API REST esteja em execução (`docker compose up -d`).
2. Instale as dependências do aplicativo móvel:
   ```bash
   cd mobile
   npm install
   ```
3. *(Opcional)* Configure a URL da API caso não esteja na mesma rede local automática do Expo Go:
   ```bash
   cp .env.example .env
   ```
   Por padrão, [`mobile/src/services/api.js`](./mobile/src/services/api.js) detecta automaticamente o IP da máquina host no Expo Go, usa `http://10.0.2.2:3000` no Emulador Android e `http://localhost:3000` na Web. Se necessário, defina `EXPO_PUBLIC_API_URL=http://<SEU_IP_LOCAL>:3000` no `mobile/.env`.
4. Inicie o servidor de desenvolvimento do Expo:
   ```bash
   npx expo start
   ```
   Pressione `a` para abrir no Emulador Android ou escaneie o QR Code com o aplicativo Expo Go no dispositivo físico.
5. Para executar os testes automatizados do aplicativo:
   ```bash
   npm test
   ```

### Organização Git

- **`main`:** mantém a versão estável e validada para entrega e apresentação da disciplina.
- **`develop`:** branch de integração contínua onde todas as funcionalidades, correções e refatorações revisadas via Pull Request são reunidas e testadas em conjunto antes de irem para a `main`.
- **`feature/*`** *(além de `fix/*` e `refactor/*`)*: branches isoladas por funcionalidade ou história de usuário — como `feature/autenticacao`, `feature/mobile-autenticacao-cadastro`, `feature/backend-obras`, `feature/importacao-planilha`, `feature/tela-medicao-obra`, `feature/US20-US21-US29-ciclos-medicao`, `feature/US22-geracao-planilha-final`, `feature/US27-relatorio-fotografico`, `feature/tela-perfil` e `feature/sincronizacao-de-dados`.

**Contribuições:**
- **Cícero Higor de Medeiros Carnaúba ([@cicerocarnauba](https://github.com/cicerocarnauba)):** autenticação JWT no backend e telas de Login/Cadastro no mobile, integração de edição/exclusão/dados da obra e histórico de prorrogações, captura/galeria de fotos, endurecimento de segurança e validações da API REST, precisão decimal/unidades técnicas, revisão/integração de PRs na `develop` e suítes de testes automatizados ([PR #4](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/4), [PR #11](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/11), [PR #28](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/28), [PR #37](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/37), [PR #38](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/38), [PR #45](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/45), [PR #57](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/57)).
- **Emilly Wictoria Pinheiro Ferreira ([@Emilly-Pinheiro](https://github.com/Emilly-Pinheiro)):** importação e parser de planilha orçamentária, telas de visualização de obras e registro de medições, motor de sincronização `SyncContext` / `SyncStatusBanner`, geolocalização por endereço nas fotos e abas de obras concluídas/arquivadas ([PR #15](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/15), [PR #23](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/23), [PR #39](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/39), [PR #52](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/52), [PR #54](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/54)).
- **Gabriel Ribeiro de Sousa ([@gabrielrbsousa](https://github.com/gabrielrbsousa)):** endpoint e estrutura hierárquica de acompanhamento da obra, cálculo ponderado de etapas e gerenciamento de ciclos de medição, captura de fotos com geolocalização/SQLite, filtro de fotos por ciclo e tela de perfil do usuário ([PR #7](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/7), [PR #18](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/18), [PR #41](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/41), commit [`edf726b`](https://github.com/Layssaoliveira26/Projeto-Integrado-3/commit/edf726b)).
- **Kawan Torres Lopes ([@kawantorres](https://github.com/kawantorres)):** cadastro, exclusão e arquivamento de obras, geração e pré-visualização bidirecional da planilha final de medição (`.xlsx`) e geração/exportação do relatório fotográfico em PDF ([PR #21](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/21), [PR #34](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/34), [PR #36](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/36), [PR #40](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/40), [PR #44](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/44), [PR #53](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/53)).
- **Layssa da Silva de Oliveira ([@Layssaoliveira26](https://github.com/Layssaoliveira26)):** configuração inicial da arquitetura, Docker e schema relacional PostgreSQL/SQLite, unificação das rotas de backend de obras/medições, modelagem da entidade de fotos e fluxos de obras arquivadas/encerradas ([PR #1](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/1), [PR #3](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/3), [PR #9](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/9), [PR #10](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/10), commit [`6c5d38a`](https://github.com/Layssaoliveira26/Projeto-Integrado-3/commit/6c5d38a)).
- **Mel Barbosa Mello ([@abebuh21](https://github.com/abebuh21)):** setup do frontend mobile, `NavBar` e integração da tela Home, tela de edição de obra, filtros avançados de obras, padronização do design system/responsividade e modais de feedback ([PR #25](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/25), [PR #29](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/29), [PR #33](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/33), [PR #50](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/50), [PR #55](https://github.com/Layssaoliveira26/Projeto-Integrado-3/pull/55)).
