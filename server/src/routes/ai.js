const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

/**
 * POST /api/ai/describe-product
 * Admin-only. Takes a perfume name plus a few fragrance notes and returns
 * a short, ready-to-publish product description. This is the one AI
 * integration point in an otherwise plain MERN store — small and real,
 * rather than bolted on. Gated behind requireAdmin so a public demo
 * can't be used to run up API costs.
 */
router.post("/describe-product", requireAuth, requireAdmin, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "AI description writer is not configured on this server" });
  }

  const { name, notes, family } = req.body;
  if (!name || !notes) {
    return res.status(400).json({ error: "name and notes are required" });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content:
            `Write a short product description (2-3 sentences, no marketing fluff, no em dashes) ` +
            `for a fragrance called "${name}"${family ? ` in the ${family} family` : ""}, ` +
            `with these notes: ${notes}. Write it the way a small independent perfume house would, ` +
            `not like a mass-market ad. Return only the description text, nothing else.`,
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    res.json({ description: text });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate description" });
  }
});

module.exports = router;
