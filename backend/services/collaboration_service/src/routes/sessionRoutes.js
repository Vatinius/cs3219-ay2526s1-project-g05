import { Router } from "express";

const buildSessionRouter = ({ sessionStore }) => {
  if (!sessionStore) {
    throw new Error("A session store instance must be provided");
  }

  const router = Router();

  router.post("/", (req, res) => {
    const { sessionId, initialCode, question } = req.body ?? {};

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required",
      });
    }

    const { created } = sessionStore.ensureSession(sessionId, {
      initialCode,
      question,
    });

    const snapshot = sessionStore.getSessionSnapshot(sessionId);

    return res.status(created ? 201 : 200).json({
      session: snapshot,
      created,
    });
  });

  router.get("/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const snapshot = sessionStore.getSessionSnapshot(sessionId);

    if (!snapshot) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    return res.json({ session: snapshot });
  });

  router.post("/:sessionId/question", (req, res) => {
    const { sessionId } = req.params;
    const { question, userId } = req.body ?? {};

    if (!question) {
      return res.status(400).json({
        error: "question payload is required",
      });
    }

    const snapshot = sessionStore.setQuestion(sessionId, question, { userId });
    const io = req.app.get("io");

    if (io) {
      io.to(sessionId).emit("question:updated", {
        question: snapshot.question,
        updatedBy: userId ?? null,
      });
    }

    return res.status(200).json({ session: snapshot });
  });

  return router;
};

export default buildSessionRouter;
