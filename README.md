# Indic Voice AI Patient Engagement Platform

An AI-powered care coordination platform that helps hospitals follow up with patients in their preferred language, capture voice responses, surface medical risk, and keep the care team in the loop.

Built for hackathon-style impact: real patient communication, real multilingual workflows, and real operational value for overworked healthcare teams.

## Why This Matters

Hospitals and clinics lose visibility after discharge.

Patients miss medicines, underreport symptoms, and often cannot comfortably respond in English. Care teams, meanwhile, spend time manually calling patients, documenting updates, and escalating risk too late.

This project turns follow-up care into an automated, multilingual workflow:

- AI places follow-up calls in the patient's language
- The patient responds with voice
- Speech is transcribed and normalized
- Symptoms and medicine adherence are analyzed
- Risk is detected and alerts/reports are generated
- The next workflow action is scheduled automatically

## What Makes It Stand Out

- Multilingual voice outreach designed for Indian patient populations
- End-to-end loop from outreach to transcription to triage to escalation
- Workflow builder for automated follow-up operations, not just a chatbot demo
- Doctor-facing summaries, alerts, and inbox views for actionability
- Built as a usable product with dashboard, queues, scheduling, and patient records

## Core Product Modules

### 1. Patient Dashboard
- View patient records, language preferences, and history
- Track follow-ups, alerts, reports, and workflow assignments

### 2. AI Follow-Ups
- Collect text or audio patient updates
- Transcribe and normalize patient speech
- Detect pain, fever, medicine adherence, and risk level

### 3. Workflow Builder
- Create scheduled follow-up workflows
- Assign patients automatically by language
- Run due workflows in batch
- Prepare outbound AI calls for queued patients

### 4. Automated Calls
- Generate AI voice calls in supported languages
- Play opening prompt, pause for patient speech, transcribe the response
- Display the transcript on the call screen
- Generate a suitable follow-up reply and close the call politely

### 5. Alerts and Medical Inbox
- Raise alerts for medium/high risk follow-ups
- Generate report summaries for the care team
- Maintain an inbox of patient reports for review and sending

### 6. Disease Detection and Clinical Reasoning
- Extract symptoms from follow-up text
- Match likely conditions from a symptom catalog
- Build grounded summaries using clinical references

## Supported Languages

The project currently supports multilingual patient/workflow flows across:

- Bengali
- English
- Gujarati
- Hindi
- Kannada
- Malayalam
- Marathi
- Odia
- Punjabi
- Tamil
- Telugu
- Urdu

## Demo Flow

This is the strongest demo sequence for judges:

1. Add or select a patient with a preferred language.
2. Open the Workflow Builder and assign the patient to a language-matched follow-up workflow.
3. Run due workflows to generate a prepared AI call.
4. Open Automated Calls and play the generated voice prompt.
5. Speak a patient response through the mic.
6. Show the live transcript, normalized symptom summary, risk level, and generated AI reply.
7. Open Alerts or Medical Inbox to show the downstream clinical action.

## System Flow

```mermaid
flowchart TD
    A[Patient Record] --> B[Workflow Assignment]
    B --> C[AI Follow-Up Call]
    C --> D[Patient Voice Response]
    D --> E[Transcription]
    E --> F[Symptom and Risk Analysis]
    F --> G[Alerts and Reports]
    G --> H[Care Team Action]
```

Plain-English flow:

`Patient record -> workflow assignment -> AI follow-up call -> patient voice response -> transcription -> symptom/risk analysis -> alerts/reports -> care team action`

## Tech Stack

### Frontend
- React 19
- Vite
- Material UI
- Recharts
- Axios
- react-media-recorder

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- APScheduler
- SlowAPI

### AI and Communications
- OpenAI for transcription, language normalization, and voice generation
- ElevenLabs as an optional voice provider path
- Twilio for WhatsApp alerting
- SMTP for email notifications

## Repository Structure

```text
Medical-Assistant/
|- app/
|  |- main.py
|  |- routes.py
|  |- models.py
|  |- schemas.py
|  |- crud.py
|  |- openai_audio.py
|  |- openai_followup_automation.py
|  |- risk_engine.py
|  |- disease_matcher.py
|  |- workflow_schedule.py
|  `- data/
|- frontend/
|  |- src/
|  |  |- pages/
|  |  |- components/
|  |  `- api/
|  `- package.json
|- tests/
|- requirements.txt
`- README.md
```

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- OpenAI API key
- Optional: ElevenLabs, Twilio, SMTP credentials

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Medical-Assistant
```

### 2. Configure environment variables

Copy the template and update your secrets:

```bash
copy .env.example .env
```

Set at least:

```env
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
DATABASE_URL=postgresql://username:password@localhost/medical_assistant
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

### 3. Start PostgreSQL

Create a database for the app. The codebase currently uses PostgreSQL locally and ships with a hardcoded development default in [`app/database.py`](app/database.py).

If you are using a different local connection string, update [`app/database.py`](app/database.py) or wire it to your preferred environment-based config before running.

### 4. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 5. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

Backend docs will be available at:

- `http://localhost:8000/docs`

### 6. Install frontend dependencies

```bash
cd frontend
npm install
```

### 7. Run the frontend

```bash
npm run dev
```

Frontend will be available at:

- `http://localhost:5173`

## Test Commands

```bash
python test_connections_fixed.py
python test_medical_system.py
pytest tests
```

## Key API Areas

- `GET /patients` - list patients
- `POST /patients` - create patient
- `POST /ai-followup` - submit text follow-up
- `POST /ai-followup/audio` - submit audio follow-up
- `GET /alerts` - list alerts
- `GET /workflows` - list workflows
- `POST /automation/run-due-workflows` - generate due follow-up calls
- `GET /followup-calls` - inspect prepared/completed AI calls
- `POST /followup-calls/{call_id}/complete/audio` - complete call from patient audio
- `GET /reports/inbox` - view generated patient reports

## Product Screens

The app includes:

- Dashboard
- Patients
- Followups
- Alerts
- AI Followup
- Workflow Builder
- Automated Calls
- Medical Inbox
- Disease Detection

## Hackathon Pitch

If a judge asks "Why should this win?", the short answer is:

This project solves a real healthcare operations problem, not just an AI novelty problem. It combines multilingual voice AI, workflow automation, and clinical risk visibility into a single product that can help care teams scale follow-up without losing empathy or missing warning signs.

## Future Scope

- Real telephony integration for live outbound calling
- Hospital EMR/EHR integrations
- Fine-tuned multilingual medical prompting by language
- Clinician review dashboard for false-positive reduction
- Patient-specific follow-up plans by diagnosis and discharge type
- Analytics for adherence, escalation, and recovery trends

## Notes

- Demo/sample multilingual patients and workflows are seeded at startup.
- The frontend expects the backend at `http://localhost:8000`.
- OpenAI-backed features require a valid API key and backend restart after updating `.env`.

## License

MIT
