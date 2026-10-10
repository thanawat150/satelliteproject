module.exports = async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'Ken Affiliate LINE Bot',
    time: new Date().toISOString()
  });
};