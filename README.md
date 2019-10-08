
# SteamBotCreator


Prerequisites: `NodeJS > 11.0.0, Intermediate JS Knowledge`

-   install all needed packages using `./install.sh`
-   edit the email-module so it can connect to your mails imap.
-   setup your proxy API / list inside proxymanager.js
-   run proxyManager using `pm2 start proxymanager.js --name "Proxy"`
-   run the Creator using `pm2 start app.js --name "Creator"`
- optional step: edit the "Word-list" inside `./dicts/`

### Features
- runs automated
- prints username/password to console (can be edited easily so its saved somewhere else)
- proxy support
- uses puppeteer

## Why
the cathook accgen runs browser/electron only, and I needed something that runs 24/7 on a server.

credits partially to https://gitlab.com/nullworks/accgen ( https://accgen.cathook.club/ )
