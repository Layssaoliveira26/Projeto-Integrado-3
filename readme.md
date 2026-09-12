# Sistema de Registro e Acompanhamento de Medições em Construções Civis

Projeto Integrado III: Universidade Federal do Ceará, Campus Quixadá.

## Descrição Geral

O Sistema de Registro e Acompanhamento de Medições em Construções Civis é uma aplicação móvel desenvolvida com o objetivo de facilitar o acompanhamento físico e financeiro de obras diretamente no canteiro de obras. O sistema substitui os processos manuais de anotação e o preenchimento de planilhas complexas em campo, otimizando a rotina de engenheiros e fiscais ao garantir maior rapidez, precisão nos cálculos e rastreabilidade das informações coletadas de forma digital.

## Tecnologias Utilizadas

**Mobile**
- [React Native](https://reactnative.dev) com [Expo](https://expo.dev)
- SQLite (`expo-sqlite`) — banco de dados local, fonte primária dos dados no dispositivo
- `expo-camera` e `expo-location` — captura de fotos com geolocalização
- `expo-file-system` — armazenamento de arquivos (fotos, planilhas)
- `xlsx` — leitura e escrita de planilhas Excel
- `React Navigation` — navegação entre telas
- `@react-native-community/netinfo` — detecção de conectividade (para sincronização)

**Backend**
- [Node.js](https://nodejs.org) com [Express](https://expressjs.com)
- [PostgreSQL](https://www.postgresql.org) — banco de dados de sincronização
- `jsonwebtoken` — autenticação via JWT
- `pg` — driver de conexão com o PostgreSQL

**Infraestrutura**
- [Docker](https://www.docker.com) e Docker Compose — containeriza backend + banco de dados
- Git / GitHub — versionamento

## Estrutura do Repositório

```
.
├─ mobile/     → App React Native (Expo). Fonte primária dos dados (SQLite local).
├─ backend/    → API Express. Autenticação e sincronização entre dispositivos.
├─ docs/       → Documentos do projeto.
└─ docker-compose.yml → Sobe backend + banco PostgreSQL + Adminer.
```

## Como Baixar e Rodar

### Pré-requisitos

- [Node.js](https://nodejs.org) (versão 18 ou superior)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (aberto e rodando)
- [Git](https://git-scm.com)
- App [Expo Go](https://expo.dev/go) instalado no celular (para testar o mobile)

### 1. Clonar o repositório

```bash
git clone git@github.com:Layssaoliveira26/Projeto-Integrado-3.git
cd Projeto-Integrado-3
```

### 2. Configurar as variáveis de ambiente

Copie os arquivos de exemplo e ajuste se necessário:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Gere um segredo aleatório para o JWT e cole no valor de `JWT_SECRET` nos dois arquivos `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Subir o backend + banco de dados (via Docker)

```bash
docker compose up --build
```

- API disponível em: http://localhost:3000
- Adminer (interface do banco) em: http://localhost:8080

### 4. Rodar o app mobile

Em outro terminal:

```bash
cd mobile
npm install
npx expo start
```

Escaneie o QR Code exibido no terminal com o app **Expo Go** (Android) ou com a câmera nativa (iOS).

## Documentação

Os documentos completos do projeto (Documento de Visão, Documento de Requisitos, Documento de Casos de Uso e Documento de Arquitetura) estarão disponíveis na pasta [`docs/`](./docs).