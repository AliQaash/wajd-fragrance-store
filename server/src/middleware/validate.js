const { ZodError } = require("zod");

/**
 * Validates req.body against a zod schema. On failure, responds 400 with the
 * first problem and the field path it belongs to, so forms can highlight the
 * exact input (e.g. field "variants.1.priceTiers.0.price").
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ error: issue.message, field: issue.path.join(".") });
      }
      next(err);
    }
  };
}

module.exports = { validateBody };
