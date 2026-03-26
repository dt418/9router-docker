# 9Router – Architecture Diagrams

## 1. System Overview

```mermaid
graph TB
    subgraph Clients[Client Tools]
        CC[Claude Code]
        CX[Codex CLI]
        GC[Gemini CLI]
        CU[Cursor]
        CL[Cline / Continue / Roo]
        BR[Browser Dashboard]
    end

    subgraph Router[9Router (localhost:20128)]
        MW[Middleware<br>JWT Auth Guard]

        subgraph CompatAPI[Compatibility API  /v1/*]
            CHAT["/v1/chat/completions<br>OpenAI format"]
            MSG["/v1/messages<br>Claude format"]
            RESP["/v1/responses<br>Codex format"]
            EMB[/v1/embeddings]
            MOD[/v1/models]
        end

        subgraph Core[Routing Core (open-sse)]
            DETECT[Format Detection]
            TRANS[Request Translator]
            EXEC[Provider Executor]
            RTRANS[Response Translator]
            FALLBACK[Account Fallback]
        end

        subgraph MgmtAPI["Management API  /api/*"]
            PROV[/api/providers]
            OAUTH[/api/oauth/...]
            USAGE[/api/usage]
            SET[/api/settings]
            COMBO[/api/combos]
        end

        subgraph Persist["Persistence"]
            LDB[(lowdb<br>db.json)]
            SDB[(SQLite<br>usage.db)]
        end

        subgraph UI["Dashboard UI"]
            DASH[Dashboard Pages]
            STORE[Zustand Stores]
        end
    end

    subgraph Providers["Upstream AI Providers"]
        subgraph OAuth["OAuth"]
            PCLAUDE[Claude]
            PCODEX[Codex / OpenAI]
            PGEMINI[Gemini]
            PGITHUB[GitHub Copilot]
            PKIRO[Kiro]
            PCURSOR[Cursor]
            PQWEN[Qwen]
            PIFLOW[iFlow]
            PANTIGRAV[Antigravity]
        end
        subgraph APIKey["API Key"]
            POPENAI[OpenAI]
            PANTHRO[Anthropic]
            PROUTER[OpenRouter]
            PGLM[GLM / Kimi / MiniMax]
            PNODES[Custom Nodes]
        end
    end

    CC & CX & GC & CU & CL -->|HTTP POST /v1/*| MW
    BR -->|HTTP /dashboard/*| MW
    MW --> CompatAPI
    MW --> MgmtAPI
    MW --> UI

    CHAT & MSG & RESP & EMB --> DETECT
    DETECT --> TRANS --> EXEC --> RTRANS
    EXEC --> FALLBACK --> EXEC
    TRANS & RTRANS -.-> LDB
    FALLBACK -.-> LDB

    EXEC -->|HTTPS| OAuth
    EXEC -->|HTTPS| APIKey

    MgmtAPI <--> LDB
    MgmtAPI <--> SDB
    STORE <-->|fetch /api/*| MgmtAPI
    USAGE <--> SDB
```

---

## 2. Request Lifecycle (Sequence)

```mermaid
sequenceDiagram
    participant Client
    participant API as "/v1/* Route"
    participant Handler as "chat.js Handler"
    participant OSS as "open-sse Core"
    participant DB as localDb
    participant Refresh as "Token Refresh"
    participant Upstream as "Upstream Provider"

    Client->>API: POST /v1/chat/completions
    API->>Handler: handleChat(request, format)

    Handler->>Handler: Parse body, extract API key
    alt requireApiKey=true
        Handler->>DB: Validate API key
    end

    Handler->>OSS: getComboModels(model)
    alt model is a Combo
        OSS-->>Handler: list of fallback models
        Handler->>Handler: handleComboChat() loop
    else single model
        Handler->>OSS: getModelInfo(model)
        OSS-->>Handler: {provider, model, alias info}
    end

    loop Account Fallback
        Handler->>DB: getProviderCredentials(provider, excludeId)
        DB-->>Handler: credentials + connectionId

        Handler->>Refresh: checkAndRefreshToken(provider, creds)
        alt token expiring within 5 min
            Refresh->>Upstream: POST /oauth/token (refresh_token)
            Upstream-->>Refresh: new access_token + expiry
            Refresh->>DB: updateProviderCredentials(connectionId, newCreds)
        end

        Handler->>OSS: handleChatCore(body, creds, format)
        OSS->>OSS: detectFormat() -> translateRequest()
        OSS->>Upstream: HTTP request (provider format)

        alt Success
            Upstream-->>OSS: streaming SSE / JSON
            OSS->>OSS: translateResponse() -> stream back
            OSS-->>Client: Streamed response
            OSS->>DB: trackUsage(connectionId, tokens)
        else Error / Rate Limit
            OSS-->>Handler: error + shouldFallback
            Handler->>DB: markAccountUnavailable(connectionId)
            Note over Handler: retry with next account
        end
    end
```

---

## 3. Provider Fallback Strategy

```mermaid
flowchart TD
    REQ([Incoming Request]) --> COMBO{Is model<br>a Combo?}

    COMBO -->|Yes| CM[Get ordered model list<br>from combo config]
    COMBO -->|No| SM[Single model]

    CM --> LOOP_COMBO[Try next model in combo]
    SM --> LOOP_COMBO

    LOOP_COMBO --> CREDS{Get credentials<br>for provider}
    CREDS -->|No accounts available| ERRALL([Return 503: All accounts unavailable])
    CREDS -->|Got credentials| REFRESH[Check & refresh<br>expiring token]
    REFRESH --> CALL[Call upstream provider]

    CALL --> OK{Success?}
    OK -->|Yes| STREAM([Stream response to client])
    OK -->|Rate limited 429| MARK_RL[Mark account rate-limited<br>until reset time]
    OK -->|Auth error 401| MARK_ERR[Mark account error]
    OK -->|Other error| CHECK_FB{More accounts<br>for this provider?}

    MARK_RL --> CHECK_FB
    MARK_ERR --> CHECK_FB
    CHECK_FB -->|Yes| CREDS
    CHECK_FB -->|No, and is Combo| LOOP_COMBO
    CHECK_FB -->|No fallbacks left| ERRALL
```

---

## 4. Format Translation Pipeline

```mermaid
flowchart LR
    subgraph Input["Incoming Format"]
        OAI_IN[OpenAI<br>/v1/chat/completions]
        CL_IN[Claude<br>/v1/messages]
        GEM_IN[Gemini<br>/v1beta/models/...]
        CODEX_IN[Codex<br>/v1/responses]
    end

    subgraph Translator["open-sse/translator"]
        DETECT[detectFormat<br>by endpoint + body]
        REQ_TRANS[translateRequest<br>to provider format]
        RESP_TRANS[translateResponse<br>to client format]
    end

    subgraph ProvFmt["Provider Formats"]
        OAI_FMT[OpenAI format]
        ANT_FMT[Anthropic format]
        GEM_FMT[Gemini format]
        CUR_FMT[Cursor protobuf]
        GH_FMT[GitHub Copilot]
    end

    subgraph Executors["open-sse/executors"]
        EX_OAI[openai.js]
        EX_ANT[claude.js]
        EX_GEM[gemini-cli.js]
        EX_CUR[cursor.js]
        EX_GH[github.js]
        EX_DEF[default.js]
    end

    OAI_IN & CL_IN & GEM_IN & CODEX_IN --> DETECT
    DETECT --> REQ_TRANS
    REQ_TRANS --> OAI_FMT --> EX_OAI
    REQ_TRANS --> ANT_FMT --> EX_ANT
    REQ_TRANS --> GEM_FMT --> EX_GEM
    REQ_TRANS --> CUR_FMT --> EX_CUR
    REQ_TRANS --> GH_FMT --> EX_GH
    REQ_TRANS --> EX_DEF

    EX_OAI & EX_ANT & EX_GEM & EX_CUR & EX_GH & EX_DEF --> RESP_TRANS
    RESP_TRANS --> OAI_IN
    RESP_TRANS --> CL_IN
    RESP_TRANS --> GEM_IN
    RESP_TRANS --> CODEX_IN
```

---

## 5. Data Model

```mermaid
erDiagram
    PROVIDER_CONNECTION {
        string id PK
        string provider
        string authType "oauth | apikey"
        string name
        int priority
        bool isActive
        string email
        string accessToken
        string refreshToken
        string expiresAt
        string projectId
        json providerSpecificData
        string testStatus "active | error"
        string rateLimitedUntil
        int consecutiveUseCount
        string createdAt
        string updatedAt
    }

    PROVIDER_NODE {
        string id PK
        string type "openai | anthropic | ..."
        string name
        string prefix
        string apiType "openai-compatible"
        string baseUrl
        string createdAt
        string updatedAt
    }

    MODEL_ALIAS {
        string alias PK
        string target "provider/model"
    }

    COMBO {
        string id PK
        string name
        string[] models
        string createdAt
        string updatedAt
    }

    API_KEY {
        string id PK
        string name
        string key "sk-{machineId}-{keyId}-{crc8}"
        string machineId
        bool isActive
        string createdAt
    }

    SETTINGS {
        bool requireLogin
        bool requireApiKey
        bool cloudEnabled
        bool tunnelEnabled
        string tunnelUrl
        int stickyRoundRobinLimit
        bool observabilityEnabled
        bool outboundProxyEnabled
        string outboundProxyUrl
    }

    USAGE_RECORD {
        int id PK
        string connectionId FK
        string provider
        string model
        int promptTokens
        int completionTokens
        int totalTokens
        float cost
        int durationMs
        string status
        string createdAt
    }

    PROVIDER_CONNECTION ||--o{ USAGE_RECORD : "tracks"
    PROVIDER_CONNECTION }o--|| SETTINGS : "governed by"
    COMBO }o--o{ MODEL_ALIAS : "references"
```

---

## 6. Authentication Flow

```mermaid
flowchart TD
    REQ([Incoming Request]) --> MATCH{Matches<br>/ or /dashboard/*?}
    MATCH -->|No| PASSTHROUGH([Pass through])
    MATCH -->|Yes| COOKIE{auth_token<br>cookie present?}

    COOKIE -->|Yes| VERIFY[jose.jwtVerify<br>with JWT_SECRET]
    VERIFY -->|Valid| ALLOW([NextResponse.next])
    VERIFY -->|Invalid / expired| LOGIN([Redirect -> /login])

    COOKIE -->|No| FETCH[GET /api/settings/require-login]
    FETCH --> REQLOGIN{requireLogin<br>= true?}
    REQLOGIN -->|No| ALLOW
    REQLOGIN -->|Yes| LOGIN

    subgraph LoginFlow["Login Flow"]
        FORM[POST /api/auth/login<br>username + password] --> BCRYPT[bcrypt.compare<br>with stored hash]
        BCRYPT -->|Match| SIGN[jose.SignJWT<br>-> set auth_token cookie]
        BCRYPT -->|No match| ERR401[401 Unauthorized]
    end

    subgraph APIKeyFlow["/v1/* API Key Check"]
        V1REQ([/v1/* request]) --> SETTING{requireApiKey<br>in settings?}
        SETTING -->|Yes| KEYCHECK[Validate key format<br>sk-machineId-keyId-crc8]
        KEYCHECK -->|Valid| V1PASS([Proceed to handler])
        KEYCHECK -->|Invalid| ERR4012[401 Unauthorized]
        SETTING -->|No| V1PASS
    end
```

---

## 7. OAuth Token Refresh

```mermaid
flowchart TD
    START([checkAndRefreshToken<br>provider, credentials]) --> EXPCHECK{accessToken<br>expires within 5 min?}

    EXPCHECK -->|No| COPILOT{GitHub provider?}
    EXPCHECK -->|Yes| WHICH{Which provider?}

    WHICH -->|Claude| RC[refreshClaudeOAuthToken]
    WHICH -->|Gemini / Antigravity| RG[refreshGoogleToken]
    WHICH -->|Qwen| RQ[refreshQwenToken]
    WHICH -->|Codex| RCX[refreshCodexToken]
    WHICH -->|iFlow| RI[refreshIflowToken]
    WHICH -->|GitHub| RGH[refreshGitHubToken]
    WHICH -->|Others| RA[refreshAccessToken<br>generic flow]

    RC & RG & RQ & RCX & RI & RGH & RA --> MERGE[Merge new creds<br>with existing]
    MERGE --> PERSIST[updateProviderCredentials<br>-> localDb]
    PERSIST --> COPILOT

    COPILOT -->|Yes| COPEXP{copilotToken<br>expires within 5 min?}
    COPILOT -->|No| GEMCHECK{Gemini /<br>Antigravity?}

    COPEXP -->|Yes| RCOP[refreshCopilotToken<br>with new accessToken]
    RCOP --> PERSIST2[Update providerSpecificData<br>-> localDb]
    COPEXP -->|No| GEMCHECK

    PERSIST2 --> GEMCHECK
    GEMCHECK -->|Yes| PROJID[_refreshProjectId<br>in background]
    GEMCHECK -->|No| DONE([Return updated credentials])
    PROJID --> DONE
```

---

## 8. Dashboard UI Structure

```mermaid
graph TD
    ROOT[src/app/layout.js<br>ThemeProvider + Stores] --> LOGIN[/login]
    ROOT --> LANDING[/landing]
    ROOT --> DLAYOUT[dashboard/layout.js<br>Sidebar + Header]

    DLAYOUT --> HOME[/dashboard<br>Overview]
    DLAYOUT --> PROV[/dashboard/providers<br>Provider List]
    DLAYOUT --> USAGE[/dashboard/usage<br>Usage & Charts]
    DLAYOUT --> COMBO[/dashboard/combos<br>Fallback Combos]
    DLAYOUT --> CLI[/dashboard/cli-tools<br>CLI Tool Setup]
    DLAYOUT --> EP[/dashboard/endpoint<br>API Docs]
    DLAYOUT --> TRANS[/dashboard/translator<br>Request Debugger]
    DLAYOUT --> MITM[/dashboard/mitm<br>MITM Proxy]
    DLAYOUT --> CONSOLE[/dashboard/console-log<br>Server Logs]
    DLAYOUT --> QUOTA[/dashboard/quota<br>Rate Limits]
    DLAYOUT --> PROFILE[/dashboard/profile<br>User Settings]

    PROV --> NEWPROV[/dashboard/providers/new]
    PROV --> EDITPROV[/dashboard/providers/:id]

    USAGE --> UOV[OverviewCards]
    USAGE --> UCHART[UsageChart<br>Recharts]
    USAGE --> UTABLE[UsageTable]
    USAGE --> UTOPO[ProviderTopology<br>XYFlow]
    USAGE --> UREQ[RequestDetailsTab]
    USAGE --> ULIMITS[ProviderLimits<br>QuotaProgressBar]

    CLI --> CLAUDE_CARD[ClaudeToolCard]
    CLI --> CODEX_CARD[CodexToolCard]
    CLI --> COPILOT_CARD[CopilotToolCard]
    CLI --> DROID_CARD[DroidToolCard]
    CLI --> OPENCLAW_CARD[OpenClawToolCard]
    CLI --> MITM_CARD[MitmServerCard]
```

---

## 9. Zustand State Management

```mermaid
graph LR
    subgraph Stores["src/store/"]
        TS[useThemeStore<br>theme: light|dark|system<br>-> localStorage]
        US[useUserStore<br>user profile<br>loading / error]
        PS[useProviderStore<br>providers[]<br>loading / error<br>fetchProviders]
        NS[useNotificationStore<br>notifications[]<br>auto-dismiss<br>success/error/warning/info]
    end

    subgraph APIs["Management APIs"]
        AP[/api/providers]
        AU[/api/auth]
        AS[/api/settings]
    end

    subgraph UI["Dashboard Components"]
        SIDEBAR[Sidebar]
        PROVPAGE[Providers Page]
        HEADER[Header]
        TOAST[Toast Notifications]
    end

    PS <-->|fetchProviders| AP
    US <-->|init| AU
    TS -->|applyTheme| DOM[document.documentElement<br>.classList]

    PROVPAGE --> PS
    HEADER --> US
    SIDEBAR --> TS
    TOAST --> NS
```
