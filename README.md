# AGM 40 / DMTas40 — Photo Wall (local server)

A self-hosted photo wall. Guests upload a photo from their phone, it's
auto-cropped to a square, and it shows up one at a time on your display —
no Instagram/Facebook API involved.

## 1. Requirements

- [Node.js](https://nodejs.org) version 18 or later (includes `npm`).
  Check with:
  ```
  node -v
  ```

## 2. Setup (do this once)

Open a terminal in this folder and run:

```
npm install
```

## 3. Run it

```
npm start
```

You'll see something like:

```
  On this computer:
    Wall display   http://localhost:3000/#wall
    Submit photo   http://localhost:3000/#submit

  On phones on the same Wi-Fi:
    Wall display   http://192.168.1.42:3000/#wall
    Submit photo   http://192.168.1.42:3000/#submit
```

- Open the **Wall display** link on the laptop/screen plugged into the venue projector.
- Turn the **Submit photo** link (the one with your Wi-Fi IP, not "localhost")
  into a QR code and put it on table cards, the programme, or a slide.
  Guests on the same Wi-Fi network scan it and upload straight from their phone.
- Leave the terminal window open — closing it stops the server. Press `Ctrl+C` when you're done.

## 4. Important: same Wi-Fi network

Phones need to be on the **same Wi-Fi network** as the computer running the
server (the "192.168.x.x" style address only works on your local network,
not over the internet). If the venue's Wi-Fi splits guests onto a separate
"client isolation" network from the host device, phones won't be able to
reach the server — check with the venue, or use your own portable hotspot
and connect the laptop to it too.

If you need guests to submit from **outside** the local network (e.g. mobile
data, or a venue with strict Wi-Fi isolation), you'd need to either put this
server on a proper host with a public address, or tunnel it with a tool like
`ngrok` — happy to help set that up if needed.

## 5. Where your data lives

- Uploaded photos: `public/uploads/`
- Photo list (names, captions, order): `data/index.json`

Both are plain files on your computer — back them up after the event if you
want to keep them. Deleting a file from `public/uploads/` and its entry from
`data/index.json` removes that photo from the wall.

## 6. Deploying to Render (for a real public URL)

This makes the site reachable from any network — mobile data included — with
no firewall changes on your end, and it can stay live indefinitely.

**Step 1 — Get the code into a Git repository.**
Render deploys from GitHub, GitLab, or Bitbucket. If this folder isn't in a
repo yet:
```
git init
git add .
git commit -m "Photo wall"
```
Then create an empty repository on GitHub (or your org's Git host) and push:
```
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

**Step 2 — Create the service on Render.**
- In the Render dashboard: New → Web Service → connect the repo you just pushed.
- Build command: `npm install`
- Start command: `npm start`
- This repo includes a `render.yaml` blueprint — if you use "New → Blueprint"
  instead, Render will read it and set most of this up automatically,
  including the persistent disk below.

**Step 3 — Add a persistent disk (important — do not skip this).**
Without this, every restart or redeploy wipes all uploaded photos.
- In the service's Settings → Disks → Add Disk
- Mount path: `/var/data`
- Size: 1 GB is plenty for hundreds of event photos
- Persistent disks require a paid instance type (not the free tier) — ask
  whoever manages your Render account which plan to use.

**Step 4 — Set the environment variable.**
- Settings → Environment → Add Environment Variable
- Key: `DATA_DIR`  Value: `/var/data`
- (The `render.yaml` blueprint sets this automatically if you used it.)

**Step 5 — Deploy, then find your URL.**
Render will build and give you a URL like `https://photo-wall-xyz.onrender.com`.
- Wall display: `https://your-url.onrender.com/#wall`
- Submit photo (put this one in your QR codes): `https://your-url.onrender.com/#submit`

**Step 6 — Optional: custom domain.**
In Settings → Custom Domains, you can point something like
`photos.yourorg.tas.gov.au` at it, if your org wants it under your own domain.
That's a DNS change your IT team would make.

## 7. Customizing

- Colors, type, and timing: top of `public/index.html` (`:root` CSS variables,
  and `INTERVAL_MS` in the `<script>` for how long each photo stays up —
  currently 6 seconds).
- Hashtags and event name shown on screen: search `#DMTas40` and `AGM 40` in
  `public/index.html` and replace with your own.
- Port: runs on 3000 by default. To use a different port:
  ```
  PORT=8080 npm start
  ```
