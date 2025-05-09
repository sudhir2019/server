async function clearbetok(winamount, adminId, gameId, userId) {
    try {
        if (winamount <= 0) {
            const userObjectId = new mongoose.Types.ObjectId(userId);

            await Draw.updateMany(
                {
                    gameid: gameId,
                    userid: userObjectId
                },
                {
                    $set: { betok: true }
                }
            );

            console.log(`Cleared betok (set to true) for user ${userId} in game ${gameId}`);
        }
    } catch (error) {
        console.error('Error clearing betok:', error);
    }
}

module.exports = {
    clearbetok
};
