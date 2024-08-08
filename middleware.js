export const serverVerification = (req, res, next) => {
    const apiKey = req.header('x-api-key');
    if (apiKey && apiKey === process.env.SERVER_API_KEY) {
      next(); 
    } else {
      res.status(403).send('Forbidden'); // Invalid API key
    }
};