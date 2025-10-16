"use strict";

const json = require("../../../Traits/ApiResponser");
const db = require("../../../Models/index");
const { Op } = require("sequelize");
const Message = db.Message;
const Conversation = db.Conversation;
const Notification = db.Notifications;
const User = db.User;

function validateRequiredFieldsSequentially(body, requiredFields) {
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new Error(`Field "${field}" is required`);
    }
  }
}

const o = {};

/**
 * Send Message
 * - Automatically creates a conversation if not exists
 * - Emits socket event
 * - Creates notification
 */
o.sendMessage = async function (req, res, next) {
  try {
    const { senderId, receiverId, content } = req.body;

    validateRequiredFieldsSequentially(req.body, [
      "senderId",
      "receiverId",
      "content",
    ]);

    // Ensure sender & receiver exist
    const sender = await User.findByPk(senderId);
    const receiver = await User.findByPk(receiverId);

    if (!sender || !receiver)
      return json.errorResponse(res, "Invalid sender or receiver", 404);

    // Check if a conversation already exists between these two users
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { user1Id: senderId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: senderId },
        ],
      },
    });

    // If no conversation exists, create one automatically
    if (!conversation) {
      conversation = await Conversation.create({
        user1Id: senderId,
        user2Id: receiverId,
      });
    }

    // Create the message
    const message = await Message.create({
      senderId,
      receiverId,
      conversationId: conversation.id,
      content,
    });

    // Create a notification for the receiver
    const notification = await Notification.create({
      userId: receiverId,
      type: "message",
      messageId: message.id,
      content: `New message from ${sender.name || "User " + sender.id}`,
    });

    // Emit real-time events via socket.io
    if (global.io) {
      global.io.to(`user_${receiverId}`).emit("new_message", message);
      global.io.to(`user_${receiverId}`).emit("new_notification", notification);
    }

    return json.successResponse(
      res,
      {
        message: "Message sent successfully",
        data: message,
      },
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Get all messages in a conversation
 */
o.getMessagesByConversation = async function (req, res, next) {
  try {
    const { conversationId } = req.params;

    const messages = await Message.findAll({
      where: { conversationId },
      include: [
        { model: User, as: "sender", attributes: ["id", "name"] },
        { model: User, as: "receiver", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    return json.showAll(res, messages, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Mark a message as read
 */
o.markAsRead = async function (req, res, next) {
  try {
    const { id } = req.params;
    const message = await Message.findByPk(id);

    if (!message) return json.errorResponse(res, "Message not found", 404);

    message.isRead = true;
    await message.save();

    if (global.io) {
      global.io.to(`user_${message.senderId}`).emit("message_read", message);
    }

    return json.successResponse(res, "Message marked as read", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Delete a message
 */
o.deleteMessage = async function (req, res, next) {
  try {
    const { id } = req.params;
    const message = await Message.findByPk(id);
    if (!message) return json.errorResponse(res, "Message not found", 404);

    await message.destroy();

    if (global.io) {
      global.io
        .to(`user_${message.receiverId}`)
        .emit("message_deleted", { messageId: id });
    }

    return json.successResponse(res, "Message deleted successfully", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

/**
 * Get unread messages count for a user
 */
o.getUnreadCount = async function (req, res, next) {
  try {
    const { userId } = req.params;

    const count = await Message.count({
      where: { receiverId: userId, isRead: false },
    });

    return json.successResponse(res, { unreadCount: count }, 200);
  } catch (error) {
    console.error("Unread Count Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
