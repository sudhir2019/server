const checkIsValidUser = (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      successful: false,
      message: `Missing inputs, username:${username}, password:${password}`,
    });
  }
  next();
};

module.exports = { checkIsValidUser };
