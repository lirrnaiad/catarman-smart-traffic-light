# Local setup

How to run the Catarman SMART Traffic Light workspace on one laptop, on Windows 10/11 or Linux. Everything runs locally (AD-15):

| Service | Address |
| --- | --- |
| Dashboard (dev) | `http://localhost:3000` |
| Backend (Express) | `http://127.0.0.1:4000` |
| Mosquitto | `127.0.0.1:1883` |
| MySQL | `127.0.0.1:3306` |

There are two ways to get MySQL and Mosquitto: **native installs** (the primary path, steps 1 to 7) or the optional **Docker Compose stack** (see [Compose path](#compose-path-optional)). Run every command from the repository root. Windows commands are for PowerShell; the `npm run` scripts themselves work the same in PowerShell, `cmd` and bash (AD-13).

Some commands below belong to later M1 stories: `npm run dev`, `npm run sim`, `npm run db:seed` and `npm run build` start working as the backend, simulator and dashboard stories land. On a checkout that has only the foundation (S0), steps 1 to 6 and the [gates](#gates) all work.

## 1. Install

**Node.js 24.22.1 or later, below 25** (the repo pins it in `.nvmrc`).

- Linux: `nvm install` then `nvm use` in the repo root, or install Node 24 LTS from your package manager if it is at least 24.22.1.
- Windows: the Node 24 LTS installer from nodejs.org, or nvm-windows: `nvm install 24.22.1` then `nvm use 24.22.1`.
- Check: `node -v` prints `v24.22.1` or a later `v24`.

**MySQL Community Server 9.7.4** (8.4.x is accepted; MySQL 8.0, MariaDB and XAMPP are not supported, AD-10):

- Windows: the MySQL 9.7.4 MSI installer from dev.mysql.com. Keep the default port 3306 and set a root password.
- Fedora: `sudo dnf install mysql9.7-server` (or `sudo dnf install mysql-server` for 8.4), then `sudo systemctl enable --now mysqld`.
- Ubuntu 26.04: `sudo apt install mysql-server` (8.4).
- Ubuntu 24.04: add the Oracle MySQL APT repository (`mysql-apt-config` from dev.mysql.com/downloads/repo/apt/), then `sudo apt update && sudo apt install mysql-server`. The distro's own package is MySQL 8.0, which is unsupported.

**Eclipse Mosquitto 2.1.2** (2.0.x is accepted):

- Windows: the 2.1.2 installer from mosquitto.org (it installs to `C:\Program Files\mosquitto`), or WinGet (`winget search mosquitto`).
- Fedora 44: `sudo dnf install mosquitto` (2.1.2).
- Ubuntu 24.04: `sudo add-apt-repository ppa:mosquitto-dev/mosquitto-ppa && sudo apt update && sudo apt install mosquitto` (2.1.2), or the distro's own 2.0.18 with `sudo apt install mosquitto`.
- Ubuntu 26.04: `sudo apt install mosquitto` (2.0.22).

**MySQL Workbench 26.7 or later**, for looking at the schema (AD-10). It never applies schema changes; dbmate does.

## 2. Install the dependencies

```sh
npm install
```

This installs every workspace (`contracts`, `backend`, `simulator`, `dashboard`) from the one root `package-lock.json`. Never edit the lockfile by hand (AD-13).

## 3. Create the MySQL user and bind MySQL to 127.0.0.1

Run `infra/mysql/create-user.sql` as the MySQL root user. It creates the user `stl` with password `stl`, at `localhost` and `127.0.0.1` only, with every privilege on the `stl` and `stl_test` databases. It is safe to run again.

- Fedora (root has no password on a fresh install; press Enter at the prompt):

  ```sh
  mysql -u root -p -e "source infra/mysql/create-user.sql"
  ```

- Ubuntu (root signs in through `sudo`):

  ```sh
  sudo mysql -e "source infra/mysql/create-user.sql"
  ```

- Windows, *PowerShell* (enter the root password you chose in the installer):

  ```powershell
  mysql -u root -p -e "source infra/mysql/create-user.sql"
  ```

  If `mysql` isn't on the PATH, use its full path, for example `& "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe" -u root -p -e "source infra/mysql/create-user.sql"`. In MySQL Workbench you can instead open the file as root and run it.

Then make MySQL accept local connections only (AD-15) by setting both bind addresses to `127.0.0.1`:

- Fedora:

  ```sh
  printf '[mysqld]\nbind-address = 127.0.0.1\nmysqlx-bind-address = 127.0.0.1\n' | sudo tee /etc/my.cnf.d/stl-bind.cnf
  sudo systemctl restart mysqld
  ```

- Ubuntu:

  ```sh
  printf '[mysqld]\nbind-address = 127.0.0.1\nmysqlx-bind-address = 127.0.0.1\n' | sudo tee /etc/mysql/mysql.conf.d/stl-bind.cnf
  sudo systemctl restart mysql
  ```

- Windows: open `C:\ProgramData\MySQL\MySQL Server 9.7\my.ini` as Administrator, and under `[mysqld]` set (or add) these two lines:

  ```ini
  bind-address=127.0.0.1
  mysqlx-bind-address=127.0.0.1
  ```

  Then restart the service from an Administrator PowerShell: `Get-Service MySQL* | Restart-Service`.

Check both, signed in as `stl`:

```sh
mysql -u stl -pstl -h 127.0.0.1 -e "SHOW VARIABLES LIKE '%bind_address'"
```

Both values should read `127.0.0.1`.

## 4. Create the env files

Each package reads its config from its own `.env`, which is gitignored (AD-15). Copy the committed examples:

- Linux:

  ```sh
  cp backend/.env.example backend/.env
  cp simulator/.env.example simulator/.env
  ```

- Windows, *PowerShell*:

  ```powershell
  Copy-Item backend/.env.example backend/.env
  Copy-Item simulator/.env.example simulator/.env
  ```

`simulator/.env.example` arrives with the simulator story; until then, copy only the backend file. `backend/.env.test` (the `stl_test` database) and the dashboard's `.env.development` and `.env.production` are committed and need no copy.

## 5. Start the broker

The repo's broker config must be the only Mosquitto on port 1883, so stop the Mosquitto OS service that the installer may have started, and keep it from starting at boot:

- Linux: `sudo systemctl disable --now mosquitto`
- Windows, Administrator *PowerShell*: `Stop-Service mosquitto; Set-Service mosquitto -StartupType Manual`

Then, in its own terminal:

```sh
npm run broker
```

`infra/scripts/broker.mjs` runs `mosquitto -c infra/mosquitto/mosquitto.conf` from the repo root, using `mosquitto` from the PATH or `C:\Program Files\mosquitto\mosquitto.exe`. It listens on `127.0.0.1:1883` only, keeps its persistence in `infra/mosquitto/data/` (gitignored), and stops with Ctrl+C.

## 6. Migrate the database

```sh
npm run db:migrate
```

dbmate creates the `stl` database on its first run and applies `backend/db/migrations/`. Afterwards `stl` holds the five M1 tables (`vehicle_count`, `signal_state_change`, `breach_event`, `breach_crop`, `override_command`) plus dbmate's `schema_migrations`. The backend's `npm run dev` and `npm start` also migrate first.

Optionally, once the backend core has landed, load 24 h of demo history:

```sh
npm run db:seed
```

## 7. Run the system

In separate terminals:

```sh
npm run dev
```

```sh
npm run sim
```

`npm run dev` starts the backend on `127.0.0.1:4000` and the dashboard on port 3000; open `http://localhost:3000`. `npm run sim` starts the simulator and its REPL (`npm run sim -- --roles controller` starts one role).

## Compose path (optional)

`infra/compose.yaml` runs MySQL 9.7.4 and Mosquitto 2.1.2 in Docker, published on `127.0.0.1:3306` and `127.0.0.1:1883` only. It replaces the MySQL and Mosquitto installs, step 3 and step 5. Hotspot mode (M2) needs the native broker.

1. Do step 1 for Node.js only (plus Docker with Compose v2), then step 2.
2. Stop any native MySQL or Mosquitto service that holds port 3306 or 1883.
3. Start the stack:

   ```sh
   docker compose -f infra/compose.yaml up -d
   ```

   On first start, MySQL runs an init script from `compose.yaml` that creates the user `stl` (password `stl`) inside the container, with the same grants as `create-user.sql`, and a random root password (printed once in `docker compose -f infra/compose.yaml logs mysql`). Skip `create-user.sql`: it is for native installs. The first start takes about half a minute; `npm run db:migrate` waits for it.

4. Continue with step 4, step 6 and step 7.

Stop the stack with `docker compose -f infra/compose.yaml down`. The data stays in the `smart-traffic-light_mysql-data` and `smart-traffic-light_mosquitto-data` volumes; add `-v` to delete them, which also makes the MySQL init script run again on the next start.

## Gates

Every story's definition of done (AD-16). With MySQL running (the backend's tests migrate `stl_test` first):

```sh
npm run typecheck
npm run lint
npm test
```

A story that touches `dashboard/` also runs `npm run build -w dashboard`.

After any change to `contracts/`, regenerate the JSON Schema for Squads A and B and commit it with the change (AD-4):

```sh
npm run contracts:schema
git diff --exit-code contracts/schema
```

`npm run format` applies Biome's formatting and safe fixes, so `npm run lint` passes.

## Troubleshooting

**`npm run broker` says the address is in use** (`Address already in use`, or on Windows `Only one usage of each socket address`). Another Mosquitto holds port 1883, usually the OS service. Stop it as in step 5. To see who holds the port: `ss -ltnp | grep 1883` on Linux, `Get-NetTCPConnection -LocalPort 1883` in PowerShell. If the compose stack is up, its broker holds the port; use one or the other.

**`npm run broker` says Mosquitto was not found.** Install it (step 1). On Windows, a custom install folder must be on the PATH.

**MySQL accepts connections from other machines.** `bind-address` or `mysqlx-bind-address` isn't `127.0.0.1`. The Windows installer and some Linux packages bind every interface by default. Fix it as in step 3, restart MySQL and re-check with `SHOW VARIABLES LIKE '%bind_address'`.

**`Access denied for user 'stl'@…`.** Run `create-user.sql` (step 3). Keep `127.0.0.1` in `DATABASE_URL`: the `stl` user exists only at `localhost` and `127.0.0.1`, and a URL with `localhost` can resolve to `::1`, which has no `stl` user.

**`npm run db:migrate` or `npm test` waits, then fails with a timeout.** MySQL isn't running or isn't on `127.0.0.1:3306`. Start the service (`sudo systemctl start mysqld` on Fedora, `sudo systemctl start mysql` on Ubuntu, `Get-Service MySQL* | Start-Service` on Windows) or the compose stack.

**Port 3306 is taken when starting the compose stack.** A native MySQL is running; stop it or use it instead of the stack.

**`npm install` or a script complains about the Node version.** Use Node 24.22.1 or a later 24 (`nvm use` in the repo root).
