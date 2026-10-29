const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { describeBody } = require("../validation/schemas");

const router = express.Router();
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/**
 * POST /api/ai/describe-product — admin only. Turns a name plus a few notes
 * into a short product description. Admin-gated and rate limited so a public
 * demo cannot be used to run up API costs.
 */
router.post("/describe-product", requireAuth, requireAdmin, validateBody(describeBody), async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: "The AI description writer is not configured on this server" });
  }
  const { name, notes, family } = req.body;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
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
    console.error("AI description failed:", err.message);
    res.status(502).json({ error: "The AI writer did not respond. Try again in a moment." });
  }
});

module.exports = router;
