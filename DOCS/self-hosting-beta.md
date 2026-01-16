# Self-Hosting Beta (Docker + Caddy)

This guide walks you through a simple, secure self-host setup that works well for sharing the arcade on X and supports desktop + mobile browsers. It uses:

- Docker for the app runtime
- Caddy for automatic HTTPS
- A small VPS (Ubuntu 22.04/24.04)

## What you need

- A domain name you control (for HTTPS and X link previews)
- A VPS with a public IP (2 GB RAM recommended)
- Supabase keys (from your project)

## Step 1: Create the server

1. Create a new VPS (Ubuntu 22.04/24.04).
2. Add your SSH public key in the provider UI.
3. Copy the server IP address.

## Step 2: Point your domain to the server

At your DNS provider, create:

- An A record for `your-domain.example` -> `SERVER_IP`

Wait 5-15 minutes for DNS to propagate.

## Step 3: SSH in and harden access

On your local machine:

```bash
ssh root@SERVER_IP
```

On the server:

```bash
apt update && apt upgrade -y
adduser arcade
usermod -aG sudo arcade
```

Copy your SSH key to the new user (run locally):

```bash
ssh-copy-id arcade@SERVER_IP
```

Now switch to the new user:

```bash
su - arcade
```

Optional but recommended (disable root + password login):

```bash
sudo sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl reload sshd
```

## Step 4: Install Docker and Compose

```bash
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker arcade
newgrp docker
```

## Step 5: Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

## Step 6: Pull the code onto the server

If the repo is public:

```bash
git clone https://github.com/your-org/hacktivate-nations-arcade.git
cd hacktivate-nations-arcade
```

If the repo is private, use an SSH deploy key or your Git provider's recommended auth flow.

## Step 7: Configure environment variables

Create a `.env` file in the repo root:

```bash
cat << 'EOF' > .env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=https://your-domain.example
EOF
```

Notes:

- Only include `SUPABASE_SERVICE_ROLE_KEY` if you need server-side privileged Supabase calls.
- `NEXT_PUBLIC_SITE_URL` is used for absolute links and X card previews.

## Step 8: Update the Caddyfile

Edit `Caddyfile` and replace:

- `you@example.com` with your email for TLS certs
- `your-domain.example` with your real domain

## Step 9: Build and run

```bash
docker compose up -d --build
```

## Step 10: Verify

```bash
docker compose logs -f --tail=100
curl -I https://your-domain.example
curl https://your-domain.example/healthz
```

## Step 11: Share on X

Once the site is live:

- Paste the URL into the X post composer
- If the preview does not show, use the X card validator to refresh the cache

## Updates and rollbacks

Update the server with new code:

```bash
git pull
docker compose up -d --build
```

Stop everything:

```bash
docker compose down
```

## Notes and tweaks

- If you need to embed the arcade in another site, remove `X-Frame-Options` in `next.config.ts`.
- The Open Graph image is generated dynamically at `/opengraph-image`.
