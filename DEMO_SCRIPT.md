# Blacklight — 3-Minute Demo Script

**Devpost:** https://cursor-hackathon-ttw.devpost.com  
**Track:** Best Project  
**Deadline:** 2:45 PM sharp

---

## Before recording (5 min)

- [ ] App running at `http://localhost:3000` (or deployed Vercel URL)
- [ ] Close Slack, notifications, extra browser tabs
- [ ] 1080p display, dark mode already on
- [ ] Rehearse once with sample buttons only

---

## Script (~2:45 total)

| Time | Say / Do |
|------|----------|
| **0:00–0:05** | *"Everyone uploads files into AI systems now. But files themselves can attack AI."* |
| **0:05–0:20** | Show Blacklight homepage. Click **Try Malicious Invoice**. Wait for scanning animation. |
| **0:20–0:50** | *"Blacklight found a hidden prompt injection inside a normal-looking invoice."* Point at: red highlight, Risk Score 92, Injection Detected badge, attack type, confidence 94%. |
| **0:50–1:10** | Scroll to **Sanitized output**. *"We strip malicious instructions so only safe content reaches the LLM."* |
| **1:10–1:25** | Click **Try Clean Resume**. *"Clean documents pass through — safe for RAG ingestion."* |
| **1:25–2:15** | *"We built this with Next.js, pdf-parse for extraction, and hybrid regex + heuristic detection — all in Cursor during the hackathon. It's the WAF layer for AI file uploads."* |
| **2:15–2:45** | *"Before antivirus protected computers. Blacklight protects AI."* End on logo/title. |

---

## 10-second pitch (opening or closing)

> "Blacklight scans files for hidden prompt injections and malicious instructions before they reach AI systems."

---

## Devpost checklist

- [ ] Team name filled in
- [ ] Track: **Best Project**
- [ ] 3-minute demo video uploaded (raw file)
- [ ] Video link works in incognito
- [ ] Product URL (localhost OK if no deploy; Vercel URL preferred)
- [ ] Hit **Submit** before 2:45 PM

---

## Deploy (if not done yet)

```bash
npx vercel login
npx vercel --prod
```

Paste the production URL into Devpost.
