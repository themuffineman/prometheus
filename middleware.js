export const serverVerification = (req, res, next) => {
    const apiKey = req.header('x-api-key');
    if (apiKey && apiKey === API_KEY) {
      next(); // API key is valid, proceed to the next middleware/route handler
    } else {
      res.status(403).send('Forbidden'); // Invalid API key
    }
};