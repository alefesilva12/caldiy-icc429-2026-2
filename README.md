# Evidências da Seção 6 (issue 30566 do Cal.diy)

Repositório: https://github.com/alefesilva12/caldiy-icc429-2026-2

- `main` (`45f1192`): importação do Cal.diy no commit `ae027bb` de `calcom/cal.diy`, o mesmo analisado nas Seções 1 e 2. O código é dos contribuidores do Cal.diy, sob licença MIT (`LICENSE`). O histórico completo está no repositório original e não foi copiado.
- PR 1, sem mudança de comportamento: https://github.com/alefesilva12/caldiy-icc429-2026-2/pull/1 (`main` ← `refactor/30566-prepare-credential-update`)
- PR 2, a correção: https://github.com/alefesilva12/caldiy-icc429-2026-2/pull/2 (`refactor/…` ← `fix/30566-validate-credential-keys`)

Nada foi enviado ao `calcom/cal.diy`: não há fork, PR nem comentário lá.

| PR | CS | Commit | Mensagem |
|---|---|---|---|
| 1 | CS1 | `5cc120b` | test(trpc): add characterization tests for updateAppCredentials |
| 1 | CS2 | `391cbe4` | refactor(trpc): extract credential key validator lookup |
| 1 | CS3 | `45d3d7c` | refactor(trpc): select only needed credential fields |
| 2 | CS4 | `34a315a` | fix(trpc): validate credential keys per app on the server |
| 2 | CS5 | `31ab364` | docs: require server-side schemas for credential keys |

## Conteúdo da pasta

| Item | O que é |
|---|---|
| `pr1-patches/`, `pr2-patches/` | Os commits de cada PR, um por arquivo (`git format-patch`) |
| `evidencias/01…04-*.txt` | Saídas reais do Vitest e do ensaio de recuo, sobre os commits acima. São a evidência [E] da Seção 6 |
