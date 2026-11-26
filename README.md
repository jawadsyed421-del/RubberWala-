# Rubberwala Brain | Executive Edition

Run locally with Node.js 20 or later.

```powershell
npm.cmd start
```

Open [Rubberwala Brain](http://127.0.0.1:4185/) for the client walkthrough. Open the original [model library](http://127.0.0.1:4185/models.html) to inspect or download individual GLBs. The server binds to loopback. All app assets and demo records are bundled locally.

## Client walkthrough

1. Open the cinematic entrance and enter the Command Centre to filter the portfolio and drill into the KPIs.
2. Open Property Universe, select a building, and inspect inventory, floor records, construction, or finance. Model downloads are available in the inspector.
3. Ask Ralix for November sales, completed floors, outstanding receivables, or a specific floor such as “Show floor 25 of Blue Glass Tower A”.
4. Explore the AI Brain Map, assign a demo task, and review it in the Approval Centre. Use Presentation for a guided sequence through the major views.

## Data and capabilities

- The dashboard, project inspector, briefing, Ralix rules, and CSV export use the same illustrative data for four projects. The reporting period is June–November 2026. Browser storage retains demo tasks, approvals, the project filter, and rendering quality.
- The showcase includes a customer-oriented view using illustrative availability. It is a presentation view within the local demo.
- Ralix answers supported questions through local rules. Voice input depends on browser speech recognition support and microphone permissions.
- The workforce contains ten departments and 50 role configurations. Demo tasks are queued and reviewed locally. Connected agent execution requires a production orchestration and permission layer.
- Google Drive, live company data, OAuth, production role-based authentication, external automation, and a separate customer login require authorized integration work. Demo mode has no confidential records or external task actions.
- Floor records are illustrative. Reliable geometric highlighting and unit placement require verified floor and unit mappings from the original architectural files.

## Model provenance

| Asset | Tripo showcase clip ID |
| --- | --- |
| Blue Glass Tower A | 0f0e8cac-9901-46f9-bf39-007400f4ff04 |
| Ivory Sail Tower | 5533b51d-83e1-4c58-82bf-3fe8a506266b |
| Limestone & Glass Tower | aa6f188a-1a17-48bf-bd63-d9daa63617dd |
| Blue Glass Tower B | ff551a8d-c666-4e23-ae5c-cc9643c23ca1 |

The GLBs are reconstructions from the four supplied turntables. Building names are descriptive. Dimensions and architectural detailing are visually estimated. Each GLB contains its main building, attached podium, and PBR materials. The property viewer normalizes model scale and placement using the asset manifest in `public/data.js`.

Run `npm.cmd run models` to regenerate the four assets. The bundled Three.js MIT license is in `public/vendor/LICENSE`.

## Hands-free Ralix

When the browser has granted access to the microphone, Ralix arms automatically on load. On first use, select **Hands-free** to grant that permission. Speak “Hey Ralix” or double-clap to open a conversation. Another double clap returns Ralix to standby. It stays in the conversation between questions until dismissed. Say “stop listening” to turn off the microphone entirely. Standby pauses when the tab is hidden.

Try “What is the profit today?”, “Go to that page”, “Open the home page”, “Take me to the customer showroom”, “Show floor 25 of Blue Glass Tower A”, or “Queue a task for sales and construction.” Voice-created tasks enter the approval queue. The text dock remains available. Financial answers use the same mock ledger shown in Finance.

To control the scene, say “Open the portfolio, then zoom in”, “Spin from right to left”, “Move from Blue Glass Tower A to Ivory Sail Tower”, “Move to the Rubberwala logo”, or “Reset the camera”. Say “Keep spinning left” to orbit continuously and “Stop spinning” to pause it. “Go to the Agency CRM section” opens Construction.

In Property Universe, select **Enable hand gestures** and allow camera access. Point at a tower or select it from the list. Hold a thumb-and-index pinch to lift and drag it. Open your palm to spread its available model groups and close your hand into a fist to reassemble and reset its placement. Separate and Reassemble are also available as buttons. The gesture transforms are visual, based on the authored GLB groups. The bundled MediaPipe Tasks Vision 0.10.21 runtime and Hand Landmarker model process frames in the browser. Camera input is off by default and stops when leaving the view.

After a closing clap, Ralix switches to local clap standby and stops the speech recognition session. Clap again or press Voice to start a new session.

For a rehearsal, tap the Ralix globe and wait for the listening state. Ask “What’s the profit today?” and interrupt the reply with “How many floors are complete?” Then say “Open Finance” or “Open Documents.” The microphone stays active during responses, and supported navigation commands use the same session on the destination page.

Ralix answers in English or हिन्दी using the same illustrative records. Automatic voice language works with the ElevenLabs realtime recognizer. Choose English or हिन्दी in **Hands-free** if you want to pin the input language for a particular session or browser. Try “क्या हुआ आज, कुछ बताओ”, “इस बिल्डिंग की वॉटरप्रूफिंग कितनी हुई?” or “फ़ाइनेंस विभाग खोलो”.

Clap detection runs locally and the greeting is bundled. Spoken commands use the browser’s speech recognizer, with installed on-device recognition preferred. Microphone access and automatic audio startup depend on browser settings.

## ElevenLabs spoken replies

Set `ELEVENLABS_API_KEY` in the local server environment and restart the app. On Node versions with `process.loadEnvFile`, the server can also read that setting from a private, git-ignored `.env.local` at the project root. `ELEVENLABS_VOICE_ID` is optional and defaults to ElevenLabs' George voice. Use a key authorized for Text to Speech, and check Integrations for the configured provider.

The server streams Eleven Flash v2.5 replies and keeps the credential server-side. Allow Speech to Text on the key to use ElevenLabs Scribe v2 Realtime for the Voice button and active hands-free conversations. The app uses short-lived single-use tokens for those microphone streams. In standby, clap detection is local and the spoken wake phrase uses browser recognition. The wake greeting plays from the bundled audio file. Ralix computes answers from local demo records.

