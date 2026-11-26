# tiendanube-stores — Claude Code skill for Tiendanube / Nuvemshop

Free skill (MIT) for working with Tiendanube / Nuvemshop stores from Claude Code.
Skill gratuita (MIT) para trabajar con tiendas Tiendanube / Nuvemshop desde Claude Code.

**What it covers / Qué cubre**

- OAuth token exchange for your app (`oauth-token.mjs`) — writes the token to a local `.env`, never prints it.
- Admin REST API client with retries and pagination (`tn-api.mjs`).
- Catalog seeding from JSON (`create-catalog.mjs`, `catalog.example.json`).
- Theme development on the legacy FTP workflow (`.tpl` snipplets, rio theme playbook in `rio-theme.md`), with a git restore point before every push (`safe-push.sh`).
- Installing the Nuvemshop MCP server.

## Install / Instalar

```bash
git clone https://github.com/NahuelBurdisso/tiendanube-stores-skill
mkdir -p ~/.claude/skills
cp -R tiendanube-stores-skill/skills/tiendanube-stores ~/.claude/skills/
```

Then ask Claude Code, e.g. "get an API token for my Tiendanube store" or "pull my theme over FTP".
Después pedile a Claude Code, por ejemplo: «sacá un token de la API de mi tienda» o «bajá mi tema por FTP».

Requirements: Node.js 18+. For theme work, the `@tiendanube/cli`.

## More / Más

- **Kit Tiendanube para agencias** — this skill plus store audit (PDF with money-quantified levers), Argentine retail finance reports, and a commentable client review site: <https://nahuelburdisso.github.io/tiendanube/kit/>
- **Auditoría de tu tienda a precio fijo** (done for you): <https://nahuelburdisso.github.io/tiendanube/>
- **Migrar a Tiendanube sin perder el SEO** (free guide): <https://nahuelburdisso.github.io/tiendanube/migrar-a-tiendanube/>

Author: Nahuel Burdisso — Tiendanube Partner Silver · nahuelburdisso@hotmail.com

License: MIT (see `LICENSE`).
