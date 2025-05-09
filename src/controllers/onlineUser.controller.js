const { User } = require('../models/user.model');
const { Ticket } = require('../models/ticket.model');

const getUserStats = async (req, res) => {
  try {
    // Get all non-deleted users who are players
    const users = await User.find({ role: 'player', isDeleted: false });

    const result = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      // Get all tickets for this user
      const tickets = await Ticket.find({ userid: user._id, isDeleted: false });
      // Calculate totals from tickets
      const playPoints = tickets.reduce((sum, t) => sum + (t.playpoints || 0), 0);
      const winPoints = tickets.reduce((sum, t) => sum + (t.winpoints || 0), 0);
      const claimPoints = tickets.reduce((sum, t) => sum + (t.claimPoints || t.winpoints || 0), 0); // fallback to winpoints
      const endPoints = playPoints - claimPoints;
      if(user.isLoggedIn){
          result.push({
        _id: user._id.toString(),
        username: user.username,
        uniqueId: user._id.toString(),
        points: user.walletBalance,
        playPoints,
        winPoints,
        claimPoints,
        endPoints,
        isOnline: user.isLoggedIn,
        lastLogin: user.lastLogin && !isNaN(new Date(user.lastLogin).getTime())
          ? new Date(user.lastLogin).toLocaleString('en-GB', {
            hour12: true,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          : 'N/A',
      });
      }
      
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getUserStats };
