# AFAQ Photo Booth

A browser-based photo booth application for events and interactive installations. AFAQ Photo Booth combines a React and Vite frontend with a lightweight Express cloud service for temporary photo uploads and retrieval.

## Overview

The application is designed for event environments where visitors can capture photos, apply visual effects and stickers, and share or retrieve the resulting images through a connected cloud service.

The repository contains two cooperating parts:

- **Booth frontend**: A React application built with Vite. It manages the camera experience, photo composition, effects, stickers, gestures, sounds, localization, and operator controls.
- **Cloud service**: An Express server in `cloud/` that handles temporary uploads, token-based access, and serving the deployed frontend assets when configured for production.

## Features

- Camera-based photo booth workflow in the browser.
- Photo composition with configurable effects, shapes, and stickers.
- Hand and face interaction support powered by MediaPipe Tasks Vision.
- QR-code generation for sharing photos.
- Temporary cloud storage with configurable expiration.
- Operator access protected by a configurable PIN.
- Separate frontend and cloud-service configuration through environment files.
- Local development scripts for running the booth and cloud service together.
- English and Arabic-ready localization support through the project internationalization module.

## Requirements

- Node.js 18 or newer.
- npm.
- A modern browser with camera access.
- HTTPS in production for reliable camera and media permissions.
- A reachable cloud service when upload and sharing features are enabled.

## Installation

Clone the repository and install dependencies for both applications:

```bash
git clone https://github.com/Guettaf-hossam/afaq-photo-booth.git
cd afaq-photo-booth
npm install
npm --prefix cloud install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Update `.env` with values appropriate for your environment. The frontend variables are embedded at build time, so rebuild the frontend after changing them.

```dotenv
VITE_CLOUD_URL=http://localhost:3000
VITE_UPLOAD_KEY=replace-with-a-random-secret
VITE_OPERATOR_PIN=replace-with-a-strong-pin
```

For the cloud service, create `cloud/.env` from the example:

```bash
cp cloud/.env.example cloud/.env
```

Configure it as follows:

```dotenv
PUBLIC_URL=http://localhost:3000
UPLOAD_KEY=replace-with-the-same-upload-secret
TOKEN_SECRET=replace-with-a-long-random-secret
TEMP_MINUTES=10
```

Do not commit `.env` files or real secrets to the repository.

## Development

Run the frontend and cloud service together:

```bash
npm run dev
```

Run only the frontend:

```bash
npm run booth
```

Run only the cloud service:

```bash
npm run cloud
```

The Vite development server normally opens on its configured local port, while the cloud service runs from the `cloud/` directory. Confirm the actual service URLs in your terminal output and environment configuration.

## Production build

Build the frontend:

```bash
npm run build
```

Preview the built frontend locally:

```bash
npm run start
```

The `start` script builds the frontend and starts the Vite preview server together with the cloud service. For production deployments, use a process manager or container platform and configure HTTPS, environment variables, persistent logging, and appropriate storage policies.

The cloud service also includes a Dockerfile and can be deployed independently:

```bash
cd cloud
docker build -t afaq-photo-booth-cloud .
docker run --env-file .env -p 3000:3000 afaq-photo-booth-cloud
```

Adjust the exposed port and deployment configuration to match your hosting provider.

## Configuration reference

### Frontend variables

| Variable | Description |
| --- | --- |
| `VITE_CLOUD_URL` | Base URL used by the booth frontend to communicate with the cloud service. |
| `VITE_UPLOAD_KEY` | Upload key expected by the cloud service. Treat it as sensitive. |
| `VITE_OPERATOR_PIN` | PIN used for operator-only controls. Use a non-default value in real deployments. |

### Cloud variables

| Variable | Description |
| --- | --- |
| `PUBLIC_URL` | Public URL used when generating links and serving the application in production. |
| `UPLOAD_KEY` | Secret required for authorized uploads. It must match the frontend configuration where applicable. |
| `TOKEN_SECRET` | Secret used to sign or protect temporary access tokens. |
| `TEMP_MINUTES` | Lifetime of temporary uploaded photos and access tokens. |

## Project structure

```text
.
├── cloud/                 Express cloud service and Docker configuration
├── docs/                  Event setup and operational checklists
├── public/                Static frontend assets
├── scripts/               Development and testing utilities
├── src/                   React application source
│   ├── screens/           Application screens
│   ├── App.jsx            Main application component
│   ├── camera.js          Camera access and capture logic
│   ├── compose.js         Photo composition logic
│   ├── effects.js         Visual effects
│   ├── faces.js           Face detection and interaction helpers
│   ├── gestures.js        Gesture handling
│   ├── i18n.jsx           Localization support
│   └── styles.css         Application styles
├── .env.example           Frontend configuration template
├── index.html              Frontend entry document
├── package.json            Frontend scripts and dependencies
├── run.bat                 Windows launch helper
└── run.sh                  Unix-like launch helper
```

## Event operations

Before using the application at an event, review:

- [`docs/event-setup.md`](docs/event-setup.md) for setup and deployment preparation.
- [`docs/event-checklist.md`](docs/event-checklist.md) for an operational checklist.

Recommended checks include camera permissions, lighting, network connectivity, cloud reachability, printer or sharing workflows, temporary-file cleanup, and a complete end-to-end test.

## Security and privacy

- Replace every example secret before deployment.
- Never commit `.env`, access tokens, operator PINs, or production credentials.
- Use HTTPS when the booth is accessible on a network or the internet.
- Keep `TOKEN_SECRET` and `UPLOAD_KEY` long, random, and private.
- Set `TEMP_MINUTES` according to the event's privacy and retention requirements.
- Review the cloud service storage behavior before handling personal or sensitive images.
- Restrict access to the cloud service and monitor logs during events.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the frontend and cloud service together. |
| `npm run booth` | Run the Vite frontend only. |
| `npm run cloud` | Run the Express cloud service only. |
| `npm run build` | Build the frontend for production. |
| `npm run start` | Build and preview the frontend while starting the cloud service. |
| `npm run fake-phone` | Run the included fake-phone development utility. |

## Contributing

Contributions are welcome. Before opening a pull request:

1. Explain the problem or improvement clearly.
2. Keep changes focused and compatible with event operation.
3. Do not include real secrets, personal photos, or generated deployment files.
4. Test camera, upload, sharing, and cleanup flows when they are affected.
5. Update the documentation when configuration or operational behavior changes.

## License

This project is licensed under the GNU General Public License v3.0. See [`LICENSE`](LICENSE) for the complete license text.

Because this repository is a fork, verify that you have the right to license all inherited code, assets, fonts, models, and other third-party material under GPL-3.0. The license applies only to material for which the copyright holder has granted the necessary rights; third-party components remain subject to their own licenses.
