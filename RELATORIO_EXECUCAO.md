# Relatório de Execução — Ciclo de 24h / 8 execuções

**Gerado em:** 17/08/2026, 22:26:59 (America/Sao_Paulo) — 2026-08-18 01:26:59 UTC

**Fonte de dados:** exclusivamente a API da Stark Bank (`invoice.query`, `invoice.log.query` com `type=credited`, `transfer.query` filtrado pela conta destino) — nenhum dado vem do Firestore ou de logs internos da aplicação. Reproduzível por qualquer pessoa com acesso Admin a este Sandbox, rodando `npx tsx --env-file=.env scripts/generate-execution-report.ts` ou consultando o próprio dashboard da Stark Bank.

---

## Resumo

- **Janela considerada:** a partir de 16/08/2026, 22:57:00 (America/Sao_Paulo) — 2026-08-17 01:57:00 UTC (início do deploy final e limpo desta submissão). Este Sandbox foi usado em sessões de desenvolvimento anteriores, cujas invoices/transfers permanecem na Stark Bank mesmo após recriar a infra GCP do zero (Firestore não afeta o Sandbox) — excluídas deste relatório por não fazerem parte da execução que conta como entrega.

- **Ciclos detectados:** 8
- **Invoices emitidas no total:** 78
- **Invoices creditadas (pagas e repassadas):** 66
- **Transfers confirmados para a conta destino:** 66
- **Valor total transferido:** R$ 17.603,43
- **Invoices ainda não pagas pelo sandbox:** 12

---

## Ciclos

### Ciclo 1 — 16/08/2026, 22:57:48 (America/Sao_Paulo) — 2026-08-17 01:57:48 UTC — 12 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `4781140745388032` | Beatriz Lima | R$ 149,59 | aguardando pagamento | — | `—` | — |
| `4917279129075712` | Beatriz Lima | R$ 161,09 | transferido | 16/08/2026, 23:02:07 (America/Sao_Paulo) — 2026-08-17 02:02:07 UTC | `5411417144426496` | R$ 161,09 |
| `6358118418087936` | Fernanda Santos | R$ 389,20 | transferido | 16/08/2026, 23:02:12 (America/Sao_Paulo) — 2026-08-17 02:02:12 UTC | `4677175036870656` | R$ 389,20 |
| `4950743534534656` | Patricia Gomes | R$ 64,88 | transferido | 16/08/2026, 23:02:09 (America/Sao_Paulo) — 2026-08-17 02:02:09 UTC | `5133095520960512` | R$ 64,88 |
| `6076643441377280` | Marcos Ferreira | R$ 427,40 | transferido | 16/08/2026, 23:02:12 (America/Sao_Paulo) — 2026-08-17 02:02:12 UTC | `6029093302697984` | R$ 427,40 |
| `4606581329100800` | Juliana Rodrigues | R$ 370,85 | transferido | 16/08/2026, 23:02:02 (America/Sao_Paulo) — 2026-08-17 02:02:02 UTC | `5458648832671744` | R$ 370,85 |
| `5413942469853184` | Larissa Cardoso | R$ 112,83 | aguardando pagamento | — | `—` | — |
| `6329748649148416` | Ricardo Alves | R$ 65,89 | transferido | 16/08/2026, 23:01:59 (America/Sao_Paulo) — 2026-08-17 02:01:59 UTC | `4731431345455104` | R$ 65,89 |
| `6504578916810752` | Larissa Cardoso | R$ 151,37 | aguardando pagamento | — | `—` | — |
| `6043179035918336` | Gustavo Teixeira | R$ 201,43 | transferido | 16/08/2026, 23:02:02 (America/Sao_Paulo) — 2026-08-17 02:02:02 UTC | `5670125707460608` | R$ 201,43 |
| `6049690608992256` | Marcos Ferreira | R$ 299,55 | transferido | 16/08/2026, 23:00:51 (America/Sao_Paulo) — 2026-08-17 02:00:51 UTC | `5093030950338560` | R$ 299,55 |
| `6241158573326336` | Felipe Andrade | R$ 297,77 | transferido | 16/08/2026, 23:00:51 (America/Sao_Paulo) — 2026-08-17 02:00:51 UTC | `6561018694074368` | R$ 297,77 |

### Ciclo 2 — 17/08/2026, 00:00:08 (America/Sao_Paulo) — 2026-08-17 03:00:08 UTC — 8 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `5415984491921408` | Thiago Martins | R$ 343,64 | transferido | 17/08/2026, 00:15:11 (America/Sao_Paulo) — 2026-08-17 03:15:11 UTC | `5880861297737728` | R$ 343,64 |
| `6321504727859200` | Vinicius Moraes | R$ 344,57 | transferido | 17/08/2026, 00:15:07 (America/Sao_Paulo) — 2026-08-17 03:15:07 UTC | `5513073651613696` | R$ 344,57 |
| `4880374790356992` | Larissa Cardoso | R$ 42,57 | transferido | 17/08/2026, 00:15:08 (America/Sao_Paulo) — 2026-08-17 03:15:08 UTC | `6182839106142208` | R$ 42,57 |
| `4903769745653760` | Daniela Nascimento | R$ 447,91 | transferido | 17/08/2026, 00:14:59 (America/Sao_Paulo) — 2026-08-17 03:14:59 UTC | `6095202378842112` | R$ 447,91 |
| `6268252904751104` | Rafaela Nunes | R$ 88,22 | transferido | 17/08/2026, 00:14:56 (America/Sao_Paulo) — 2026-08-17 03:14:56 UTC | `4762455907500032` | R$ 88,22 |
| `5058016617431040` | Mariana Pereira | R$ 338,17 | transferido | 17/08/2026, 00:15:17 (America/Sao_Paulo) — 2026-08-17 03:15:17 UTC | `4948474095206400` | R$ 338,17 |
| `5546674810257408` | Camila Barbosa | R$ 184,19 | transferido | 17/08/2026, 00:15:04 (America/Sao_Paulo) — 2026-08-17 03:15:04 UTC | `6076023605035008` | R$ 184,19 |
| `5663639084204032` | Ricardo Alves | R$ 454,83 | aguardando pagamento | — | `—` | — |

### Ciclo 3 — 17/08/2026, 03:00:04 (America/Sao_Paulo) — 2026-08-17 06:00:04 UTC — 8 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `5766484156481536` | Larissa Cardoso | R$ 138,89 | transferido | 17/08/2026, 03:10:46 (America/Sao_Paulo) — 2026-08-17 06:10:46 UTC | `6308508406382592` | R$ 138,89 |
| `4858602091184128` | Carlos Oliveira | R$ 160,26 | transferido | 17/08/2026, 03:10:46 (America/Sao_Paulo) — 2026-08-17 06:10:46 UTC | `6009304375099392` | R$ 160,26 |
| `6231400407629824` | Bruno Araujo | R$ 452,51 | transferido | 17/08/2026, 03:10:46 (America/Sao_Paulo) — 2026-08-17 06:10:46 UTC | `6244839307870208` | R$ 452,51 |
| `6328483143745536` | Camila Barbosa | R$ 15,95 | aguardando pagamento | — | `—` | — |
| `6637688811683840` | Eduardo Souza | R$ 256,64 | transferido | 17/08/2026, 03:10:46 (America/Sao_Paulo) — 2026-08-17 06:10:46 UTC | `5273833009315840` | R$ 256,64 |
| `5886090875502592` | Beatriz Lima | R$ 343,06 | transferido | 17/08/2026, 03:10:46 (America/Sao_Paulo) — 2026-08-17 06:10:46 UTC | `4747202465366016` | R$ 343,06 |
| `6245939945668608` | Vinicius Moraes | R$ 23,31 | transferido | 17/08/2026, 03:10:46 (America/Sao_Paulo) — 2026-08-17 06:10:46 UTC | `5377152834863104` | R$ 23,31 |
| `4593098487234560` | Carlos Oliveira | R$ 93,70 | aguardando pagamento | — | `—` | — |

### Ciclo 4 — 17/08/2026, 06:00:05 (America/Sao_Paulo) — 2026-08-17 09:00:05 UTC — 9 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `5098074066124800` | Eduardo Souza | R$ 421,30 | aguardando pagamento | — | `—` | — |
| `5507631376498688` | Thiago Martins | R$ 446,16 | transferido | 17/08/2026, 06:11:40 (America/Sao_Paulo) — 2026-08-17 09:11:40 UTC | `6103690005970944` | R$ 446,16 |
| `5567795009945600` | Rafaela Nunes | R$ 124,63 | transferido | 17/08/2026, 06:11:40 (America/Sao_Paulo) — 2026-08-17 09:11:40 UTC | `4904050376048640` | R$ 124,63 |
| `6399552236027904` | Mariana Pereira | R$ 120,44 | transferido | 17/08/2026, 06:11:47 (America/Sao_Paulo) — 2026-08-17 09:11:47 UTC | `6269259921489920` | R$ 120,44 |
| `6490409953918976` | Felipe Andrade | R$ 298,73 | transferido | 17/08/2026, 06:11:36 (America/Sao_Paulo) — 2026-08-17 09:11:36 UTC | `6667972842094592` | R$ 298,73 |
| `5509017442975744` | Eduardo Souza | R$ 276,34 | transferido | 17/08/2026, 06:11:36 (America/Sao_Paulo) — 2026-08-17 09:11:36 UTC | `5963364331159552` | R$ 276,34 |
| `5300682672308224` | Larissa Cardoso | R$ 386,88 | aguardando pagamento | — | `—` | — |
| `4594223768666112` | Camila Barbosa | R$ 338,52 | transferido | 17/08/2026, 06:11:47 (America/Sao_Paulo) — 2026-08-17 09:11:47 UTC | `5465275765882880` | R$ 338,52 |
| `5015310952300544` | Vinicius Moraes | R$ 375,82 | transferido | 17/08/2026, 06:11:46 (America/Sao_Paulo) — 2026-08-17 09:11:46 UTC | `6687421796188160` | R$ 375,82 |

### Ciclo 5 — 17/08/2026, 09:00:11 (America/Sao_Paulo) — 2026-08-17 12:00:11 UTC — 11 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `4785679049424896` | Camila Barbosa | R$ 450,30 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `5334703324266496` | R$ 450,30 |
| `5567621097324544` | Vinicius Moraes | R$ 376,39 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `5897653277687808` | R$ 376,39 |
| `4698390818455552` | Mariana Pereira | R$ 44,07 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `5892515624386560` | R$ 44,07 |
| `5929775122087936` | Gustavo Teixeira | R$ 431,23 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `5158612282376192` | R$ 431,23 |
| `5696208391634944` | Thiago Martins | R$ 378,14 | transferido | 17/08/2026, 09:10:49 (America/Sao_Paulo) — 2026-08-17 12:10:49 UTC | `6198667469914112` | R$ 378,14 |
| `4547274306748416` | Mariana Pereira | R$ 432,53 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `6387474500681728` | R$ 432,53 |
| `5366825168666624` | Bruno Araujo | R$ 332,16 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `4712359408959488` | R$ 332,16 |
| `5911578956267520` | Beatriz Lima | R$ 406,36 | aguardando pagamento | — | `—` | — |
| `6672873183772672` | Mariana Pereira | R$ 493,31 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `4599866565066752` | R$ 493,31 |
| `4545411800891392` | Vinicius Moraes | R$ 344,45 | transferido | 17/08/2026, 09:10:46 (America/Sao_Paulo) — 2026-08-17 12:10:46 UTC | `4975653990432768` | R$ 344,45 |
| `4851783461502976` | Rafaela Nunes | R$ 173,10 | transferido | 17/08/2026, 09:10:50 (America/Sao_Paulo) — 2026-08-17 12:10:50 UTC | `6247873836482560` | R$ 173,10 |

### Ciclo 6 — 17/08/2026, 12:00:06 (America/Sao_Paulo) — 2026-08-17 15:00:06 UTC — 8 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `4550243303555072` | Gustavo Teixeira | R$ 485,01 | transferido | 17/08/2026, 12:10:47 (America/Sao_Paulo) — 2026-08-17 15:10:47 UTC | `6541605441896448` | R$ 485,01 |
| `5526540003573760` | Felipe Andrade | R$ 203,14 | transferido | 17/08/2026, 12:10:54 (America/Sao_Paulo) — 2026-08-17 15:10:54 UTC | `6151621840994304` | R$ 203,14 |
| `6724240724197376` | Thiago Martins | R$ 130,89 | transferido | 17/08/2026, 12:10:47 (America/Sao_Paulo) — 2026-08-17 15:10:47 UTC | `5284097503002624` | R$ 130,89 |
| `6520568140529664` | Beatriz Lima | R$ 69,21 | aguardando pagamento | — | `—` | — |
| `4690980791910400` | Vinicius Moraes | R$ 418,11 | transferido | 17/08/2026, 12:13:50 (America/Sao_Paulo) — 2026-08-17 15:13:50 UTC | `4948475437383680` | R$ 418,11 |
| `6752279881318400` | Fernanda Santos | R$ 248,86 | transferido | 17/08/2026, 12:13:48 (America/Sao_Paulo) — 2026-08-17 15:13:48 UTC | `5943556445306880` | R$ 248,86 |
| `5632436717223936` | Felipe Andrade | R$ 376,97 | transferido | 17/08/2026, 12:14:01 (America/Sao_Paulo) — 2026-08-17 15:14:01 UTC | `5203464265138176` | R$ 376,97 |
| `5176875072618496` | Beatriz Lima | R$ 102,43 | transferido | 17/08/2026, 12:13:46 (America/Sao_Paulo) — 2026-08-17 15:13:46 UTC | `4755332033150976` | R$ 102,43 |

### Ciclo 7 — 17/08/2026, 15:00:04 (America/Sao_Paulo) — 2026-08-17 18:00:04 UTC — 12 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `6272109785382912` | Gustavo Teixeira | R$ 387,14 | aguardando pagamento | — | `—` | — |
| `5175039880069120` | Larissa Cardoso | R$ 118,44 | transferido | 17/08/2026, 15:10:49 (America/Sao_Paulo) — 2026-08-17 18:10:49 UTC | `5907151706914816` | R$ 118,44 |
| `5738530160508928` | Fernanda Santos | R$ 131,72 | aguardando pagamento | — | `—` | — |
| `4776992410959872` | Beatriz Lima | R$ 457,20 | transferido | 17/08/2026, 15:10:52 (America/Sao_Paulo) — 2026-08-17 18:10:52 UTC | `5713354360356864` | R$ 457,20 |
| `6589550818230272` | Juliana Rodrigues | R$ 295,40 | transferido | 17/08/2026, 15:10:57 (America/Sao_Paulo) — 2026-08-17 18:10:57 UTC | `6171922641453056` | R$ 295,40 |
| `5112067975544832` | Mariana Pereira | R$ 152,20 | transferido | 17/08/2026, 15:10:56 (America/Sao_Paulo) — 2026-08-17 18:10:56 UTC | `6241157178720256` | R$ 152,20 |
| `5165969815109632` | Thiago Martins | R$ 150,33 | transferido | 17/08/2026, 15:10:54 (America/Sao_Paulo) — 2026-08-17 18:10:54 UTC | `4547022327644160` | R$ 150,33 |
| `4989885819650048` | Thiago Martins | R$ 388,78 | transferido | 17/08/2026, 15:10:49 (America/Sao_Paulo) — 2026-08-17 18:10:49 UTC | `5129695072878592` | R$ 388,78 |
| `5933339072528384` | Marcos Ferreira | R$ 350,04 | transferido | 17/08/2026, 15:10:54 (America/Sao_Paulo) — 2026-08-17 18:10:54 UTC | `5872233715073024` | R$ 350,04 |
| `5956492905676800` | Thiago Martins | R$ 304,59 | transferido | 17/08/2026, 15:10:49 (America/Sao_Paulo) — 2026-08-17 18:10:49 UTC | `5046022734610432` | R$ 304,59 |
| `5550028911280128` | Camila Barbosa | R$ 383,76 | transferido | 17/08/2026, 15:10:51 (America/Sao_Paulo) — 2026-08-17 18:10:51 UTC | `5850856320663552` | R$ 383,76 |
| `5456514856779776` | Beatriz Lima | R$ 213,72 | transferido | 17/08/2026, 15:10:49 (America/Sao_Paulo) — 2026-08-17 18:10:49 UTC | `6216039538884608` | R$ 213,72 |

### Ciclo 8 — 17/08/2026, 18:00:09 (America/Sao_Paulo) — 2026-08-17 21:00:09 UTC — 10 invoices

| Invoice ID | Nome | Valor | Status | Creditada em | Transfer ID | Valor líquido |
|---|---|---|---|---|---|---|
| `5300020374929408` | Daniela Nascimento | R$ 397,28 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `6007454494097408` | R$ 397,28 |
| `4721767117488128` | Beatriz Lima | R$ 153,58 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `4907405617922048` | R$ 153,58 |
| `5388320876003328` | Felipe Andrade | R$ 389,03 | transferido | 17/08/2026, 18:10:59 (America/Sao_Paulo) — 2026-08-17 21:10:59 UTC | `5916669446717440` | R$ 389,03 |
| `6742468431183872` | Camila Barbosa | R$ 10,80 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `6317686516613120` | R$ 10,80 |
| `4517056896565248` | Marcos Ferreira | R$ 32,66 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `5409690299138048` | R$ 32,66 |
| `5372244544978944` | Fernanda Santos | R$ 383,75 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `6306240932085760` | R$ 383,75 |
| `5330300498345984` | Thiago Martins | R$ 52,45 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `6075302050529280` | R$ 52,45 |
| `6265662435491840` | Eduardo Souza | R$ 192,78 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `6503214742503424` | R$ 192,78 |
| `5692610115010560` | Ricardo Alves | R$ 51,43 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `5512352097107968` | R$ 51,43 |
| `5847667024330752` | Camila Barbosa | R$ 281,48 | transferido | 17/08/2026, 18:10:49 (America/Sao_Paulo) — 2026-08-17 21:10:49 UTC | `5381307141980160` | R$ 281,48 |

---

## Observações

- **Intervalo Ciclo 1 → Ciclo 2: 62.3min (não 180min).** Causa: o Ciclo 1 (16/08/2026, 22:57:48 (America/Sao_Paulo) — 2026-08-17 01:57:48 UTC) foi disparado manualmente via `gcloud scheduler jobs run invoice-batch` como smoke test logo após o deploy final, e não pelo cron do Cloud Scheduler — coincidiu de cair perto do próximo tick fixo da grade. A partir do Ciclo 2, todas as execuções vieram 100% do cron (`0 */3 * * *`, `America/Sao_Paulo`, grade fixa às 00h/03h/06h/09h/12h/15h/18h/21h), com intervalo de exatamente 180.0min entre si: 179.9min, 180.0min, 180.1min, 179.9min, 180.0min, 180.1min.
- O 9º disparo do cron (após o Ciclo 8) foi corretamente bloqueado pelo guard `max_cycles_reached` (`completedCycles >= maxCycles`, 8 ≥ 8) — o scheduler não cria mais invoices após o 8º ciclo, mesmo que o cron continue disparando a cada 3h indefinidamente.
- "Creditada" (log `credited` da invoice) é o sinal correto de repasse de fundos — `invoice.status` nunca assume o valor `"credited"` (ver seção de bônus no README).
- Uma invoice sem transfer correspondente apesar de creditada indicaria falha real; não deve ocorrer dado o design de idempotência com recuperação.
