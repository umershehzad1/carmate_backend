const db = require("../Models/index");
const Notifications = db.Notifications;
const createAndEmitNotification = async (data, io) => {
  const {
    receiverId,
    senderId,
    type,
    content,
    messageId,
    testDriveRequestId,
    referralId,
  } = data;

  try {
    const notification = await Notifications.create({
      receiverId,
      senderId,
      type,
      content,
      messageId: messageId || null,
      testDriveRequestId: testDriveRequestId || null,
      referralId: referralId || null,
      isRead: false,
    });

    // Emit real-time notification
    if (io) {
      io.to(`user_${receiverId}`).emit("new_notification", notification);
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

module.exports = createAndEmitNotification;
