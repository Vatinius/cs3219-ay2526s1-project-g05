export class RoomController {
  constructor({ sessionManager }) {
    this.sessionManager = sessionManager;
  }

  registerRoutes(app) {
    app.get("/status", (_req, res) => {
      res.json({ status: "ok" });
    });

    app.get("/sessions", (_req, res) => {
      res.json({ sessions: this.sessionManager.listSessions() });
    });

    app.post("/sessions", (req, res) => {
      try {
        const { sessionId, question } = req.body ?? {};
        const session = this.sessionManager.createSession({ sessionId, question });
        res.status(201).json({ session: session.toSummary() });
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });
  }
}
