# ⚡ Shadow System

AI + Growth Intelligence • Demo system for **Minted Engineering**.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-green?logo=vercel)](https://shadow-system.vercel.app)  
[![Watch Loom](https://img.shields.io/badge/Walkthrough-Loom-blue?logo=loom)](https://loom.com/share/your-video-link)

<p align="center">
  <img src="screenshot.png" width="700" alt="Shadow System Screenshot">
</p>

---

## 🚀 Quickstart (one screen, no scrolling)

```bash
git clone https://github.com/Xixos/shadow-system.git
cd shadow-system
npm install     # install frontend deps
npm run dev     # start Next.js on localhost:3000
Optional (backend mock):

bash
Copy
Edit
cd api
pip install -r requirements.txt
uvicorn main:app --reload
🎬 Demo Script (90s flow)
Seed → click Seed to generate synthetic users + events.

Select a user → inspect rank, streak, score, churn risk.

Rescore → click Rescore to update rank & risk; dashboard + insights refresh.

Insights → open the Growth Analytics panel to view logins, views, shares, purchases.

Keyboard shortcuts →

/ focus search

1–4 change sort (risk, score, streak, rank)

S reseed data

R rescore selected user

🛠 Tech
Frontend: Next.js 14, React 18, TailwindCSS, Framer Motion

Charts: Motion + custom sparklines

Backend (mock): FastAPI + SQLite (optional toggle)

Infra: Vercel (UI), GitHub Actions (CI)

Extras: CSV export, demo seed generator, Discord/Slack webhook hooks (optional)

⚖️ Notes
All code/data here is synthetic — no private Minted or ECD data.

Built as a demo artifact to showcase AI-driven growth pipelines, rank validation, and ops→eng instincts.

Default mode is LLM_OFF (fast + free). Toggle possible with OpenAI/Bedrock keys.

📩 Contact
Seydina Diop (Rebel)
LinkedIn • Portfolio • GitHub
